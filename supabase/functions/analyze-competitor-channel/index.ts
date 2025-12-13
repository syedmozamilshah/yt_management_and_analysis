
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

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

    console.log('Analyzing competitor channel:', channelUrl)

    // Extract channel ID from URL
    let channelId = ''
    
    if (channelUrl.includes('/channel/')) {
      channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0]
      console.log('Extracted channel ID from /channel/ URL:', channelId)
    } else if (channelUrl.includes('/@')) {
      const customName = channelUrl.split('/@')[1].split('/')[0].split('?')[0]
      console.log('Looking for custom channel name:', customName)
      
      try {
        const handleResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${customName}`
        )
        
        if (handleResponse.ok) {
          const handleData = await handleResponse.json()
          console.log('Handle API response:', JSON.stringify(handleData, null, 2))
          
          if (handleData.items && handleData.items.length > 0) {
            channelId = handleData.items[0].id
            console.log('Found channel ID via handle API:', channelId)
          }
        }
      } catch (error) {
        console.log('Handle API error:', error.message)
      }
      
      if (!channelId) {
        try {
          const searchResponse = await makeYouTubeApiRequest(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(customName)}&maxResults=10`
          )
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            console.log('Search results found:', searchData.items?.length || 0, 'channels')
            
            if (searchData.items && searchData.items.length > 0) {
              const exactMatch = searchData.items.find((item: any) => 
                item.snippet.customUrl && item.snippet.customUrl.toLowerCase().includes(customName.toLowerCase())
              ) || searchData.items[0]
              
              channelId = exactMatch.id.channelId || exactMatch.snippet.channelId
              console.log('Found channel ID via search:', channelId)
            }
          }
        } catch (error) {
          console.log('Search API error:', error.message)
        }
      }
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL.' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Using channel ID:', channelId)

    // Get channel details
    const channelResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=snippet,statistics`
    )

    if (!channelResponse.ok) {
      console.error('Channel response not ok:', channelResponse.status)
      throw new Error(`Failed to fetch channel data: ${channelResponse.status}`)
    }

    const channelData = await channelResponse.json()
    console.log('Channel data retrieved successfully')
    
    if (!channelData.items || channelData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Channel not found with the provided URL.' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const channel = channelData.items[0]
    const channelName = channel.snippet.title
    const subscriberCount = parseInt(channel.statistics.subscriberCount || '0')
    const videoCount = parseInt(channel.statistics.videoCount || '0')

    console.log('Channel found:', channelName, 'Subscribers:', subscriberCount)

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
    const { error: insertError } = await supabaseClient
      .from('competitor_channels')
      .insert({
        channel_name: channelName,
        channel_id: channelId,
        channel_subscribers: subscriberCount,
        total_videos: videoCount
      })

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw insertError
    }

    console.log('Competitor channel added successfully')

    return new Response(
      JSON.stringify({
        success: true,
        channelName,
        channelId,
        subscriberCount,
        videoCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    if (error.message.includes('quota') || error.message.includes('API keys')) {
      return new Response(
        JSON.stringify({ 
          error: error.message
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error occurred while analyzing competitor channel. Please try again.', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
