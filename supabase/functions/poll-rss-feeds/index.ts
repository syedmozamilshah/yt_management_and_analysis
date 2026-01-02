import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple XML parser for Atom feeds
function parseAtomEntry(xml: string): {
  videoId: string | null;
  channelId: string | null;
  title: string | null;
  publishedAt: string | null;
  link: string | null;
} {
  const result = {
    videoId: null as string | null,
    channelId: null as string | null,
    title: null as string | null,
    publishedAt: null as string | null,
    link: null as string | null,
  }

  const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)
  if (videoIdMatch) {
    result.videoId = videoIdMatch[1].trim()
  }

  const channelIdMatch = xml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i)
  if (channelIdMatch) {
    result.channelId = channelIdMatch[1].trim()
  }

  const titleMatch = xml.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }

  const publishedMatch = xml.match(/<published>([^<]+)<\/published>/i)
  if (publishedMatch) {
    result.publishedAt = publishedMatch[1].trim()
  }

  const linkMatch = xml.match(/<link[^>]*href="([^"]+)"[^>]*>/i)
  if (linkMatch) {
    result.link = linkMatch[1].trim()
  }

  return result
}

function parseAtomFeed(xml: string): Array<ReturnType<typeof parseAtomEntry>> {
  const entries: Array<ReturnType<typeof parseAtomEntry>> = []
  
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = parseAtomEntry(match[1])
    if (entry.videoId && entry.channelId) {
      entries.push(entry)
    }
  }
  
  return entries
}

interface PollResult {
  channel_id: string;
  channel_name: string | null;
  videos_found: number;
  videos_inserted: number;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting RSS polling fallback job...')

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get channels for RSS polling (active users only)
    const { data: channelsToPoll, error: fetchError } = await supabase
      .rpc('get_channels_for_rss_poll')

    if (fetchError) {
      console.error('Error fetching channels for polling:', fetchError)
      throw fetchError
    }

    console.log(`Found ${channelsToPoll?.length || 0} channels to poll`)

    if (!channelsToPoll || channelsToPoll.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No channels to poll',
          polled: 0,
          total_videos_inserted: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: PollResult[] = []
    let polled = 0
    let totalVideosInserted = 0

    for (const channel of channelsToPoll) {
      try {
        if (!channel.rss_feed_url) {
          console.log(`Skipping channel ${channel.channel_id}: no RSS feed URL`)
          continue
        }

        console.log(`Polling RSS feed for channel: ${channel.channel_id} (${channel.channel_name})`)

        // Fetch the RSS feed
        const feedResponse = await fetch(channel.rss_feed_url, {
          headers: {
            'User-Agent': 'Video-Stash-Gallery/1.0 (RSS Polling)'
          }
        })

        if (!feedResponse.ok) {
          console.error(`Failed to fetch RSS for ${channel.channel_id}: ${feedResponse.status}`)
          results.push({
            channel_id: channel.channel_id,
            channel_name: channel.channel_name,
            videos_found: 0,
            videos_inserted: 0,
            success: false,
            error: `HTTP ${feedResponse.status}`
          })
          continue
        }

        const feedXml = await feedResponse.text()
        const entries = parseAtomFeed(feedXml)

        console.log(`Found ${entries.length} entries in RSS feed for ${channel.channel_id}`)

        let videosInserted = 0

        for (const entry of entries) {
          if (!entry.videoId || !entry.channelId) continue

          // Check if video already exists
          const { data: existingVideo } = await supabase
            .from('tracked_videos')
            .select('id')
            .eq('video_id', entry.videoId)
            .single()

          if (existingVideo) {
            // Video already exists, skip
            continue
          }

          const youtubeUrl = entry.link || `https://www.youtube.com/watch?v=${entry.videoId}`
          const thumbnailUrl = `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`

          // Insert new video
          const { error: insertError } = await supabase
            .from('tracked_videos')
            .insert({
              video_id: entry.videoId,
              channel_id: entry.channelId,
              title: entry.title || 'Untitled',
              thumbnail_url: thumbnailUrl,
              youtube_url: youtubeUrl,
              published_at: entry.publishedAt || new Date().toISOString(),
              source: 'rss_poll'
            })

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate, skip
              continue
            }
            console.error('Error inserting video:', insertError)
          } else {
            videosInserted++
            console.log(`Inserted video from RSS: ${entry.videoId}`)
          }
        }

        polled++
        totalVideosInserted += videosInserted

        results.push({
          channel_id: channel.channel_id,
          channel_name: channel.channel_name,
          videos_found: entries.length,
          videos_inserted: videosInserted,
          success: true
        })

        // Small delay between feeds to be nice
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`Error polling ${channel.channel_id}:`, error)
        results.push({
          channel_id: channel.channel_id,
          channel_name: channel.channel_name,
          videos_found: 0,
          videos_inserted: 0,
          success: false,
          error: error.message
        })
      }
    }

    console.log(`RSS polling job completed. Polled: ${polled}, Videos inserted: ${totalVideosInserted}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Polled ${polled} channels`,
        polled,
        total_videos_inserted: totalVideosInserted,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in poll-rss-feeds:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to poll RSS feeds' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
