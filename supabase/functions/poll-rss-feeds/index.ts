import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from '../_shared/youtube-api-keys.ts'

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

// Fetch view counts for multiple videos efficiently (up to 50 per batch = 1 quota unit)
async function fetchViewCountsBatch(videoIds: string[]): Promise<Map<string, number>> {
  const viewCounts = new Map<string, number>()
  
  if (videoIds.length === 0) return viewCounts
  
  // YouTube API allows up to 50 video IDs per request
  const batchSize = 50
  
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize)
    const idsParam = batch.join(',')
    
    try {
      // Only request statistics part for minimal quota usage (1 unit per request)
      const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${idsParam}`
      const response = await makeYouTubeApiRequest(url)
      
      if (!response.ok) {
        console.error(`YouTube API error fetching view counts: ${response.status}`)
        continue
      }
      
      const data = await response.json()
      
      if (data.items) {
        for (const item of data.items) {
          const viewCount = parseInt(item.statistics?.viewCount || '0', 10)
          viewCounts.set(item.id, viewCount)
        }
      }
      
      console.log(`Fetched view counts for ${data.items?.length || 0} videos (batch ${Math.floor(i / batchSize) + 1})`)
      
    } catch (error) {
      console.error('Error fetching view counts from YouTube API:', error)
      // Continue without view counts - don't fail the whole operation
    }
    
    // Small delay between API batches
    if (i + batchSize < videoIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return viewCounts
}

interface PollResult {
  channel_id: string;
  channel_name: string | null;
  videos_found: number;
  videos_inserted: number;
  success: boolean;
  error?: string;
}

serve(async (req: Request) => {
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

    // Phase 1: Collect all new videos from RSS feeds (no API quota used)
    interface NewVideo {
      videoId: string;
      channelId: string;
      title: string;
      thumbnailUrl: string;
      youtubeUrl: string;
      publishedAt: string;
      channelName: string | null;
    }
    
    const allNewVideos: NewVideo[] = []
    const channelVideoMap = new Map<string, NewVideo[]>()

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

        const channelNewVideos: NewVideo[] = []

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

          const newVideo: NewVideo = {
            videoId: entry.videoId,
            channelId: entry.channelId,
            title: entry.title || 'Untitled',
            thumbnailUrl,
            youtubeUrl,
            publishedAt: entry.publishedAt || new Date().toISOString(),
            channelName: channel.channel_name
          }

          channelNewVideos.push(newVideo)
          allNewVideos.push(newVideo)
        }

        channelVideoMap.set(channel.channel_id, channelNewVideos)
        polled++

        // Small delay between feeds to be nice
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error polling ${channel.channel_id}:`, error)
        results.push({
          channel_id: channel.channel_id,
          channel_name: channel.channel_name,
          videos_found: 0,
          videos_inserted: 0,
          success: false,
          error: errorMessage
        })
      }
    }

    console.log(`Phase 1 complete: Found ${allNewVideos.length} new videos to process`)

    // Phase 2: Batch fetch view counts for all new videos (efficient - 1 quota per 50 videos)
    const allVideoIds = allNewVideos.map(v => v.videoId)
    let viewCounts = new Map<string, number>()
    
    if (allVideoIds.length > 0) {
      console.log(`Fetching view counts for ${allVideoIds.length} videos...`)
      viewCounts = await fetchViewCountsBatch(allVideoIds)
      console.log(`Successfully fetched view counts for ${viewCounts.size} videos`)
    }

    // Phase 3: Insert videos with view counts
    for (const [channelId, videos] of channelVideoMap) {
      let videosInserted = 0
      const channel = channelsToPoll.find(c => c.channel_id === channelId)

      for (const video of videos) {
        const viewCount = viewCounts.get(video.videoId) || null

        // Insert new video with view count
        const { error: insertError } = await supabase
          .from('tracked_videos')
          .insert({
            video_id: video.videoId,
            channel_id: video.channelId,
            title: video.title,
            thumbnail_url: video.thumbnailUrl,
            youtube_url: video.youtubeUrl,
            published_at: video.publishedAt,
            view_count: viewCount,
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
          console.log(`Inserted video: ${video.videoId} with ${viewCount || 'no'} views`)
        }
      }

      totalVideosInserted += videosInserted

      results.push({
        channel_id: channelId,
        channel_name: channel?.channel_name || null,
        videos_found: videos.length,
        videos_inserted: videosInserted,
        success: true
      })
    }

    // Phase 4: Update existing videos that don't have view counts yet
    // Get videos without view counts for tracked channels
    const channelIds = channelsToPoll.map(c => c.channel_id)
    const { data: videosWithoutViews } = await supabase
      .from('tracked_videos')
      .select('video_id')
      .in('channel_id', channelIds)
      .or('view_count.is.null,view_count.eq.0')
      .limit(200) // Limit to 200 videos = 4 API calls max

    if (videosWithoutViews && videosWithoutViews.length > 0) {
      console.log(`Found ${videosWithoutViews.length} existing videos without view counts`)
      
      const videoIdsToUpdate = videosWithoutViews.map(v => v.video_id)
      const existingViewCounts = await fetchViewCountsBatch(videoIdsToUpdate)
      
      // Update videos with fetched view counts
      let updatedCount = 0
      for (const [videoId, viewCount] of existingViewCounts) {
        const { error: updateError } = await supabase
          .from('tracked_videos')
          .update({ view_count: viewCount })
          .eq('video_id', videoId)
        
        if (!updateError) {
          updatedCount++
        }
      }
      
      console.log(`Updated view counts for ${updatedCount} existing videos`)
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

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to poll RSS feeds'
    console.error('Error in poll-rss-feeds:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
