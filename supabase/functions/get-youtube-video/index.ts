
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const { videoId } = await req.json()

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Video ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Fetching video data for:', videoId)

    // Fetch video details including statistics
    const videoResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics`
    )

    if (!videoResponse.ok) {
      if (videoResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Video not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      throw new Error('Failed to fetch video data from YouTube')
    }

    const videoData = await videoResponse.json()
    console.log('YouTube API response:', JSON.stringify(videoData, null, 2))

    if (!videoData.items || videoData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const video = videoData.items[0]
    const title = video.snippet.title
    const thumbnailUrl = video.snippet.thumbnails.maxres?.url || 
                         video.snippet.thumbnails.high?.url || 
                         video.snippet.thumbnails.medium?.url ||
                         video.snippet.thumbnails.default?.url
    const channelId = video.snippet.channelId
    const uploadDate = video.snippet.publishedAt
    const viewCount = parseInt(video.statistics.viewCount || '0')

    console.log('Parsed video data:', { title, uploadDate, viewCount })

    // Fetch channel details to get subscriber count
    const channelResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=snippet,statistics`
    )

    let channelName = video.snippet.channelTitle
    let channelSubscribers = 0

    if (channelResponse.ok) {
      const channelData = await channelResponse.json()
      if (channelData.items && channelData.items.length > 0) {
        const channel = channelData.items[0]
        channelName = channel.snippet.title
        channelSubscribers = parseInt(channel.statistics.subscriberCount || '0')
      }
    }

    const responseData = {
      title,
      thumbnailUrl,
      channelName,
      channelSubscribers,
      uploadDate,
      viewCount
    }

    console.log('Returning response data:', responseData)

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    // Check if it's a quota exhaustion error
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
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
