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
    console.log('Starting competitor channels cron update...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all competitor channels from both tables
    // First, get from user_competitor_channels (user-specific)
    const { data: userChannels, error: userChannelsError } = await supabase
      .from('user_competitor_channels')
      .select('*')
      .order('created_at', { ascending: true })

    if (userChannelsError) {
      console.error('Error fetching user competitor channels:', userChannelsError)
    }

    // Also get from competitor_channels (legacy/global)
    const { data: globalChannels, error: globalChannelsError } = await supabase
      .from('competitor_channels')
      .select('*')
      .order('created_at', { ascending: true })

    if (globalChannelsError) {
      console.error('Error fetching global competitor channels:', globalChannelsError)
    }

    // Combine and deduplicate channels by channel_id
    const allChannels = [...(userChannels || []), ...(globalChannels || [])]
    const uniqueChannels = Array.from(
      new Map(allChannels.map(ch => [ch.channel_id, ch])).values()
    )

    if (uniqueChannels.length === 0) {
      console.log('No competitor channels found to update')
      return new Response(
        JSON.stringify({ success: true, message: 'No competitor channels to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${uniqueChannels.length} unique competitor channels to update`)

    let successCount = 0
    let errorCount = 0
    let totalApiCalls = 0
    const maxApiCalls = 100 // Conservative limit for cron job

    for (const channel of uniqueChannels) {
      if (totalApiCalls >= maxApiCalls) {
        console.log(`Reached API call limit (${maxApiCalls}), stopping update`)
        break
      }

      try {
        console.log(`Updating competitor channel: ${channel.channel_name} (${channel.channel_id})`)

        // Fetch updated channel data from YouTube API
        const channelResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/channels?id=${channel.channel_id}&part=statistics,snippet`
        )
        totalApiCalls++

        if (!channelResponse.ok) {
          console.error(`Failed to fetch channel ${channel.channel_name}: ${channelResponse.status}`)
          errorCount++
          continue
        }

        const channelData = await channelResponse.json()
        
        if (!channelData.items || channelData.items.length === 0) {
          console.error(`No data found for channel ${channel.channel_name}`)
          errorCount++
          continue
        }

        const updatedChannel = channelData.items[0]
        const subscriberCount = parseInt(updatedChannel.statistics.subscriberCount || '0')
        const videoCount = parseInt(updatedChannel.statistics.videoCount || '0')

        // Update user_competitor_channels table
        const { error: userUpdateError } = await supabase
          .from('user_competitor_channels')
          .update({
            channel_subscribers: subscriberCount,
            total_videos: videoCount,
          })
          .eq('channel_id', channel.channel_id)

        if (userUpdateError) {
          console.error(`Error updating user channel ${channel.channel_name}:`, userUpdateError)
        }

        // Update competitor_channels table (legacy)
        const { error: globalUpdateError } = await supabase
          .from('competitor_channels')
          .update({
            channel_subscribers: subscriberCount,
            total_videos: videoCount,
          })
          .eq('channel_id', channel.channel_id)

        if (globalUpdateError) {
          console.error(`Error updating global channel ${channel.channel_name}:`, globalUpdateError)
        }

        // Fetch and update latest videos for this channel
        const videosResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.channel_id}&order=date&maxResults=10&type=video`
        )
        totalApiCalls++

        if (videosResponse.ok) {
          const videosData = await videosResponse.json()
          
          if (videosData.items && videosData.items.length > 0) {
            const videoIds = videosData.items.map((v: any) => v.id.videoId).join(',')
            
            // Get video statistics
            const statsResponse = await makeYouTubeApiRequest(
              `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}`
            )
            totalApiCalls++

            if (statsResponse.ok) {
              const statsData = await statsResponse.json()
              
              for (const video of statsData.items || []) {
                const videoData = {
                  video_id: video.id,
                  title: video.snippet.title,
                  youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
                  thumbnail_url: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || '',
                  channel_name: channel.channel_name,
                  channel_subscribers: subscriberCount,
                  view_count: parseInt(video.statistics?.viewCount || '0'),
                  upload_date: video.snippet.publishedAt,
                }

                // Upsert to competitor_videos
                const { error: videoError } = await supabase
                  .from('competitor_videos')
                  .upsert(videoData, { onConflict: 'video_id' })

                if (videoError) {
                  console.error(`Error upserting video ${video.id}:`, videoError)
                }
              }
            }
          }
        }

        successCount++
        console.log(`Successfully updated ${channel.channel_name}`)

      } catch (error) {
        console.error(`Error updating channel ${channel.channel_name}:`, error)
        errorCount++
      }
    }

    // Log the cron job execution
    await supabase
      .from('channel_update_logs')
      .insert({
        update_type: 'competitor_channels_cron',
        status: 'completed',
        api_calls_used: totalApiCalls,
        error_message: errorCount > 0 ? `${errorCount} channels failed to update` : null,
      })

    console.log(`Competitor channels cron job completed. Success: ${successCount}, Errors: ${errorCount}, API Calls: ${totalApiCalls}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Competitor channels update completed',
        updated: successCount,
        errors: errorCount,
        apiCalls: totalApiCalls,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in competitor channels cron:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
