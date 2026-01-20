
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveChannelIdWithoutApi } from "../_shared/channel-resolver.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channelUrl } = await req.json()

    if (!channelUrl) {
      return new Response(
        JSON.stringify({ error: 'Channel URL is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Analyzing competitor channel (QUOTA-FREE):', channelUrl)

    // Use quota-free channel resolution via HTML scraping
    const channelInfo = await resolveChannelIdWithoutApi(channelUrl)
    
    if (!channelInfo) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not resolve channel from URL. Please ensure the channel exists and try again.' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const channelId = channelInfo.channel_id
    const channelName = channelInfo.channel_name
    const subscriberCount = channelInfo.channel_subscribers

    console.log('Channel resolved (QUOTA-FREE):', channelName, 'Subscribers:', subscriberCount)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if channel already exists
    const { data: existingChannel } = await supabaseClient
      .from('competitor_channels')
      .select('id')
      .eq('channel_id', channelId)
      .single()

    if (existingChannel) {
      return new Response(
        JSON.stringify({ error: 'This channel is already in your competitors list.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Insert channel into competitor_channels table
    // Note: video count is not available from RSS, so we estimate from RSS or set to 0
    const { error: insertError } = await supabaseClient
      .from('competitor_channels')
      .insert({
        channel_name: channelName,
        channel_id: channelId,
        channel_subscribers: subscriberCount,
        total_videos: 0 // Will be updated when videos are fetched via RSS
      })

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw insertError
    }

    console.log('Competitor channel added successfully (QUOTA-FREE)')

    return new Response(
      JSON.stringify({
        success: true,
        channelName,
        channelId,
        subscriberCount,
        videoCount: 0, // Not available from quota-free method
        method: 'quota-free-scraping'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze competitor channel. Please check the URL and try again.', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
