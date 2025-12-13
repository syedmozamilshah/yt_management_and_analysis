
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
    const { channelName } = await req.json()
    
    if (!channelName) {
      throw new Error('Channel name is required')
    }

    console.log(`Updating stats for channel: ${channelName}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all videos for this channel to fetch fresh data
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('video_id, channel_name')
      .eq('channel_name', channelName)
      .limit(5) // Limit to avoid quota exhaustion

    if (videosError) {
      throw new Error(`Failed to fetch videos: ${videosError.message}`)
    }

    if (!videos || videos.length === 0) {
      throw new Error(`No videos found for channel: ${channelName}`)
    }

    console.log(`Found ${videos.length} videos for channel ${channelName}`)

    let totalApiCalls = 0
    let channelData: any = null
    let totalViews = 0

    // Get fresh data for each video to calculate totals
    for (const video of videos) {
      try {
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${video.video_id}`
        const videoResponse = await makeYouTubeApiRequest(videoUrl)
        totalApiCalls++

        if (videoResponse.ok) {
          const videoData = await videoResponse.json()
          
          if (videoData.items && videoData.items.length > 0) {
            const item = videoData.items[0]
            const viewCount = parseInt(item.statistics?.viewCount || '0')
            totalViews += viewCount

            // Get channel data from the first video if we don't have it yet
            if (!channelData && item.snippet?.channelId) {
              const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${item.snippet.channelId}`
              const channelResponse = await makeYouTubeApiRequest(channelUrl)
              totalApiCalls++

              if (channelResponse.ok) {
                const channelResponseData = await channelResponse.json()
                if (channelResponseData.items && channelResponseData.items.length > 0) {
                  channelData = channelResponseData.items[0]
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching data for video ${video.video_id}:`, error)
      }
    }

    // Update channel in database
    const updateData: any = {
      total_videos: videos.length,
      total_views: totalViews,
      last_updated: new Date().toISOString(),
      update_status: 'success'
    }

    if (channelData) {
      updateData.channel_subscribers = parseInt(channelData.statistics?.subscriberCount || '0')
      updateData.channel_id = channelData.id
    }

    const { error: updateError } = await supabase
      .from('channels')
      .update(updateData)
      .eq('channel_name', channelName)

    if (updateError) {
      throw new Error(`Failed to update channel: ${updateError.message}`)
    }

    // Log the update
    const { data: channelRecord } = await supabase
      .from('channels')
      .select('id')
      .eq('channel_name', channelName)
      .single()

    if (channelRecord) {
      await supabase
        .from('channel_update_logs')
        .insert({
          channel_id: channelRecord.id,
          update_type: 'manual_single',
          status: 'success',
          api_calls_used: totalApiCalls
        })
    }

    console.log(`Successfully updated channel ${channelName}. API calls used: ${totalApiCalls}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        channelName,
        totalVideos: videos.length,
        totalViews,
        apiCallsUsed: totalApiCalls,
        subscriberCount: channelData?.statistics?.subscriberCount || null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error updating channel:', error)
    
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
