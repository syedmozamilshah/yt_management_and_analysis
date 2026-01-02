import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoItem {
  video_id: string;
  channel_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string;
  youtube_url: string;
  view_count: number | null;
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel_id, rss_feed_url, days } = await req.json()

    if (!channel_id || !rss_feed_url) {
      return new Response(
        JSON.stringify({ error: 'Channel ID and RSS feed URL are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const fetchDays = days || 7
    console.log(`Fetching videos for channel ${channel_id} from RSS (last ${fetchDays} days)`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate the date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - fetchDays)

    console.log(`Fetching videos from RSS published after: ${dateThreshold.toISOString()}`)

    // Fetch the RSS feed (NO QUOTA USAGE!)
    const feedResponse = await fetch(rss_feed_url, {
      headers: {
        'User-Agent': 'Video-Stash-Gallery/1.0 (Historical Fetch)'
      }
    })

    if (!feedResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch RSS feed: HTTP ${feedResponse.status}` }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const feedXml = await feedResponse.text()
    const entries = parseAtomFeed(feedXml)

    console.log(`Parsed ${entries.length} entries from RSS feed`)

    // Filter by date and build video items
    const allVideos: VideoItem[] = []
    
    for (const entry of entries) {
      if (!entry.videoId || !entry.channelId || !entry.publishedAt) continue

      const publishedDate = new Date(entry.publishedAt)
      if (publishedDate < dateThreshold) {
        // Skip videos older than the requested period
        continue
      }

      const video: VideoItem = {
        video_id: entry.videoId,
        channel_id: entry.channelId,
        title: entry.title || 'Untitled',
        description: null,
        thumbnail_url: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
        published_at: entry.publishedAt,
        youtube_url: entry.link || `https://www.youtube.com/watch?v=${entry.videoId}`,
        view_count: null // RSS doesn't provide view counts, we'll leave as null
      }
      
      allVideos.push(video)
    }

    console.log(`Found ${allVideos.length} videos within ${fetchDays} day period`)

    // Insert videos into tracked_videos, skipping duplicates
    let insertedCount = 0
    let skippedCount = 0

    for (const video of allVideos) {
      // Check if video already exists
      const { data: existing } = await supabase
        .from('tracked_videos')
        .select('id')
        .eq('video_id', video.video_id)
        .single()

      if (existing) {
        skippedCount++
        continue
      }

      const { error: insertError } = await supabase
        .from('tracked_videos')
        .insert({
          ...video,
          source: 'historical_fetch'
        })

      if (insertError) {
        if (insertError.code === '23505') {
          // Duplicate, skip
          skippedCount++
        } else {
          console.error('Error inserting video:', insertError)
        }
      } else {
        insertedCount++
      }
    }

    console.log(`Inserted ${insertedCount} videos, skipped ${skippedCount} duplicates`)

    return new Response(
      JSON.stringify({
        success: true,
        channel_id,
        days: fetchDays,
        videos_found: allVideos.length,
        videos_inserted: insertedCount,
        videos_skipped: skippedCount,
        quota_cost: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch channel videos'
    console.error('Error fetching channel videos:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
