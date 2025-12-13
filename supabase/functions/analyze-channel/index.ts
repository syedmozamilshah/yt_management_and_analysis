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
    const { channelUrl, daysPeriod = 90 } = await req.json()

    if (!channelUrl) {
      return new Response(
        JSON.stringify({ error: 'Channel URL is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate daysPeriod
    const validPeriods = [7, 28, 90]
    const selectedPeriod = validPeriods.includes(daysPeriod) ? daysPeriod : 90

    console.log('Analyzing channel:', channelUrl, 'for last', selectedPeriod, 'days')

    // Extract channel ID from URL - improved logic
    let channelId = ''
    
    if (channelUrl.includes('/channel/')) {
      channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0]
      console.log('Extracted channel ID from /channel/ URL:', channelId)
    } else if (channelUrl.includes('/@')) {
      // Handle custom URLs like youtube.com/@channelname
      const customName = channelUrl.split('/@')[1].split('/')[0].split('?')[0]
      console.log('Looking for custom channel name:', customName)
      
      // Try to get channel ID from channel handle API endpoint
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
        } else if (handleResponse.status === 403) {
          console.log('Handle API quota exceeded, trying search fallback')
        } else {
          console.log('Handle API response not ok:', handleResponse.status)
        }
      } catch (error) {
        console.log('Handle API error:', error.message)
      }
      
      // If handle API didn't work, try search API as fallback
      if (!channelId) {
        try {
          const searchResponse = await makeYouTubeApiRequest(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(customName)}&maxResults=10`
          )
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            console.log('Search results found:', searchData.items?.length || 0, 'channels')
            
            if (searchData.items && searchData.items.length > 0) {
              // Try to find exact match first
              let exactMatch = searchData.items.find((item: any) => 
                item.snippet.customUrl && item.snippet.customUrl.toLowerCase().includes(customName.toLowerCase())
              )
              
              if (!exactMatch) {
                // If no exact match, try channel title match
                exactMatch = searchData.items.find((item: any) => 
                  item.snippet.title.toLowerCase().includes(customName.toLowerCase())
                )
              }
              
              if (!exactMatch) {
                // Fall back to first result
                exactMatch = searchData.items[0]
              }
              
              channelId = exactMatch.id.channelId || exactMatch.snippet.channelId
              console.log('Found channel ID via search:', channelId, 'for channel:', exactMatch.snippet.title)
            }
          }
        } catch (error) {
          console.log('Search API error:', error.message)
        }
      }
    } else if (channelUrl.includes('/c/') || channelUrl.includes('/user/')) {
      // Handle legacy URLs
      const legacyName = channelUrl.includes('/c/') 
        ? channelUrl.split('/c/')[1].split('/')[0].split('?')[0]
        : channelUrl.split('/user/')[1].split('/')[0].split('?')[0]
      
      console.log('Looking for legacy channel name:', legacyName)
      
      try {
        const searchResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(legacyName)}&maxResults=5`
        )
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          if (searchData.items && searchData.items.length > 0) {
            channelId = searchData.items[0].id.channelId || searchData.items[0].snippet.channelId
            console.log('Found legacy channel ID:', channelId)
          }
        }
      } catch (error) {
        console.log('Legacy search error:', error.message)
      }
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL (e.g., https://youtube.com/@channelname or https://youtube.com/channel/UCXXXXXXX).' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Using channel ID:', channelId)

    // Get channel details including subscriber count
    const channelResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=snippet,statistics`
    )

    if (!channelResponse.ok) {
      console.error('Channel response not ok:', channelResponse.status)
      
      if (channelResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Channel not found. Please check the URL and try again.' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      throw new Error(`Failed to fetch channel data: ${channelResponse.status}`)
    }

    const channelData = await channelResponse.json()
    console.log('Channel data retrieved successfully')
    
    if (!channelData.items || channelData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Channel not found with the provided URL. Please verify the channel exists.' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const channel = channelData.items[0]
    const channelName = channel.snippet.title
    const subscriberCount = parseInt(channel.statistics.subscriberCount || '0')

    console.log('Channel found:', channelName, 'Subscribers:', subscriberCount)

    // Calculate date for the selected period
    const now = new Date()
    const daysAgo = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000))
    const publishedAfter = daysAgo.toISOString()

    console.log(`Looking for videos published after: ${publishedAfter} (last ${selectedPeriod} days)`)

    // Search for recent videos from this channel
    const videosResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&publishedAfter=${publishedAfter}&order=date&type=video&maxResults=50`
    )

    if (!videosResponse.ok) {
      console.error('Videos response not ok:', videosResponse.status)
      throw new Error(`Failed to fetch channel videos: ${videosResponse.status}`)
    }

    const videosData = await videosResponse.json()
    console.log(`Videos found in last ${selectedPeriod} days:`, videosData.items?.length || 0)
    
    if (!videosData.items || videosData.items.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: `No videos uploaded in the last ${selectedPeriod} days`,
          viralVideos: [],
          channelName,
          subscriberCount,
          totalVideosLast90Days: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get detailed stats for each video
    const videoIds = videosData.items.map((item: any) => item.id.videoId).join(',')
    console.log('Fetching stats for', videosData.items.length, 'videos')
    
    const videoStatsResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoIds}&part=snippet,statistics`
    )

    if (!videoStatsResponse.ok) {
      console.error('Video stats response not ok:', videoStatsResponse.status)
      throw new Error(`Failed to fetch video statistics: ${videoStatsResponse.status}`)
    }

    const videoStatsData = await videoStatsResponse.json()
    console.log('Video stats retrieved for', videoStatsData.items?.length || 0, 'videos')
    
    // Filter videos that have more views than channel subscribers
    const viralVideos = videoStatsData.items
      .map((video: any) => {
        const viewCount = parseInt(video.statistics.viewCount || '0')
        const isViral = viewCount > subscriberCount
        
        console.log(`Video: "${video.snippet.title}" - Views: ${viewCount}, Viral: ${isViral}`)
        
        return {
          video,
          viewCount,
          isViral
        }
      })
      .filter((item: any) => item.isViral)
      .map((item: any) => ({
        id: item.video.id,
        title: item.video.snippet.title,
        viewCount: item.viewCount,
        uploadDate: item.video.snippet.publishedAt,
        thumbnailUrl: item.video.snippet.thumbnails.maxres?.url || 
                     item.video.snippet.thumbnails.high?.url || 
                     item.video.snippet.thumbnails.medium?.url ||
                     item.video.snippet.thumbnails.default?.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${item.video.id}`
      }))

    console.log('Found', viralVideos.length, 'viral videos out of', videoStatsData.items.length, 'total videos')

    return new Response(
      JSON.stringify({
        channelName,
        subscriberCount,
        totalVideosLast90Days: videoStatsData.items.length,
        viralVideos
      }),
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
      JSON.stringify({ 
        error: 'Internal server error occurred while analyzing channel. Please try again.', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
