import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { makeYouTubeApiRequest, keyManager } from "../_shared/youtube-api-keys.ts"
import { resolveChannelIdWithoutApi, ChannelInfo, scrapeVideosFromChannel } from "../_shared/channel-resolver.ts"

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
  
  let matchCount = 0;
  while ((match = entryRegex.exec(xml)) !== null) {
    matchCount++;
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
  
  console.log(`[RSS Parser] Processed ${matchCount} entry tags, extracted ${entries.length} valid videos`);
  return entries
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Please send valid JSON.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { channelUrl, daysPeriod = 7 } = requestBody as { channelUrl?: string; daysPeriod?: number }

    console.log('Received request:', { channelUrl, daysPeriod });

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

    let channelInfo: ChannelInfo | null = null;
    let apiError: string | null = null;
    
    // ============================================
    // STEP 1: Try YouTube API first to extract channel ID
    // ============================================
    console.log('[YouTube API] Attempting to extract channel ID via YouTube Data API...')
    
    try {
      // Extract handle if it's a handle URL
      const handleMatch = channelUrl.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)|^@?([a-zA-Z0-9_.-]+)$/);
      const handle = handleMatch ? (handleMatch[1] || handleMatch[2]) : null;
      
      // Extract channel ID if it's a channel URL
      const channelIdMatch = channelUrl.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      const channelId = channelIdMatch ? channelIdMatch[1] : null;
      
      const rawChannelId = channelUrl.trim();
      const isRawChannelId = /^UC[a-zA-Z0-9_-]{22}$/.test(rawChannelId);
      
      const apiKey = keyManager.getCurrentKey();
      
      if (apiKey) {
        let apiChannelId: string | null = null;
        let apiChannelName: string | null = null;
        let apiChannelThumbnail: string | null = null;
        let apiHandle: string | null = handle || null;
        let apiSubscribers: number = 0;
        
        // Try YouTube API with the appropriate endpoint
        try {
          console.log('[YouTube API] Using API key, attempting to resolve channel...');
          
          let apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics`;
          
          if (handle) {
            console.log('[YouTube API] Resolving handle:', handle);
            apiUrl += `&forHandle=${encodeURIComponent(handle)}`;
          } else if (channelId) {
            console.log('[YouTube API] Resolving channel ID from URL:', channelId);
            apiUrl += `&id=${encodeURIComponent(channelId)}`;
          } else if (isRawChannelId) {
            console.log('[YouTube API] Input is raw channel ID:', rawChannelId);
            apiUrl += `&id=${encodeURIComponent(rawChannelId)}`;
          } else {
            console.log('[YouTube API] Could not extract channel ID or handle from input');
            apiUrl = null;
          }
          
          if (apiUrl) {
            const response = await makeYouTubeApiRequest(apiUrl);
            
            if (response.ok) {
              const data = await response.json() as Record<string, any>;
              console.log('[YouTube API] Response items count:', data.items?.length || 0);
              
              if (data.items && data.items.length > 0) {
                const channelItem = data.items[0];
                apiChannelId = channelItem.id;
                apiChannelName = channelItem.snippet?.title || null;
                apiChannelThumbnail = channelItem.snippet?.thumbnails?.high?.url || null;
                
                // customUrl from API includes @ prefix, so normalize both for comparison
                const apiCustomUrl = (channelItem.snippet?.customUrl || '').toLowerCase().replace(/^@/, '');
                const inputHandle = (handle || '').toLowerCase().replace(/^@/, '');
                
                const apiSubscribersRaw = channelItem.statistics?.subscriberCount;
                apiSubscribers = apiSubscribersRaw ? parseInt(apiSubscribersRaw, 10) : 0;
                
                console.log('[YouTube API] Parsed channel data:', {
                  id: apiChannelId,
                  name: apiChannelName,
                  customUrl: apiCustomUrl,
                  inputHandle: inputHandle,
                  subscriberCount: apiSubscribers,
                  hasStatistics: !!channelItem.statistics
                });

                // Validate handle matches (if we were resolving a handle)
                if (handle && apiCustomUrl && apiCustomUrl !== inputHandle) {
                  console.log('[YouTube API] ⚠️ Handle mismatch detected, will fall back to HTML scraping:', {
                    inputHandle: inputHandle,
                    apiCustomUrl: apiCustomUrl
                  });
                  apiChannelId = null;
                }
                
                if (!apiChannelId) {
                  console.log('[YouTube API] Skipping API result due to handle mismatch');
                } else {
                  console.log('[YouTube API] ✅ Successfully resolved via API:', {
                    name: apiChannelName,
                    id: apiChannelId,
                    handle: apiHandle,
                    subs: apiSubscribers
                  });
                  
                  // Validate via RSS feed
                  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${apiChannelId}`;
                  try {
                    const rssResponse = await fetch(rssUrl);
                    if (rssResponse.ok) {
                      const rssXml = await rssResponse.text();
                      const entryMatch = rssXml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/);
                      if (entryMatch) {
                        channelInfo = {
                          channel_id: apiChannelId,
                          channel_name: apiChannelName || 'Unknown',
                          channel_handle: apiHandle,
                          channel_thumbnail: apiChannelThumbnail,
                          channel_subscribers: apiSubscribers,
                          rss_feed_url: rssUrl,
                        resolution_method: 'direct'
                        };
                        console.log('[YouTube API] Validated channel via RSS feed');
                      }
                    }
                  } catch (rssError) {
                    console.log('[YouTube API] RSS validation skipped:', (rssError as Error).message);
                    // Still set channelInfo even if RSS fails
                    if (!channelInfo) {
                      channelInfo = {
                        channel_id: apiChannelId,
                        channel_name: apiChannelName || 'Unknown',
                        channel_handle: apiHandle,
                        channel_thumbnail: apiChannelThumbnail,
                        channel_subscribers: apiSubscribers,
                        rss_feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${apiChannelId}`,
                        resolution_method: 'direct'
                      };
                    }
                  }
                }
              }
            } else {
              const errorData = await response.json().catch(() => ({})) as Record<string, any>;
              apiError = errorData.error?.message || `API error ${response.status}`;
              console.log('[YouTube API] Failed:', apiError);
            }
          }
        } catch (apiRequestError) {
          apiError = (apiRequestError as Error).message;
          console.log('[YouTube API] Request exception:', apiError);
        }
      } else {
        console.log('[YouTube API] No API keys available');
      }
    } catch (apiSetupError) {
      console.log('[YouTube API] Setup error:', (apiSetupError as Error).message);
    }
    
    // ============================================
    // STEP 2: Fall back to bulletproof HTML scraping if API didn't work
    // ============================================
    if (!channelInfo) {
      console.log('[HTML Scraping] YouTube API failed or exhausted, falling back to bulletproof HTML scraping...')
      
      try {
        channelInfo = await resolveChannelIdWithoutApi(channelUrl);
        if (channelInfo) {
          console.log('[HTML Scraping] ✅ Successfully resolved via HEAD-section extraction:', {
            name: channelInfo.channel_name,
            id: channelInfo.channel_id,
            handle: channelInfo.channel_handle,
            subs: channelInfo.channel_subscribers
          });
        } else {
          console.log('[HTML Scraping] Failed to resolve channel');
        }
      } catch (scrapingError) {
        console.log('[HTML Scraping] Exception:', (scrapingError as Error).message);
      }
    }
    
    // ============================================
    // STEP 3: Always enhance subscriber count from HTML (to get latest accurate data)
    // ============================================
    console.log('[Subscriber Enhancement] Starting enhancement. Current API subs:', channelInfo?.channel_subscribers);
    
    if (channelInfo) {
      console.log('[Subscriber Enhancement] Fetching latest subscriber count from channel page HTML...');
      
      try {
        // Fetch the channel page to get subscriber count
        const channelPageUrl = `https://www.youtube.com/channel/${channelInfo.channel_id}`;
        const pageResponse = await fetch(channelPageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });
        
        if (pageResponse.ok) {
          const html = await pageResponse.text();
          console.log('[Subscriber Enhancement] Fetched channel page HTML, size:', html.length);
          
          // Try to find subscriber count in ytInitialData
          let subsText: string | null = null;
          const ytDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
          if (ytDataMatch && ytDataMatch[1]) {
            try {
              console.log('[Subscriber Enhancement] Found ytInitialData, attempting to parse...');
              const data = JSON.parse(ytDataMatch[1]);
              const header = data?.header?.c4TabbedHeaderRenderer;
              subsText = header?.subscriberCountText?.simpleText;
              
              if (subsText) {
                console.log('[Subscriber Enhancement] Found subscriberCountText:', subsText);
                // Parse subscriber count like "5.43M subscribers"
                const subMatch = subsText.match(/([0-9.]+)\s*([KMB]?)/i);
                if (subMatch) {
                  let num = parseFloat(subMatch[1]);
                  const suffix = (subMatch[2] || '').toUpperCase();
                  if (suffix === 'K') num *= 1000;
                  else if (suffix === 'M') num *= 1000000;
                  else if (suffix === 'B') num *= 1000000000;
                  
                  channelInfo.channel_subscribers = Math.round(num);
                  console.log('[Subscriber Enhancement] ✅ Extracted from ytInitialData:', channelInfo.channel_subscribers, '(from:', subsText, ')');
                }
              } else {
                console.log('[Subscriber Enhancement] subscriberCountText not found in header');
              }
            } catch (jsonError) {
              console.log('[Subscriber Enhancement] Failed to parse ytInitialData JSON:', (jsonError as Error).message);
            }
          } else {
            console.log('[Subscriber Enhancement] ytInitialData not found in HTML');
          }
          
          // Fallback: regex search for subscriber pattern in the entire HTML
          // Try this regardless of whether JSON parsing succeeded, to get the most accurate count
          if (!subsText) {
            console.log('[Subscriber Enhancement] No subsText from JSON, using HTML regex fallback...');
            // Look for ALL patterns like "5.43M subscribers" or "123K subscribers" and pick the LARGEST
            const subPatterns = Array.from(html.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*([KMBT]?)\s+subscribers/gi));
            
            if (subPatterns.length > 0) {
              console.log('[Subscriber Enhancement] Found', subPatterns.length, 'subscriber patterns');
              
              let largestCount = 0;
              let largestPattern = '';
              
              for (const match of subPatterns) {
                console.log('[Subscriber Enhancement] Found pattern:', match[0]);
                let num = parseFloat(match[1]);
                const suffix = (match[2] || '').toUpperCase();
                
                if (suffix === 'K') num *= 1000;
                else if (suffix === 'M') num *= 1000000;
                else if (suffix === 'B') num *= 1000000000;
                else if (suffix === 'T') num *= 1000000000000;
                
                if (num > largestCount) {
                  largestCount = num;
                  largestPattern = match[0];
                }
              }
              
              const extractedCount = Math.round(largestCount);
              if (extractedCount > 0) {
                channelInfo.channel_subscribers = extractedCount;
                console.log('[Subscriber Enhancement] ✅ Selected LARGEST subscriber count:', largestPattern, '→', extractedCount);
              }
            } else {
              console.log('[Subscriber Enhancement] No subscriber pattern found via regex');
            }
          }
        } else {
          console.log('[Subscriber Enhancement] Failed to fetch channel page:', pageResponse.status);
        }
      } catch (enhanceError) {
        console.log('[Subscriber Enhancement] Failed to enhance subscriber count:', (enhanceError as Error).message);
      }
    }
    
    console.log('[Channel Resolution] Final channel info BEFORE vid fetch:', {
      id: channelInfo?.channel_id,
      name: channelInfo?.channel_name,
      handle: channelInfo?.channel_handle,
      subscribers: channelInfo?.channel_subscribers,
      method: channelInfo?.resolution_method
    });
    
    // ✅ FORCE: Always try to get the absolute latest subscriber count from channel page HTML
    // This ensures we have the most accurate number before returning to frontend
    if (channelInfo && channelInfo.channel_id) {
      console.log('🔥 [FORCED HTML EXTRACTION] Fetching latest subscriber count for channel:', channelInfo.channel_id);
      
      try {
        const forceUrl = `https://www.youtube.com/channel/${channelInfo.channel_id}`;
        const forceResponse = await fetch(forceUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        
        if (forceResponse.ok) {
          const forceHtml = await forceResponse.text();
          
          // Try ytInitialData first
          const forcedYtMatch = forceHtml.match(/var ytInitialData = ({.*?});<\/script>/s);
          if (forcedYtMatch) {
            try {
              const forcedData = JSON.parse(forcedYtMatch[1]);
              let forcedSubs: string | null = null;
              
              // Try multiple header paths (YouTube changes structure)
              const header = forcedData?.header?.c4TabbedHeaderRenderer;
              if (header?.subscriberCountText?.simpleText) {
                forcedSubs = header.subscriberCountText.simpleText;
                console.log('🔥 [FORCED] Found in c4TabbedHeaderRenderer:', forcedSubs);
              }
              
              // If not found, search entire JSON for ALL subscriber patterns and pick largest
              if (!forcedSubs) {
                console.log('🔥 [FORCED] Header path not found, searching all JSON for subscriber patterns...');
                const jsonStr = JSON.stringify(forcedData);
                const patterns = Array.from(jsonStr.matchAll(/(\d+\.?\d*[KMB]?)\s+subscribers/gi));
                
                if (patterns.length > 0) {
                  console.log('🔥 [FORCED] Found', patterns.length, 'subscriber patterns');
                  
                  let largestCount = 0;
                  let largestPattern = '';
                  
                  for (const match of patterns) {
                    let num = parseFloat(match[1]);
                    const suffix = match[1].replace(/[\d.]/g, '').toUpperCase();
                    
                    if (suffix.includes('K')) num *= 1000;
                    else if (suffix.includes('M')) num *= 1000000;
                    else if (suffix.includes('B')) num *= 1000000000;
                    
                    if (num > largestCount) {
                      largestCount = num;
                      largestPattern = match[1];
                    }
                  }
                  
                  if (largestPattern) {
                    forcedSubs = largestPattern + ' subscribers';
                    console.log('🔥 [FORCED] Selected LARGEST:', largestPattern);
                  }
                }
              }
              
              // Parse the subscriber count
              if (forcedSubs) {
                const forcedMatch = forcedSubs.match(/([0-9.]+)\s*([KMBT]?)/i);
                if (forcedMatch) {
                  let forcedNum = parseFloat(forcedMatch[1]);
                  const forcedSuffix = (forcedMatch[2] || '').toUpperCase();
                  if (forcedSuffix === 'K') forcedNum *= 1000;
                  else if (forcedSuffix === 'M') forcedNum *= 1000000;
                  else if (forcedSuffix === 'B') forcedNum *= 1000000000;
                  else if (forcedSuffix === 'T') forcedNum *= 1000000000000;
                  
                  const oldSubs = channelInfo.channel_subscribers;
                  channelInfo.channel_subscribers = Math.round(forcedNum);
                  if (oldSubs !== channelInfo.channel_subscribers) {
                    console.log('🔥 [FORCED] UPDATED subscriber count:', { old: oldSubs, new: channelInfo.channel_subscribers });
                  }
                }
              } else {
                console.log('🔥 [FORCED] Could not extract subscriber count from HTML');
              }
            } catch (e) {
              console.log('🔥 [FORCED] ytInitialData parse failed:', (e as Error).message);
            }
          }
        } else {
          console.log('🔥 [FORCED] Failed to fetch channel page:', forceResponse.status);
        }
      } catch (forceError) {
        console.log('🔥 [FORCED] Exception:', (forceError as Error).message);
      }
    }
    
    console.log('[Channel Resolution] Final channel info AFTER forced extraction:', {
      id: channelInfo?.channel_id,
      name: channelInfo?.channel_name,
      handle: channelInfo?.channel_handle,
      subscribers: channelInfo?.channel_subscribers,
      method: channelInfo?.resolution_method
    });
    
    // ============================================
    // STEP 4: If channel resolved, fetch videos from RSS
    // ============================================
    if (channelInfo) {
      const rssUrl = channelInfo.rss_feed_url || `https://www.youtube.com/feeds/videos.xml?channel_id=${channelInfo.channel_id}`;
      console.log('[Primary] Fetching videos from RSS:', rssUrl);
      
      try {
        const rssResponse = await fetch(rssUrl);
        console.log('[Primary] RSS response status:', rssResponse.status);
        console.log('[Primary] RSS response headers:', Object.fromEntries(rssResponse.headers.entries()));
        
        if (rssResponse.ok) {
          const rssXml = await rssResponse.text();
          console.log('[Primary] RSS response size:', rssXml.length, 'bytes');
          
          // Log first 500 chars of RSS to debug
          console.log('[Primary] RSS first 500 chars:', rssXml.substring(0, 500));
          
          const allVideos = parseAtomFeed(rssXml);
          console.log('[Primary] Parsed', allVideos.length, 'total videos from RSS');
          
          if (allVideos.length > 0) {
            console.log('[Primary] First video:', allVideos[0]);
            console.log('[Primary] Last video:', allVideos[allVideos.length - 1]);
          }
          
          // Filter by date period
          const now = new Date();
          const cutoffDate = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000));
          console.log('[Primary] Filtering videos from', cutoffDate.toISOString(), 'to', now.toISOString());
          
          const filteredVideos = allVideos.filter(video => {
            const publishedDate = new Date(video.publishedAt);
            const isInRange = publishedDate >= cutoffDate;
            if (!isInRange) {
              console.log(`[Primary] Filtering out video: "${video.title}" published at ${video.publishedAt} (${publishedDate.toISOString()})`);
            } else {
              console.log(`[Primary] Including video: "${video.title}" published at ${video.publishedAt}`);
            }
            return isInRange;
          });
          
          console.log('[Primary] Videos in last', selectedPeriod, 'days:', filteredVideos.length);
          
          // If RSS returned few or no videos, try HTML scraping as fallback
          let videos = [];
          if (filteredVideos.length === 0) {
            console.log('[Primary] RSS returned 0 videos in date range, trying HTML scraping fallback...');
            
            // Extract handle from the original URL if available
            const handleMatch = channelUrl.match(/@([a-zA-Z0-9_.-]+)/);
            const handle = handleMatch ? handleMatch[1] : undefined;
            
            try {
              const scrapedVideos = await scrapeVideosFromChannel(channelInfo.channel_id, handle);
              console.log('[Primary] HTML scraping returned', scrapedVideos.length, 'videos');
              
              // Filter scraped videos by date
              const scrapedFiltered = scrapedVideos.filter(video => {
                const publishedDate = new Date(video.publishedAt);
                const isInRange = publishedDate >= cutoffDate;
                if (isInRange) {
                  console.log(`[HTML Scrape] Including video: "${video.title}" published at ${video.publishedAt}`);
                }
                return isInRange;
              });
              
              console.log('[Primary] HTML scraping videos in date range:', scrapedFiltered.length);
              
              videos = scrapedFiltered.map(video => ({
                id: video.videoId,
                video_id: video.videoId,
                title: video.title,
                thumbnail_url: video.thumbnailUrl,
                published_at: video.publishedAt,
                youtube_url: `https://www.youtube.com/watch?v=${video.videoId}`,
                view_count: video.viewCount || null
              }));
            } catch (scrapeError) {
              console.log('[Primary] HTML scraping failed:', (scrapeError as Error).message);
            }
          } else {
            // Use RSS videos
            videos = filteredVideos.map(video => ({
              id: video.videoId,
              video_id: video.videoId,
              title: video.title,
              thumbnail_url: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
              published_at: video.publishedAt,
              youtube_url: video.link,
              view_count: null
            }));
          }
          
          const responseData = {
            channel_id: channelInfo.channel_id,
            channel_name: channelInfo.channel_name,
            channel_handle: channelInfo.channel_handle,
            channel_thumbnail: channelInfo.channel_thumbnail,
            channel_subscribers: channelInfo.channel_subscribers,
            videos_fetched: videos.length,
            videos: videos,
            rss_feed_url: rssUrl,
            days_period: selectedPeriod,
            resolution_method: channelInfo.resolution_method || 'scrape'
          };
          
          console.log('[Response] Sending back channel data:', {
            name: responseData.channel_name,
            id: responseData.channel_id,
            subscribers: responseData.channel_subscribers,
            videos: responseData.videos_fetched,
            method: responseData.resolution_method
          });
          
          return new Response(
            JSON.stringify(responseData),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } else {
          console.log('[Primary] RSS fetch failed with status:', rssResponse.status);
          
          // Try HTML scraping as fallback
          console.log('[Primary] Trying HTML scraping instead...');
          const handleMatch = channelUrl.match(/@([a-zA-Z0-9_.-]+)/);
          const handle = handleMatch ? handleMatch[1] : undefined;
          
          try {
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000));
            const scrapedVideos = await scrapeVideosFromChannel(channelInfo.channel_id, handle);
            
            const filteredScraped = scrapedVideos.filter(video => {
              const publishedDate = new Date(video.publishedAt);
              return publishedDate >= cutoffDate;
            });
            
            const videos = filteredScraped.map(video => ({
              id: video.videoId,
              video_id: video.videoId,
              title: video.title,
              thumbnail_url: video.thumbnailUrl,
              published_at: video.publishedAt,
              youtube_url: `https://www.youtube.com/watch?v=${video.videoId}`,
              view_count: video.viewCount || null
            }));
            
            console.log('[Primary] HTML scraping returned', videos.length, 'videos in date range');
            
            return new Response(
              JSON.stringify({
                channel_id: channelInfo.channel_id,
                channel_name: channelInfo.channel_name,
                channel_handle: channelInfo.channel_handle,
                channel_thumbnail: channelInfo.channel_thumbnail,
                channel_subscribers: channelInfo.channel_subscribers,
                videos_fetched: videos.length,
                videos: videos,
                rss_feed_url: rssUrl,
                days_period: selectedPeriod,
                resolution_method: 'html_scrape'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          } catch (scrapeError) {
            console.log('[Primary] HTML scraping also failed:', (scrapeError as Error).message);
            return new Response(
              JSON.stringify({
                channel_id: channelInfo.channel_id,
                channel_name: channelInfo.channel_name,
                channel_handle: channelInfo.channel_handle,
                channel_thumbnail: channelInfo.channel_thumbnail,
                channel_subscribers: channelInfo.channel_subscribers,
                videos_fetched: 0,
                videos: [],
                rss_feed_url: rssUrl,
                days_period: selectedPeriod,
                resolution_method: channelInfo.resolution_method || 'scrape',
                message: 'Channel found but video fetch failed'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      } catch (rssError) {
        console.log('[Primary] RSS error:', (rssError as Error).message);
        
        // Try HTML scraping as fallback before giving up
        console.log('[Primary] Trying HTML scraping as failover...');
        const handleMatch = channelUrl.match(/@([a-zA-Z0-9_.-]+)/);
        const handle = handleMatch ? handleMatch[1] : undefined;
        
        try {
          const now = new Date();
          const cutoffDate = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000));
          const scrapedVideos = await scrapeVideosFromChannel(channelInfo.channel_id, handle);
          
          const filteredScraped = scrapedVideos.filter(video => {
            const publishedDate = new Date(video.publishedAt);
            return publishedDate >= cutoffDate;
          });
          
          const videos = filteredScraped.map(video => ({
            id: video.videoId,
            video_id: video.videoId,
            title: video.title,
            thumbnail_url: video.thumbnailUrl,
            published_at: video.publishedAt,
            youtube_url: `https://www.youtube.com/watch?v=${video.videoId}`,
            view_count: video.viewCount || null
          }));
          
          console.log('[Primary] HTML scraping failover returned', videos.length, 'videos');
          
          return new Response(
            JSON.stringify({
              channel_id: channelInfo.channel_id,
              channel_name: channelInfo.channel_name,
              channel_handle: channelInfo.channel_handle,
              channel_thumbnail: channelInfo.channel_thumbnail,
              channel_subscribers: channelInfo.channel_subscribers,
              videos_fetched: videos.length,
              videos: videos,
              rss_feed_url: channelInfo.rss_feed_url,
              days_period: selectedPeriod,
              resolution_method: 'html_scrape'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } catch (htmlScrapeError) {
          console.log('[Primary] HTML scraping also failed:', (htmlScrapeError as Error).message);
          // Return channel info even if all video fetch methods fail
          return new Response(
            JSON.stringify({
              channel_id: channelInfo.channel_id,
              channel_name: channelInfo.channel_name,
              channel_handle: channelInfo.channel_handle,
              channel_thumbnail: channelInfo.channel_thumbnail,
              channel_subscribers: channelInfo.channel_subscribers,
              videos_fetched: 0,
              videos: [],
              rss_feed_url: channelInfo.rss_feed_url,
              days_period: selectedPeriod,
              resolution_method: channelInfo.resolution_method || 'scrape',
              message: 'Channel found but all video fetch methods failed'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }

    // ============================================
    // STEP 3: FALLBACK to YouTube API if scraping failed
    // ============================================
    console.log('[Fallback] Scraping failed, attempting YouTube API...');
    
    let channelId = '';
    
    if (channelUrl.includes('/channel/')) {
      channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0];
      console.log('[Fallback] Extracted channel ID from /channel/ URL:', channelId);
    } else if (channelUrl.includes('/@')) {
      // Handle custom URLs like youtube.com/@channelname
      const customName = channelUrl.split('/@')[1].split('/')[0].split('?')[0];
      console.log('[Fallback] Looking for custom channel name via API:', customName);
      
      try {
        const handleResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${customName}`
        );
        
        if (handleResponse.ok) {
          const handleData = await handleResponse.json() as { items?: Array<{ id: string; snippet: { title: string; customUrl?: string; thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } }; statistics: { subscriberCount?: string } }> };
          console.log('[Fallback] Handle API response items:', handleData.items?.length || 0);
          
          if (handleData.items && handleData.items.length > 0) {
            const channel = handleData.items[0];
            channelId = channel.id;
            
            const channelName = channel.snippet.title;
            const channelHandle = channel.snippet.customUrl || `@${customName}`;
            const channelThumbnail = channel.snippet.thumbnails?.high?.url || 
                                     channel.snippet.thumbnails?.medium?.url || 
                                     channel.snippet.thumbnails?.default?.url;
            const subscriberCount = parseInt(channel.statistics.subscriberCount || '0');
            
            console.log('[Fallback] Found channel via API:', channelName, 'ID:', channelId);
            
            // Fetch videos from RSS
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const rssResponse = await fetch(rssUrl);
            
            console.log('[Fallback] RSS fetch status:', rssResponse.status);
            let videos: any[] = [];
            if (rssResponse.ok) {
              const rssXml = await rssResponse.text();
              console.log('[Fallback] RSS response size:', rssXml.length, 'bytes');
              
              const allVideos = parseAtomFeed(rssXml);
              console.log('[Fallback] Total videos from RSS:', allVideos.length);
              
              const now = new Date();
              const cutoffDate = new Date(now.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000));
              
              const filteredVideos = allVideos.filter(video => {
                const publishedDate = new Date(video.publishedAt);
                return publishedDate >= cutoffDate;
              });
              
              console.log('[Fallback] Videos in period:', filteredVideos.length);
              
              videos = filteredVideos.map(video => ({
                id: video.videoId,
                video_id: video.videoId,
                title: video.title,
                thumbnail_url: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
                published_at: video.publishedAt,
                youtube_url: video.link,
                view_count: null
              }));
            }
            
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
                days_period: selectedPeriod,
                resolution_method: 'youtube_api'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        } else if (handleResponse.status === 403) {
          console.log('[Fallback] Handle API quota exceeded or forbidden');
          apiError = 'YouTube API quota exceeded. Please try again later.';
        } else {
          console.log('[Fallback] Handle API response not ok:', handleResponse.status);
          const errorText = await handleResponse.text().catch(() => 'Unknown error');
          console.log('[Fallback] Handle API error response:', errorText);
          apiError = `YouTube API error: ${handleResponse.status}`;
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.log('[Fallback] Handle API error:', errorMsg);
        apiError = errorMsg;
      }
    } else if (channelUrl.includes('/c/') || channelUrl.includes('/user/')) {
      // Handle legacy URLs - need to search
      const legacyName = channelUrl.includes('/c/') 
        ? channelUrl.split('/c/')[1].split('/')[0].split('?')[0]
        : channelUrl.split('/user/')[1].split('/')[0].split('?')[0];
      
      console.log('[Fallback] Looking for legacy channel name:', legacyName);
      
      try {
        const searchResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(legacyName)}&maxResults=5`
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json() as { items?: Array<{ id: { channelId?: string }; snippet: { channelId?: string } }> };
          if (searchData.items && searchData.items.length > 0) {
            channelId = searchData.items[0].id.channelId || searchData.items[0].snippet.channelId || '';
            console.log('[Fallback] Found legacy channel ID:', channelId);
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

    // If we couldn't find channel ID - return the API error if we have one
    if (apiError) {
      return new Response(
        JSON.stringify({ 
          error: apiError
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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
