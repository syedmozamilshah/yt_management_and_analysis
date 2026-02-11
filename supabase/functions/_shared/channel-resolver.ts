import { makeYouTubeApiRequest } from './youtube-api-keys.ts';

/**
 * YouTube Channel Resolution with API First Strategy
 * 
 * Primary Strategy: Uses YouTube Data API for accurate channel metadata (thumbnail, subscribers)
 * Fallback Strategy: If API fails/unavailable, uses HTML scraping and RSS feed validation
 * 
 * Debug: If getting wrong metadata, check if YouTube API keys are configured in Supabase secrets
 */

export interface ChannelInfo {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  rss_feed_url: string;
  resolution_method: 'youtube_api' | 'scrape' | 'rss_validation' | 'direct';
  debug_info?: {
    api_available: boolean;
    api_error?: string;
  };
}

/**
 * Try to get channel info via YouTube API first
 * Returns ChannelInfo if successful, null if API is unavailable/exhausted
 */
async function getChannelInfoFromYouTubeApi(channelIdOrHandle: string): Promise<ChannelInfo | null> {
  console.log('[API] ========== YOUTUBE API CALL START ==========');
  console.log('[API] Attempting to fetch channel via YouTube API...');
  console.log('[API] Channel identifier:', channelIdOrHandle);
  
  try {
    let apiUrl: string;
    let isHandle = false;

    // Check if it's a handle (starts with @ or doesn't match channel ID pattern)
    if (channelIdOrHandle.startsWith('@')) {
      isHandle = true;
      const handleName = channelIdOrHandle.substring(1);
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${encodeURIComponent(handleName)}`;
      console.log('[API] Detected HANDLE format:', handleName);
    } else if (/^UC[a-zA-Z0-9_-]{22}$/.test(channelIdOrHandle)) {
      // It's a channel ID
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?id=${channelIdOrHandle}&part=snippet,statistics`;
      console.log('[API] Detected CHANNEL_ID format');
    } else {
      // Try as handle without @
      isHandle = true;
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${encodeURIComponent(channelIdOrHandle)}`;
      console.log('[API] Treating as HANDLE (unformatted):', channelIdOrHandle);
    }

    console.log('[API] URL (without key):', apiUrl);
    
    let response;
    try {
      response = await makeYouTubeApiRequest(apiUrl);
    } catch (apiError) {
      console.error('[API] ❌ makeYouTubeApiRequest threw error:', apiError instanceof Error ? apiError.message : String(apiError));
      console.log('[API] This likely means: YouTube API keys are not configured in Supabase secrets');
      console.log('[API] Solution: Add YOUTUBE_API_KEY to your Supabase project settings');
      return null;
    }

    console.log('[API] Response status:', response.status);

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorText = 'Unknown error';
      try {
        if (contentType?.includes('application/json')) {
          const json = await response.json();
          errorText = JSON.stringify(json);
        } else {
          errorText = await response.text();
        }
      } catch (e) {
        errorText = 'Could not parse error response';
      }
      
      console.error('[API] ❌ HTTP Error:', response.status);
      console.error('[API] Error response:', errorText.substring(0, 500));
      
      if (response.status === 403) {
        console.error('[API] 403 Forbidden - Check if API keys have quota remaining');
      } else if (response.status === 401) {
        console.error('[API] 401 Unauthorized - API key may be invalid');
      }
      
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[API] ❌ Failed to parse JSON response:', parseError instanceof Error ? parseError.message : String(parseError));
      return null;
    }

    console.log('[API] Response data received');
    console.log('[API] Number of items:', data.items?.length || 0);

    if (!data.items || data.items.length === 0) {
      console.warn('[API] ⚠️ No channel found via API');
      console.warn('[API] Full response:', JSON.stringify(data).substring(0, 300));
      return null;
    }

    const channel = data.items[0];
    const channelId = channel.id;
    const channelName = channel.snippet?.title || 'Unknown Channel';
    const channelHandle = channel.snippet?.customUrl || null;
    const channelThumbnail = channel.snippet?.thumbnails?.default?.url || 
                            channel.snippet?.thumbnails?.medium?.url || 
                            null;
    const subscriberCount = channel.statistics?.subscriberCount;
    const channelSubscribers = subscriberCount ? parseInt(subscriberCount, 10) : 0;
    const rssFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    console.log('[API] ✅ SUCCESS! Channel fetched via YouTube API:');
    console.log('[API]   Name:', channelName);
    console.log('[API]   Subscribers:', channelSubscribers?.toLocaleString() || 'Hidden');
    console.log('[API]   Has Thumbnail:', !!channelThumbnail);
    console.log('[API]   Channel ID:', channelId);
    console.log('[API] ========== YOUTUBE API CALL END ==========');

    return {
      channel_id: channelId,
      channel_name: channelName,
      channel_handle: channelHandle,
      channel_thumbnail: channelThumbnail,
      channel_subscribers: channelSubscribers,
      rss_feed_url: rssFeedUrl,
      resolution_method: 'youtube_api',
      debug_info: {
        api_available: true
      }
    };

  } catch (error) {
    console.error('[API] ❌ Unexpected error during API call:');
    console.error('[API] Error type:', error instanceof Error ? error.name : typeof error);
    console.error('[API] Error message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 5);
      console.error('[API] Stack (truncated):', stackLines.join('\n'));
    }
    console.log('[API] ========== YOUTUBE API CALL END (ERROR) ==========');
    return null;
  }
}

/**
 * Resolve channel ID from a YouTube URL or handle
 * 
 * @param input - Can be: 
 *   - Channel URL: youtube.com/channel/UC...
 *   - Handle URL: youtube.com/@handle
 *   - Just handle: @handle or handle
 *   - Raw channel ID: UC...
 * @returns ChannelInfo or null if resolution fails
 */
export async function resolveChannelIdWithoutApi(input: string): Promise<ChannelInfo | null> {
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         CHANNEL RESOLUTION STARTING                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('Input:', input);
  
  const trimmed = input.trim();
  
  // Case 1: Already a raw channel ID (UC followed by 22 characters)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    console.log('Detected: Raw Channel ID');
    // Try API first for accurate metadata
    console.log('\n→ Attempting YouTube API...');
    const apiResult = await getChannelInfoFromYouTubeApi(trimmed);
    if (apiResult) {
      console.log('✅ Resolution method: YouTube API (ACCURATE DATA)\n');
      return apiResult;
    }
    // Fall back to RSS
    console.log('⚠️  API failed. Falling back to RSS feed...');
    return await getChannelInfoFromRSS(trimmed);
  }
  
  // Case 2: Direct channel URL (youtube.com/channel/UC...)
  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelIdMatch) {
    const channelId = channelIdMatch[1];
    console.log('Detected: Direct Channel URL');
    console.log('Extracted ID:', channelId);
    // Try API first for accurate metadata
    console.log('\n→ Attempting YouTube API...');
    const apiResult = await getChannelInfoFromYouTubeApi(channelId);
    if (apiResult) {
      console.log('✅ Resolution method: YouTube API (ACCURATE DATA)\n');
      return apiResult;
    }
    // Fall back to RSS
    console.log('⚠️  API failed. Falling back to RSS feed...');
    return await getChannelInfoFromRSS(channelId);
  }
  
  // Case 3: Handle URL (youtube.com/@handle) or just @handle
  let handle: string | null = null;
  
  const handleUrlMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/);
  if (handleUrlMatch) {
    handle = handleUrlMatch[1];
  } else if (trimmed.startsWith('@')) {
    handle = trimmed.substring(1).split('/')[0].split('?')[0];
  } else {
    // Try to extract handle from various URL formats
    const cleanedInput = trimmed
      .replace(/^https?:\/\//, '')
      .replace('www.', '')
      .replace('youtube.com/', '');
    
    if (cleanedInput && !cleanedInput.includes('/')) {
      handle = cleanedInput;
    }
  }
  
  if (handle) {
    console.log('Detected: Handle or Handle URL');
    console.log('Handle:', handle);
    // Try API first for accurate metadata
    console.log('\n→ Attempting YouTube API...');
    const apiResult = await getChannelInfoFromYouTubeApi(`@${handle}`);
    if (apiResult) {
      console.log('✅ Resolution method: YouTube API (ACCURATE DATA)\n');
      return apiResult;
    }
    // Fall back to scraping
    console.log('⚠️  API failed. Falling back to HTML scraping...');
    return await resolveHandleViaScraping(handle);
  }
  
  console.log('❌ Could not parse input format');
  return null;
}

async function resolveHandleViaScraping(handle: string): Promise<ChannelInfo | null> {
  try {
    console.log('[Quota-Free] HANDLE RESOLUTION: Fetching channel page for handle:', handle);
    
    const response = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });
    
    if (!response.ok) {
      console.log('[Quota-Free] Handle page fetch failed:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('[Quota-Free] Handle page HTML size:', html.length, 'bytes');
    
    // ✅ STEP 1: Extract ONLY the <head> section (no body contamination)
    console.log('[Quota-Free] STEP 1: Extracting <head> section...');
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    
    if (!headMatch || !headMatch[1]) {
      console.log('[Quota-Free] Could not find <head> section');
      return null;
    }
    
    const headHtml = headMatch[1];
    console.log('[Quota-Free] Head section extracted, size:', headHtml.length, 'bytes');
    
    // ✅ STEP 2: Extract the canonical channel ID ONLY from head
    // This is 100% reliable - canonical link in <head> ALWAYS points to correct channel
    console.log('[Quota-Free] STEP 2: Extracting canonical channel ID from <head>...');
    const canonicalMatch = headHtml.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
    
    if (!canonicalMatch || !canonicalMatch[1]) {
      console.log('[Quota-Free] Could not find canonical link in <head>');
      return null;
    }
    
    const channelId = canonicalMatch[1];
    console.log('[Quota-Free] ✅ Found correct channel ID from canonical link:', channelId);
    
    // ✅ STEP 3: Fetch MAIN channel page using the correct channel ID
    // This ensures we get ONLY main channel data, no suggestion contamination
    console.log('[Quota-Free] STEP 3: Fetching main channel page from /channel/ID...');
    const channelPageUrl = `https://www.youtube.com/channel/${channelId}`;
    
    const channelResponse = await fetch(channelPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!channelResponse.ok) {
      console.log('[Quota-Free] Main channel page fetch failed:', channelResponse.status);
      return null;
    }
    
    const channelHtml = await channelResponse.text();
    console.log('[Quota-Free] Main channel page HTML size:', channelHtml.length, 'bytes');
    
    // ✅ STEP 4: Extract information from the MAIN channel page
    console.log('[Quota-Free] STEP 4: Extracting channel metadata...');
    
    // Get channel info from RSS first to validate channel exists
    let channelInfo = await getChannelInfoFromRSS(channelId);
    
    if (channelInfo) {
      channelInfo.channel_handle = `@${handle}`;
      channelInfo.resolution_method = 'scrape';
      
      // Now enhance with subscriber count from the main channel page
      const enhancedInfo = extractChannelDetailsFromHtml(channelHtml, channelInfo);
      console.log('[Quota-Free] ✅ RESOLVED HANDLE SUCCESSFULLY:', {
        name: enhancedInfo.channel_name,
        handle: `@${handle}`,
        id: enhancedInfo.channel_id,
        subs: enhancedInfo.channel_subscribers
      });
      return enhancedInfo;
    }
    
    console.log('[Quota-Free] Failed to get channel info from RSS for ID:', channelId);
    return null;
    
  } catch (error) {
    console.error('[Quota-Free] Error scraping handle page:', error);
    return null;
  }
}

/**
 * Get channel info from RSS feed (validates channel exists and gets title)
 */
async function getChannelInfoFromRSS(channelId: string): Promise<ChannelInfo | null> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    console.log('[Quota-Free] Fetching RSS feed:', rssUrl);
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideoStashBot/1.0)',
      }
    });
    
    if (!response.ok) {
      console.log('[Quota-Free] RSS feed fetch failed:', response.status);
      return null;
    }
    
    const xmlText = await response.text();
    
    // Extract channel title from feed
    const titleMatch = xmlText.match(/<title>([^<]+)<\/title>/);
    const channelTitle = titleMatch 
      ? titleMatch[1].replace(/\s*-\s*YouTube$/, '').trim() 
      : 'Unknown Channel';
    
    // Try to extract channel thumbnail from feed author
    let thumbnailUrl: string | null = null;
    const thumbnailMatch = xmlText.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    if (thumbnailMatch) {
      thumbnailUrl = thumbnailMatch[1];
    }
    
    console.log('[Quota-Free] Channel resolved via RSS:', channelTitle);
    
    return {
      channel_id: channelId,
      channel_name: channelTitle,
      channel_handle: null,
      channel_thumbnail: thumbnailUrl,
      channel_subscribers: 0, // Not available from RSS
      rss_feed_url: rssUrl,
      resolution_method: 'rss_validation'
    };
    
  } catch (error) {
    console.error('[Quota-Free] Error fetching RSS feed:', error);
    return null;
  }
}

/**
 * Extract additional channel details from the scraped HTML
 */
function extractChannelDetailsFromHtml(html: string, baseInfo: ChannelInfo): ChannelInfo {
  const result = { ...baseInfo };
  
  try {
    console.log('[Quota-Free] Extracting channel details from HTML...');
    
    // PROPER METHOD: Parse ytInitialData JSON instead of regex on HTML
    const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    
    if (ytInitialDataMatch && ytInitialDataMatch[1]) {
      try {
        const data = JSON.parse(ytInitialDataMatch[1]);
        console.log('[Quota-Free] Successfully parsed ytInitialData JSON');
        
        // Extract from c4TabbedHeaderRenderer (main header - has the correct channel info)
        const header = data?.header?.c4TabbedHeaderRenderer;
        
        // Debug: Log header structure to understand what's available
        if (header) {
          console.log('[Quota-Free] Header found. Keys:', Object.keys(header).join(', '));
          if (header.subscriberCountText) {
            console.log('[Quota-Free] subscriberCountText structure:', JSON.stringify(header.subscriberCountText).substring(0, 200));
          }
        } else {
          console.log('[Quota-Free] No c4TabbedHeaderRenderer header found');
          // Try alternative header paths
          const pageHeader = data?.header?.pageHeaderRenderer;
          if (pageHeader) {
            console.log('[Quota-Free] Found pageHeaderRenderer instead');
          }
        }
        
        // Get channel name
        const nameFromHeader = header?.title;
        if (nameFromHeader) {
          result.channel_name = nameFromHeader;
          console.log('[Quota-Free] Channel name from header:', nameFromHeader);
        }
        
        // Get subscriber count - try multiple paths as YouTube changes structure
        let subsFromHeader = header?.subscriberCountText?.simpleText;
        
        // Alternative path 1: accessibilityData
        if (!subsFromHeader) {
          subsFromHeader = header?.subscriberCountText?.accessibility?.accessibilityData?.label;
        }
        
        // Alternative path 2: runs array
        if (!subsFromHeader && header?.subscriberCountText?.runs) {
          subsFromHeader = header.subscriberCountText.runs.map((r: any) => r.text).join('');
        }
        
        // Alternative path 3: Look in metadata
        if (!subsFromHeader) {
          const metadata = data?.metadata?.channelMetadataRenderer;
          if (metadata?.subscriberCountText) {
            subsFromHeader = metadata.subscriberCountText;
          }
        }
        
        if (subsFromHeader) {
          console.log('[Quota-Free] Subscriber count from header structure:', subsFromHeader);
          result.channel_subscribers = parseSubscriberCount(subsFromHeader);
          console.log('[Quota-Free] Parsed subscriber count:', result.channel_subscribers);
        } else {
          console.log('[Quota-Free] subscriberCountText not found in any header path');
        }
        
        // Extract thumbnail - prioritize avatar from header
        const avatarThumbnails = header?.avatar?.thumbnails;
        if (avatarThumbnails && avatarThumbnails.length > 0) {
          const bestThumb = avatarThumbnails[avatarThumbnails.length - 1];
          result.channel_thumbnail = bestThumb.url?.replace(/\\u0026/g, '&');
          console.log('[Quota-Free] Extracted avatar thumbnail from header');
        }
        
        // If no avatar in header, look for it in metadata
        if (!result.channel_thumbnail) {
          // Try to find avatar in metadata section
          const metadata = data?.metadata?.channelMetadataRenderer;
          if (metadata?.avatar?.thumbnails) {
            const avatars = metadata.avatar.thumbnails;
            result.channel_thumbnail = avatars[avatars.length - 1]?.url?.replace(/\\u0026/g, '&');
            console.log('[Quota-Free] Extracted avatar from metadata');
          }
        }
        
        // Try microformat as another source
        if (!result.channel_thumbnail) {
          const microformat = data?.microformat?.microformatDataRenderer;
          if (microformat?.thumbnail?.thumbnails) {
            const thumbs = microformat.thumbnail.thumbnails;
            // Only use if it looks like an avatar (yt3.ggpht.com domain)
            const avatarThumb = thumbs.find((t: any) => t.url?.includes('yt3.ggpht.com'));
            if (avatarThumb) {
              result.channel_thumbnail = avatarThumb.url;
              console.log('[Quota-Free] Extracted avatar from microformat');
            }
          }
        }
        
        // If subscriber count is still 0, search the entire parsed JSON for it
        if (result.channel_subscribers === 0) {
          console.log('[Quota-Free] Subscriber count not found in header, searching JSON...');
          const jsonStr = JSON.stringify(data);
          
          // Look for "subscribers" text patterns in the JSON
          const subscriberMatches = jsonStr.match(/(\d+\.?\d*[KMB]?)\s+subscribers/gi);
          if (subscriberMatches && subscriberMatches.length > 0) {
            console.log('[Quota-Free] Found subscriber patterns in JSON:', subscriberMatches);
            
            // Parse ALL matches and pick the LARGEST one (main channel will have most subscribers)
            let largestCount = 0;
            let largestMatch = subscriberMatches[0];
            
            for (const match of subscriberMatches) {
              const count = parseSubscriberCount(match);
              console.log('[Quota-Free] Parsed match:', match, '→', count);
              if (count > largestCount) {
                largestCount = count;
                largestMatch = match;
              }
            }
            
            console.log('[Quota-Free] Selected LARGEST subscriber count:', largestMatch, '→', largestCount);
            result.channel_subscribers = largestCount;
          }
        }
        
      } catch (jsonError) {
        console.log('[Quota-Free] Failed to parse ytInitialData JSON:', (jsonError as Error).message);
      }
    } else {
      console.log('[Quota-Free] Could not find ytInitialData in HTML');
    }
    
    // Fallback: If JSON parsing failed or didn't find data, use regex
    if (!result.channel_name || result.channel_subscribers === 0) {
      console.log('[Quota-Free] Using regex fallback...');
      
      // Try to extract channel name via meta tags
      if (!result.channel_name) {
        const metaTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        if (metaTitleMatch && metaTitleMatch[1]) {
          result.channel_name = metaTitleMatch[1];
          console.log('[Quota-Free] Channel name from og:title:', result.channel_name);
        }
      }
      
      // Try to extract subscriber count from HTML regex
      if (result.channel_subscribers === 0) {
        // Look for patterns like "100K subscribers" or "5.43M subscribers"
        const subPattern = html.match(/['"<](\d+\.?\d*)\s*([KMB]?)\s+subscribers?['">]/i);
        if (subPattern && subPattern[1]) {
          const numStr = subPattern[1] + (subPattern[2] || '');
          console.log('[Quota-Free] Found subscriber pattern via regex:', numStr);
          result.channel_subscribers = parseSubscriberCount(numStr);
        }
      }
      
      // Try to extract thumbnail - only use channel avatar URLs (yt3.ggpht.com), not video thumbnails
      if (!result.channel_thumbnail) {
        const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
        if (thumbMatch && thumbMatch[1]) {
          const thumbUrl = thumbMatch[1];
          // Only use if it's a channel avatar URL, not a video thumbnail
          if (thumbUrl.includes('yt3.ggpht.com') || thumbUrl.includes('yt3.googleusercontent.com')) {
            result.channel_thumbnail = thumbUrl;
            console.log('[Quota-Free] Extracted avatar via og:image');
          } else {
            console.log('[Quota-Free] Skipping og:image as it looks like video thumbnail:', thumbUrl.substring(0, 50));
          }
        }
      }
      
      // Last resort: try to get avatar from link tags
      if (!result.channel_thumbnail) {
        const avatarLinkMatch = html.match(/https:\/\/yt3\.ggpht\.com\/[a-zA-Z0-9_-]+=[^"'\s]+/);
        if (avatarLinkMatch) {
          result.channel_thumbnail = avatarLinkMatch[0];
          console.log('[Quota-Free] Extracted avatar via regex pattern');
        }
      }
    }
    
    console.log('[Quota-Free] Final extraction result:', {
      name: result.channel_name,
      subs: result.channel_subscribers,
      hasThumb: !!result.channel_thumbnail
    });
    
  } catch (error) {
    console.log('[Quota-Free] Error extracting details from HTML:', error);
  }
  
  return result;
}

/**
 * Parse subscriber count strings like "1.5M", "500K", "4.52 thousand" into numbers
 */
function parseSubscriberCount(countStr: string): number {
  console.log('[Quota-Free] parseSubscriberCount input:', countStr);
  
  // Remove extra whitespace and normalize
  const cleanStr = countStr.toLowerCase()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/,/g, '')     // Remove commas
    .trim();
  
  console.log('[Quota-Free] parseSubscriberCount cleaned:', cleanStr);
  
  let multiplier = 1;
  let numStr = cleanStr;
  
  // Check for written-out number words first
  if (cleanStr.includes('billion')) {
    multiplier = 1000000000;
    numStr = cleanStr.replace(/\s*billion\s*/i, '').trim();
  } else if (cleanStr.includes('million')) {
    multiplier = 1000000;
    numStr = cleanStr.replace(/\s*million\s*/i, '').trim();
  } else if (cleanStr.includes('thousand')) {
    multiplier = 1000;
    numStr = cleanStr.replace(/\s*thousand\s*/i, '').trim();
  } else if (cleanStr.endsWith('b')) {
    multiplier = 1000000000;
    numStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('m')) {
    multiplier = 1000000;
    numStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('k')) {
    multiplier = 1000;
    numStr = cleanStr.slice(0, -1);
  } else if (cleanStr.includes('subscriber')) {
    // Extract number before "subscriber"
    const match = cleanStr.match(/([0-9.]+)\s*([a-z]*)\s*subscriber/i);
    if (match && match[1]) {
      numStr = match[1];
      const suffix = (match[2] || '').toLowerCase().trim();
      
      if (suffix.includes('billion') || suffix === 'b') {
        multiplier = 1000000000;
      } else if (suffix.includes('million') || suffix === 'm') {
        multiplier = 1000000;
      } else if (suffix.includes('thousand') || suffix === 'k') {
        multiplier = 1000;
      }
    }
  }
  
  // Extract just the numeric part in case there's still text attached
  const numMatch = numStr.match(/([0-9.]+)/);
  const finalNum = numMatch ? parseFloat(numMatch[1]) : parseFloat(numStr);
  const result = isNaN(finalNum) ? 0 : Math.round(finalNum * multiplier);
  
  console.log('[Quota-Free] parseSubscriberCount result:', result, '(num:', finalNum, 'multiplier:', multiplier, ')');
  return result;
}

/**
 * Scrape videos from a channel's /videos page HTML
 * Returns video data when RSS feed is stale or empty
 */
export interface ScrapedVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
}

export async function scrapeVideosFromChannel(channelId: string, handle?: string): Promise<ScrapedVideo[]> {
  console.log('[HTML Scrape] Fetching videos from channel:', channelId, 'handle:', handle);
  
  const videos: ScrapedVideo[] = [];
  
  try {
    // Fetch the /videos tab directly for the most up-to-date list
    const url = handle 
      ? `https://www.youtube.com/@${handle}/videos`
      : `https://www.youtube.com/channel/${channelId}/videos`;
    
    console.log('[HTML Scrape] Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!response.ok) {
      console.log('[HTML Scrape] Failed to fetch videos page:', response.status);
      return videos;
    }
    
    const html = await response.text();
    console.log('[HTML Scrape] Videos page HTML size:', html.length);
    
    // Look for video data in the ytInitialData JSON
    const jsonMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!jsonMatch) {
      console.log('[HTML Scrape] Could not find ytInitialData');
      
      // Fallback: try to extract video IDs and titles from the HTML directly
      const videoMatches = html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"/g);
      let count = 0;
      for (const match of videoMatches) {
        if (count >= 30) break; // Limit to 30 videos
        videos.push({
          videoId: match[1],
          title: match[2],
          publishedAt: new Date().toISOString(), // Approximate
          thumbnailUrl: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`,
        });
        count++;
      }
      console.log('[HTML Scrape] Extracted', videos.length, 'videos via fallback regex');
      return videos;
    }
    
    // Parse the ytInitialData JSON
    try {
      const data = JSON.parse(jsonMatch[1]);
      
      // Navigate to video contents
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      console.log('[HTML Scrape] Found', tabs.length, 'tabs');
      
      for (const tab of tabs) {
        const tabContent = tab?.tabRenderer?.content;
        if (!tabContent) continue;
        
        // Look for richGridRenderer which contains videos
        const gridRenderer = tabContent?.richGridRenderer;
        if (!gridRenderer) continue;
        
        const contents = gridRenderer?.contents || [];
        console.log('[HTML Scrape] Found', contents.length, 'grid items');
        
        for (const item of contents) {
          const richItem = item?.richItemRenderer?.content?.videoRenderer;
          if (!richItem) continue;
          
          const videoId = richItem.videoId;
          if (!videoId) continue;
          
          // Extract title
          const title = richItem.title?.runs?.[0]?.text || 
                       richItem.title?.simpleText || 
                       'Unknown Title';
          
          // Extract published time (e.g., "1 day ago")
          const publishedTimeText = richItem.publishedTimeText?.simpleText || '';
          const publishedAt = parseRelativeTime(publishedTimeText);
          
          // Extract view count
          let viewCount = 0;
          const viewCountText = richItem.viewCountText?.simpleText || richItem.viewCountText?.runs?.[0]?.text || '';
          const viewMatch = viewCountText.match(/([0-9,.]+)/);
          if (viewMatch) {
            viewCount = parseInt(viewMatch[1].replace(/,/g, ''), 10) || 0;
          }
          
          videos.push({
            videoId,
            title,
            publishedAt,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            viewCount,
          });
        }
      }
      
      console.log('[HTML Scrape] Extracted', videos.length, 'videos from ytInitialData');
      
    } catch (parseError) {
      console.log('[HTML Scrape] Failed to parse ytInitialData:', parseError);
    }
    
  } catch (error) {
    console.log('[HTML Scrape] Error scraping videos:', error);
  }
  
  return videos;
}

/**
 * Parse relative time strings like "1 day ago", "3 weeks ago" into ISO date strings
 */
function parseRelativeTime(timeText: string): string {
  const now = new Date();
  const text = timeText.toLowerCase();
  
  // Match patterns like "1 day ago", "3 weeks ago", "2 months ago"
  const match = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (!match) {
    // If we can't parse, assume it's recent (today)
    return now.toISOString();
  }
  
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'second':
      now.setSeconds(now.getSeconds() - amount);
      break;
    case 'minute':
      now.setMinutes(now.getMinutes() - amount);
      break;
    case 'hour':
      now.setHours(now.getHours() - amount);
      break;
    case 'day':
      now.setDate(now.getDate() - amount);
      break;
    case 'week':
      now.setDate(now.getDate() - (amount * 7));
      break;
    case 'month':
      now.setMonth(now.getMonth() - amount);
      break;
    case 'year':
      now.setFullYear(now.getFullYear() - amount);
      break;
  }
  
  return now.toISOString();
}

/**
 * Check if we should use the quota-free method
 * Returns true if we have a handle or URL that can be resolved without API
 */
export function canResolveWithoutApi(input: string): boolean {
  const trimmed = input.trim();
  
  // Can resolve: raw channel ID, channel URL, handle URL, @handle
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) return true;
  if (trimmed.includes('/channel/UC')) return true;
  if (trimmed.includes('/@') || trimmed.startsWith('@')) return true;
  
  return false;
}
