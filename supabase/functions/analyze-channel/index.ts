import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple XML parser for Atom feeds
function parseAtomFeed(xml: string): Array<{
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string;
  link: string;
}> {
  const entries: Array<{
    videoId: string;
    channelId: string;
    title: string;
    publishedAt: string;
    link: string;
  }> = []
  
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1]
    
    const videoIdMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)
    const channelIdMatch = entryXml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i)
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/i)
    const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/i)
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"[^>]*>/i)
    
    if (videoIdMatch && channelIdMatch && titleMatch && publishedMatch) {
      entries.push({
        videoId: videoIdMatch[1].trim(),
        channelId: channelIdMatch[1].trim(),
        title: titleMatch[1].trim(),
        publishedAt: publishedMatch[1].trim(),
        link: linkMatch ? linkMatch[1].trim() : `https://www.youtube.com/watch?v=${videoIdMatch[1].trim()}`
      })
    }
  }
  
  return entries
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channelUrl, daysPeriod = 7 } = await req.json() as { channelUrl?: string; daysPeriod?: number }

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
    const selectedPeriod = validPeriods.includes(daysPeriod) ? daysPeriod : 7

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
      
      // Try to get channel ID from channel handle API endpoint (1 quota unit)
      try {
        const handleResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${customName}`
        )
        
        if (handleResponse.ok) {
          const handleData = await handleResponse.json() as { items?: Array<{ id: string; snippet: { title: string; customUrl?: string; thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } }; statistics: { subscriberCount?: string } }> }
          console.log('Handle API response items:', handleData.items?.length || 0)
          
          if (handleData.items && handleData.items.length > 0) {
            const channel = handleData.items[0]
            channelId = channel.id
            
            // We already have channel info from this call!
            const channelName = channel.snippet.title
            const channelHandle = channel.snippet.customUrl || `@${customName}`
            const channelThumbnail = channel.snippet.thumbnails?.high?.url || 
                                     channel.snippet.thumbnails?.medium?.url || 
                                     channel.snippet.thumbnails?.default?.url
            const subscriberCount = parseInt(channel.statistics.subscriberCount || '0')
            
            console.log('Found channel:', channelName, 'ID:', channelId, 'Subscribers:', subscriberCount)
            
            // Now fetch videos from RSS (FREE - no quota!)
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            console.log('Fetching RSS from:', rssUrl)
            
            const rssResponse = await fetch(rssUrl)
            if (!rssResponse.ok) {
              console.error('RSS fetch failed:', rssResponse.status)
              return new Response(
                JSON.stringify({ 
                  error: 'Failed to fetch channel videos. The channel may not have any videos.' 
                }),
                { 
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              )
            }
            
            const rssXml = await rssResponse.text()
            const allVideos = parseAtomFeed(rssXml)
            console.log('Parsed', allVideos.length, 'videos from RSS')
            
            // Filter by date period
            const now = new Date()
            const cutoffDate = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000))
            
            const filteredVideos = allVideos.filter(video => {
              const publishedDate = new Date(video.publishedAt)
              return publishedDate >= cutoffDate
            })
            
            console.log('Videos in last', selectedPeriod, 'days:', filteredVideos.length)
            
            // Format videos for response
            const videos = filteredVideos.map(video => ({
              id: video.videoId,
              video_id: video.videoId,
              title: video.title,
              thumbnail_url: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
              published_at: video.publishedAt,
              youtube_url: video.link,
              view_count: null // Will be fetched when adding
            }))
            
            return new Response(
              JSON.stringify({
                channel_id: channelId,
                channel_name: channelName,
                channel_handle: channelHandle,
                channel_thumbnail: channelThumbnail,
                channel_subscribers: subscriberCount,
                videos_fetched: videos.length,
                videos: videos,
                rss_feed_url: rssUrl,
                days_period: selectedPeriod
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
        } else if (handleResponse.status === 403) {
          console.log('Handle API quota exceeded')
        } else {
          console.log('Handle API response not ok:', handleResponse.status)
        }
      } catch (error) {
        console.log('Handle API error:', (error as Error).message)
      }
    } else if (channelUrl.includes('/c/') || channelUrl.includes('/user/')) {
      // Handle legacy URLs - need to search
      const legacyName = channelUrl.includes('/c/') 
        ? channelUrl.split('/c/')[1].split('/')[0].split('?')[0]
        : channelUrl.split('/user/')[1].split('/')[0].split('?')[0]
      
      console.log('Looking for legacy channel name:', legacyName)
      
      try {
        const searchResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(legacyName)}&maxResults=5`
        )
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json() as { items?: Array<{ id: { channelId?: string }; snippet: { channelId?: string } }> }
          if (searchData.items && searchData.items.length > 0) {
            channelId = searchData.items[0].id.channelId || searchData.items[0].snippet.channelId || ''
            console.log('Found legacy channel ID:', channelId)
          }
        }
      } catch (error) {
        console.log('Legacy search error:', (error as Error).message)
      }
    }

    // If we have a channel ID but haven't returned yet, fetch channel info
    if (channelId) {
      console.log('Fetching channel info for ID:', channelId)
      
      // Get channel details (1 quota unit)
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

      const channelData = await channelResponse.json() as { items?: Array<{ id: string; snippet: { title: string; customUrl?: string; thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } }; statistics: { subscriberCount?: string } }> }
      
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
      const channelHandle = channel.snippet.customUrl || null
      const channelThumbnail = channel.snippet.thumbnails?.high?.url || 
                               channel.snippet.thumbnails?.medium?.url || 
                               channel.snippet.thumbnails?.default?.url
      const subscriberCount = parseInt(channel.statistics.subscriberCount || '0')

      console.log('Channel found:', channelName, 'Subscribers:', subscriberCount)

      // Fetch videos from RSS (FREE!)
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      console.log('Fetching RSS from:', rssUrl)
      
      const rssResponse = await fetch(rssUrl)
      if (!rssResponse.ok) {
        console.error('RSS fetch failed:', rssResponse.status)
        return new Response(
          JSON.stringify({ 
            channel_id: channelId,
            channel_name: channelName,
            channel_handle: channelHandle,
            channel_thumbnail: channelThumbnail,
            channel_subscribers: subscriberCount,
            videos_fetched: 0,
            videos: [],
            rss_feed_url: rssUrl,
            days_period: selectedPeriod,
            message: 'No videos found in RSS feed'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      const rssXml = await rssResponse.text()
      const allVideos = parseAtomFeed(rssXml)
      console.log('Parsed', allVideos.length, 'videos from RSS')
      
      // Filter by date period
      const now = new Date()
      const cutoffDate = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000))
      
      const filteredVideos = allVideos.filter(video => {
        const publishedDate = new Date(video.publishedAt)
        return publishedDate >= cutoffDate
      })
      
      console.log('Videos in last', selectedPeriod, 'days:', filteredVideos.length)
      
      // Format videos for response
      const videos = filteredVideos.map(video => ({
        id: video.videoId,
        video_id: video.videoId,
        title: video.title,
        thumbnail_url: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
        published_at: video.publishedAt,
        youtube_url: video.link,
        view_count: null
      }))
      
      return new Response(
        JSON.stringify({
          channel_id: channelId,
          channel_name: channelName,
          channel_handle: channelHandle,
          channel_thumbnail: channelThumbnail,
          channel_subscribers: subscriberCount,
          videos_fetched: videos.length,
          videos: videos,
          rss_feed_url: rssUrl,
          days_period: selectedPeriod
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // If we couldn't find channel ID
    return new Response(
      JSON.stringify({ 
        error: 'Could not extract channel ID from URL. Please use a valid YouTube channel URL (e.g., https://youtube.com/@channelname or https://youtube.com/channel/UCXXXXXXX).' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    const err = error as Error
    
    // Check if it's a quota exhaustion error
    if (err.message.includes('quota') || err.message.includes('API keys')) {
      return new Response(
        JSON.stringify({ 
          error: err.message
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
        details: err.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
