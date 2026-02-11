
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from '../_shared/youtube-api-keys.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting auto-discovery of new videos...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get tracked channels for auto-discovery (same source as RSS polling)
    const { data: channels, error: channelsError } = await supabase
      .from('tracked_channels')
      .select('channel_name, channel_id, channel_subscribers')
      .not('channel_id', 'is', null)
      .eq('is_active', true)

    if (channelsError) {
      throw new Error(`Failed to fetch tracked channels: ${channelsError.message}`)
    }

    if (!channels || channels.length === 0) {
      console.log('No tracked channels found in database')
      return new Response(
        JSON.stringify({ success: true, message: 'No tracked channels to process', processedChannels: 0, totalNewVideos: 0, totalApiCalls: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${channels.length} tracked channels to check for new videos`)

    let totalApiCalls = 0
    let totalNewVideos = 0
    let processedChannels = 0

    // Calculate date range (last 48 hours)
    const now = new Date()
    const publishedAfter = new Date(now.getTime() - (48 * 60 * 60 * 1000)).toISOString()

    for (const channel of channels) {
      try {
        console.log(`Checking channel: ${channel.channel_name}`)

        // Skip channels without subscriber count
        if (!channel.channel_subscribers || channel.channel_subscribers <= 0) {
          console.log(`Skipping ${channel.channel_name} - no subscriber count available`)
          continue
        }

        // Search for recent videos from this channel
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.channel_id}&order=date&type=video&publishedAfter=${publishedAfter}&maxResults=10`
        
        const searchResponse = await makeYouTubeApiRequest(searchUrl)
        totalApiCalls++

        if (!searchResponse.ok) {
          console.error(`Failed to search videos for channel ${channel.channel_name}`)
          continue
        }

        const searchData = await searchResponse.json() as { items?: Array<{ id: { videoId: string } }> }
        
        if (!searchData.items || searchData.items.length === 0) {
          console.log(`No recent videos found for channel: ${channel.channel_name}`)
          continue
        }

        console.log(`Found ${searchData.items.length} recent videos for ${channel.channel_name}`)

        // Check each video to see if it's already in our database
        for (const video of searchData.items) {
          const videoId = video.id.videoId
          
          // Check if video already exists in tracked_videos (not in videos table)
          const { data: existingVideo, error: checkError } = await supabase
            .from('tracked_videos')
            .select('id')
            .eq('video_id', videoId)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            console.error(`Error checking video ${videoId}:`, checkError)
            continue
          }

          if (existingVideo) {
            console.log(`Video ${videoId} already exists in database`)
            continue
          }

          // Get detailed video stats
          const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}`
          const videoResponse = await makeYouTubeApiRequest(videoUrl)
          totalApiCalls++

          if (!videoResponse.ok) {
            console.error(`Failed to get video details for ${videoId}`)
            continue
          }

          const videoData = await videoResponse.json() as { items?: Array<{ statistics?: { viewCount?: string }, snippet: { title: string, thumbnails: Record<string, { url: string }>, publishedAt: string } }> }
          
          if (!videoData.items || videoData.items.length === 0) {
            console.log(`Video details not found for ${videoId}`)
            continue
          }

          const videoDetails = videoData.items[0]
          const viewCount = parseInt(videoDetails.statistics?.viewCount || '0')
          const title = videoDetails.snippet.title
          const thumbnailUrl = videoDetails.snippet.thumbnails.maxres?.url || 
                               videoDetails.snippet.thumbnails.high?.url || 
                               videoDetails.snippet.thumbnails.medium?.url ||
                               videoDetails.snippet.thumbnails.default?.url
          const uploadDate = videoDetails.snippet.publishedAt

          // Only add videos where view count is greater than channel subscribers
          const shouldAddVideo = viewCount > channel.channel_subscribers

          if (shouldAddVideo) {
            console.log(`Adding new video: ${title} (${viewCount} views > ${channel.channel_subscribers} subscribers)`)

            // Add video to tracked_videos table (same as RSS polling, triggers sync to user_videos)
            const { error: insertError } = await supabase
              .from('tracked_videos')
              .insert({
                video_id: videoId,
                channel_id: channel.channel_id,
                title: title,
                thumbnail_url: thumbnailUrl,
                youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
                published_at: uploadDate,
                view_count: viewCount,
                source: 'auto_discovery',
                channel_name: channel.channel_name
              })

            if (insertError) {
              console.error(`Failed to insert video ${videoId}:`, insertError)
            } else {
              totalNewVideos++
              console.log(`Successfully added video: ${title}`)
            }
          } else {
            console.log(`Skipping video ${title} - views (${viewCount}) not greater than subscribers (${channel.channel_subscribers})`)
          }
        }

        processedChannels++
      } catch (error) {
        console.error(`Error processing channel ${channel.channel_name}:`, error)
      }
    }

    // Log the operation
    await supabase
      .from('channel_update_logs')
      .insert({
        update_type: 'auto_discovery',
        status: 'success',
        api_calls_used: totalApiCalls
      })

    const result = {
      success: true,
      processedChannels,
      totalNewVideos,
      totalApiCalls,
      message: `Auto-discovery completed: ${totalNewVideos} new videos added from ${processedChannels} channels (only videos with views > channel subscribers)`
    }

    console.log('Auto-discovery completed:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in auto-discovery:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
