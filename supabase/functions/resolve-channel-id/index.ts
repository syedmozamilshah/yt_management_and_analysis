import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResolveChannelResponse {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  rss_feed_url: string;
  cached: boolean;
}

serve(async (req: Request) => {
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

    console.log('Resolving channel ID for:', channelUrl)

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

    let channelId = ''
    let handle: string | null = null

    // Parse channel URL to extract channel_id or handle
    if (channelUrl.includes('/channel/')) {
      // Direct channel ID URL: youtube.com/channel/UC...
      channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0]
      console.log('Extracted channel ID from URL:', channelId)
    } else if (channelUrl.includes('/@')) {
      // Handle URL: youtube.com/@handle
      handle = channelUrl.split('/@')[1].split('/')[0].split('?')[0]
      console.log('Extracted handle from URL:', handle)
    } else if (channelUrl.startsWith('@')) {
      // Just the handle: @handle
      handle = channelUrl.substring(1).split('/')[0].split('?')[0]
      console.log('Extracted handle:', handle)
    } else if (channelUrl.startsWith('UC') && channelUrl.length >= 24) {
      // Looks like a raw channel ID
      channelId = channelUrl.split('/')[0].split('?')[0]
      console.log('Detected raw channel ID:', channelId)
    } else {
      // Try to treat it as a handle
      handle = channelUrl.replace(/^https?:\/\//, '').replace('youtube.com/', '').replace('www.', '').split('/')[0].split('?')[0]
      console.log('Treating as potential handle:', handle)
    }

    // Check cache first (if we have a handle or channel_id)
    if (channelId) {
      const { data: cached } = await supabase
        .from('tracked_channels')
        .select('channel_id, channel_name, channel_handle, channel_thumbnail, channel_subscribers, rss_feed_url')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single()

      if (cached) {
        console.log('Found cached channel:', cached.channel_name)
        const response: ResolveChannelResponse = {
          channel_id: cached.channel_id,
          channel_name: cached.channel_name,
          channel_handle: cached.channel_handle,
          channel_thumbnail: cached.channel_thumbnail,
          channel_subscribers: cached.channel_subscribers || 0,
          rss_feed_url: cached.rss_feed_url || `https://www.youtube.com/feeds/videos.xml?channel_id=${cached.channel_id}`,
          cached: true
        }
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // If we have a handle, resolve it to channel_id using YouTube API
    if (handle && !channelId) {
      console.log('Resolving handle to channel ID:', handle)
      
      try {
        const handleResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${handle}`
        )
        
        if (handleResponse.ok) {
          const handleData = await handleResponse.json()
          console.log('Handle API response:', JSON.stringify(handleData, null, 2))
          
          if (handleData.items && handleData.items.length > 0) {
            channelId = handleData.items[0].id
            console.log('Resolved channel ID via handle API:', channelId)
          }
        } else {
          console.log('Handle API failed with status:', handleResponse.status)
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.log('Handle API error:', errorMessage)
      }
      
      // Fallback to search if handle resolution fails
      if (!channelId) {
        try {
          console.log('Falling back to search API for handle:', handle)
          const searchResponse = await makeYouTubeApiRequest(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=10`
          )
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            
            if (searchData.items && searchData.items.length > 0) {
              // Try to find exact match
              let match = searchData.items.find((item: any) => 
                item.snippet.customUrl?.toLowerCase().includes(handle!.toLowerCase())
              )
              
              if (!match) {
                match = searchData.items.find((item: any) => 
                  item.snippet.title.toLowerCase().includes(handle!.toLowerCase())
                )
              }
              
              if (!match) {
                match = searchData.items[0]
              }
              
              channelId = match.id.channelId || match.snippet.channelId
              console.log('Found channel ID via search:', channelId)
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.log('Search API error:', errorMessage)
        }
      }
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not resolve channel ID from URL. Please use a valid YouTube channel URL.' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get full channel details
    console.log('Fetching channel details for:', channelId)
    const channelResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=snippet,statistics`
    )

    if (!channelResponse.ok) {
      console.error('Channel API response not ok:', channelResponse.status)
      throw new Error(`Failed to fetch channel data: ${channelResponse.status}`)
    }

    const channelData = await channelResponse.json()
    
    if (!channelData.items || channelData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Channel not found.' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const channel = channelData.items[0]
    const channelName = channel.snippet.title
    const channelHandle = channel.snippet.customUrl || null
    const channelThumbnail = channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.medium?.url || null
    const subscriberCount = parseInt(channel.statistics.subscriberCount || '0')
    
    // Generate RSS feed URL
    const rssFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

    // Save or update in tracked_channels (cache the result)
    const { error: upsertError } = await supabase
      .from('tracked_channels')
      .upsert({
        user_id: user.id,
        channel_id: channelId,
        channel_name: channelName,
        channel_handle: channelHandle,
        channel_thumbnail: channelThumbnail,
        channel_subscribers: subscriberCount,
        rss_feed_url: rssFeedUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,channel_id'
      })

    if (upsertError) {
      console.error('Error saving channel to cache:', upsertError)
      // Don't fail the request, just log the error
    } else {
      console.log('Channel saved to tracked_channels')
    }

    const response: ResolveChannelResponse = {
      channel_id: channelId,
      channel_name: channelName,
      channel_handle: channelHandle,
      channel_thumbnail: channelThumbnail,
      channel_subscribers: subscriberCount,
      rss_feed_url: rssFeedUrl,
      cached: false
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to resolve channel ID'
    console.error('Error resolving channel ID:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
