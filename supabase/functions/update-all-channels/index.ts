
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
    console.log('Starting bulk channel update...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all channels
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('*')
      .order('last_updated', { ascending: true }) // Update oldest first

    if (channelsError) {
      throw new Error(`Failed to fetch channels: ${channelsError.message}`)
    }

    if (!channels || channels.length === 0) {
      throw new Error('No channels found to update')
    }

    console.log(`Found ${channels.length} channels to update`)

    let totalApiCalls = 0
    let successCount = 0
    let errorCount = 0
    const maxApiCalls = 300 // Conservative limit to avoid quota exhaustion

    for (const channel of channels) {
      if (totalApiCalls >= maxApiCalls) {
        console.log(`Reached API call limit (${maxApiCalls}), stopping bulk update`)
        break
      }

      try {
        console.log(`Updating channel: ${channel.channel_name}`)

        // Update channel status to 'updating'
        await supabase
          .from('channels')
          .update({ update_status: 'updating' })
          .eq('id', channel.id)

        // Get videos for this channel (limit to reduce API calls)
        const { data: videos, error: videosError } = await supabase
          .from('videos')
          .select('video_id, view_count')
          .eq('channel_name', channel.channel_name)
          .limit(3) // Limit videos per channel to conserve API quota

        if (videosError) {
          throw new Error(`Failed to fetch videos for ${channel.channel_name}: ${videosError.message}`)
        }

        if (!videos || videos.length === 0) {
          console.log(`No videos found for channel: ${channel.channel_name}`)
          continue
        }

        let channelData: any = null
        let totalViews = 0

        // Get channel data from the first video
        if (videos.length > 0) {
          const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videos[0].video_id}`
          const videoResponse = await makeYouTubeApiRequest(videoUrl)
          totalApiCalls++

          if (videoResponse.ok) {
            const videoData = await videoResponse.json()
            
            if (videoData.items && videoData.items.length > 0) {
              const channelId = videoData.items[0].snippet?.channelId
              
              if (channelId) {
                const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`
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
        }

        // Calculate total views from existing data (to avoid too many API calls)
        totalViews = videos.reduce((sum, video) => sum + (video.view_count || 0), 0)

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
          .eq('id', channel.id)

        if (updateError) {
          throw new Error(`Failed to update channel ${channel.channel_name}: ${updateError.message}`)
        }

        // Log successful update
        await supabase
          .from('channel_update_logs')
          .insert({
            channel_id: channel.id,
            update_type: 'bulk_update',
            status: 'success',
            api_calls_used: 2 // Approximate API calls per channel
          })

        successCount++
        console.log(`Successfully updated channel: ${channel.channel_name}`)

        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error updating channel ${channel.channel_name}:`, error)
        errorCount++

        // Update channel status to error
        await supabase
          .from('channels')
          .update({ update_status: 'error' })
          .eq('id', channel.id)

        // Log error
        await supabase
          .from('channel_update_logs')
          .insert({
            channel_id: channel.id,
            update_type: 'bulk_update',
            status: 'error',
            error_message: error.message,
            api_calls_used: 0
          })
      }
    }

    console.log(`Bulk update completed. Success: ${successCount}, Errors: ${errorCount}, API calls used: ${totalApiCalls}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Bulk channel update completed',
        results: {
          totalChannels: channels.length,
          successCount,
          errorCount,
          apiCallsUsed: totalApiCalls
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in bulk channel update:', error)
    
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
