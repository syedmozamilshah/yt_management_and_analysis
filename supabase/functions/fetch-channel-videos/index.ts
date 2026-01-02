import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel_id, days } = await req.json()

    if (!channel_id) {
      return new Response(
        JSON.stringify({ error: 'Channel ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const fetchDays = days || 7
    console.log(`Fetching videos for channel ${channel_id} from last ${fetchDays} days`)

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
    const publishedAfter = dateThreshold.toISOString()

    console.log(`Fetching videos published after: ${publishedAfter}`)

    // Use YouTube Data API to search for videos from this channel
    let allVideos: VideoItem[] = []
    let nextPageToken: string | null = null
    let pageCount = 0
    const maxPages = 5 // Limit to prevent excessive API calls

    do {
      let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel_id}&type=video&order=date&maxResults=50&publishedAfter=${encodeURIComponent(publishedAfter)}`
      
      if (nextPageToken) {
        apiUrl += `&pageToken=${nextPageToken}`
      }

      const searchResponse = await makeYouTubeApiRequest(apiUrl)
      
      if (!searchResponse.ok) {
        console.error('YouTube search API error:', searchResponse.status)
        break
      }

      const searchData = await searchResponse.json()
      
      if (searchData.items && searchData.items.length > 0) {
        // Get video IDs for detailed stats
        const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',')
        
        // Fetch video details for view counts
        const detailsResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`
        )
        
        let videoDetails: Record<string, any> = {}
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json()
          for (const item of detailsData.items || []) {
            videoDetails[item.id] = item
          }
        }

        for (const item of searchData.items) {
          const videoId = item.id.videoId
          const details = videoDetails[videoId]
          const snippet = details?.snippet || item.snippet
          
          const video: VideoItem = {
            video_id: videoId,
            channel_id: channel_id,
            title: snippet.title,
            description: snippet.description?.substring(0, 500) || null,
            thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            published_at: snippet.publishedAt,
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            view_count: details?.statistics?.viewCount ? parseInt(details.statistics.viewCount) : null
          }
          
          allVideos.push(video)
        }
      }

      nextPageToken = searchData.nextPageToken || null
      pageCount++
      
      // Small delay between pages
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } while (nextPageToken && pageCount < maxPages)

    console.log(`Found ${allVideos.length} videos from YouTube API`)

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
        videos_skipped: skippedCount
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
