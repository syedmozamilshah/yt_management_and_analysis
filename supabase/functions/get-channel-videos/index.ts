
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
    const { channelUrl, daysPeriod = '90' } = await req.json()

    if (!channelUrl) {
      return new Response(
        JSON.stringify({ error: 'Channel URL is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate daysPeriod - convert to number for validation
    const validPeriods = [7, 28, 90]
    const periodValue = parseInt(String(daysPeriod), 10)
    const selectedPeriod = validPeriods.includes(periodValue) ? periodValue : 90

    console.log('Fetching all videos from channel:', channelUrl, 'for last', selectedPeriod, 'days')

    // Extract channel ID from URL - reuse logic from analyze-channel
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
        } else if (handleResponse.status === 403) {
          console.log('Handle API quota exceeded, trying search fallback')
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
              let exactMatch = searchData.items.find((item: any) => 
                item.snippet.customUrl && item.snippet.customUrl.toLowerCase().includes(customName.toLowerCase())
              )
              
              if (!exactMatch) {
                exactMatch = searchData.items.find((item: any) => 
                  item.snippet.title.toLowerCase().includes(customName.toLowerCase())
                )
              }
              
              if (!exactMatch) {
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

    console.log('Channel found:', channelName, 'Subscribers:', subscriberCount)

    // Calculate date for the selected period
    const now = new Date()
    const daysAgo = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000))
    const publishedAfter = daysAgo.toISOString()

    console.log(`Looking for videos published after: ${publishedAfter} (last ${selectedPeriod} days)`)

    // Search for recent videos from this channel with pagination to get all videos
    let allVideoItems: any[] = []
    let nextPageToken: string | undefined = undefined
    let pageCount = 0
    const maxPages = 10 // Limit to prevent infinite loops (500 videos max)

    do {
      const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : ''
      const videosResponse = await makeYouTubeApiRequest(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&publishedAfter=${publishedAfter}&order=date&type=video&maxResults=50${pageTokenParam}`
      )

      if (!videosResponse.ok) {
        console.error('Videos response not ok:', videosResponse.status)
        throw new Error(`Failed to fetch channel videos: ${videosResponse.status}`)
      }

      const videosData = await videosResponse.json()
      console.log(`Page ${pageCount + 1}: Found ${videosData.items?.length || 0} videos`)
      
      if (videosData.items && videosData.items.length > 0) {
        allVideoItems = [...allVideoItems, ...videosData.items]
      }
      
      nextPageToken = videosData.nextPageToken
      pageCount++
    } while (nextPageToken && pageCount < maxPages)

    console.log(`Total videos found in last ${selectedPeriod} days:`, allVideoItems.length)
    
    if (allVideoItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: `No videos uploaded in the last ${selectedPeriod} days`,
          videos: [],
          channelName,
          subscriberCount,
          totalVideosFound: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get detailed stats for each video in batches of 50
    const allVideos: any[] = []
    const videoIdBatches: string[][] = []
    
    for (let i = 0; i < allVideoItems.length; i += 50) {
      const batch = allVideoItems.slice(i, i + 50).map((item: any) => item.id.videoId)
      videoIdBatches.push(batch)
    }

    console.log(`Fetching stats for ${allVideoItems.length} videos in ${videoIdBatches.length} batches`)

    for (const batch of videoIdBatches) {
      const videoIds = batch.join(',')
      const videoStatsResponse = await makeYouTubeApiRequest(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoIds}&part=snippet,statistics`
      )

      if (!videoStatsResponse.ok) {
        console.error('Video stats response not ok:', videoStatsResponse.status)
        continue // Skip this batch but continue with others
      }

      const videoStatsData = await videoStatsResponse.json()
      
      if (videoStatsData.items) {
        const batchVideos = videoStatsData.items.map((video: any) => ({
          id: video.id,
          title: video.snippet.title,
          viewCount: parseInt(video.statistics.viewCount || '0'),
          uploadDate: video.snippet.publishedAt,
          thumbnailUrl: video.snippet.thumbnails.maxres?.url || 
                       video.snippet.thumbnails.high?.url || 
                       video.snippet.thumbnails.medium?.url ||
                       video.snippet.thumbnails.default?.url,
          youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`
        }))
        allVideos.push(...batchVideos)
      }
    }

    console.log('Returning', allVideos.length, 'videos from channel')

    console.log('Returning', allVideos.length, 'videos from channel')

    return new Response(
      JSON.stringify({
        channelName,
        subscriberCount,
        totalVideosFound: allVideos.length,
        videos: allVideos
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
        error: 'Internal server error occurred while fetching channel videos. Please try again.', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
