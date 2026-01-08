/**
 * Quota-Free YouTube Channel Resolution
 * 
 * Resolves YouTube handles and URLs to channel IDs WITHOUT using the YouTube Data API.
 * Uses HTML scraping and RSS feed validation instead.
 * 
 * This saves 1-102 quota units per channel resolution:
 * - channels.list(forHandle) = 1 unit
 * - search.list fallback = 100 units
 * - channels.list for details = 1 unit
 */

export interface ChannelInfo {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  rss_feed_url: string;
  resolution_method: 'direct' | 'scrape' | 'rss_validation';
}

/**
 * Resolve channel ID from a YouTube URL or handle without using YouTube Data API
 * 
 * @param input - Can be: 
 *   - Channel URL: youtube.com/channel/UC...
 *   - Handle URL: youtube.com/@handle
 *   - Just handle: @handle or handle
 *   - Raw channel ID: UC...
 * @returns ChannelInfo or null if resolution fails
 */
export async function resolveChannelIdWithoutApi(input: string): Promise<ChannelInfo | null> {
  console.log('[Quota-Free] Resolving channel from input:', input);
  
  const trimmed = input.trim();
  
  // Case 1: Already a raw channel ID (UC followed by 22 characters)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    console.log('[Quota-Free] Input is already a channel ID');
    return await getChannelInfoFromRSS(trimmed);
  }
  
  // Case 2: Direct channel URL (youtube.com/channel/UC...)
  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelIdMatch) {
    console.log('[Quota-Free] Extracted channel ID from URL:', channelIdMatch[1]);
    return await getChannelInfoFromRSS(channelIdMatch[1]);
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
    console.log('[Quota-Free] Resolving handle via scraping:', handle);
    return await resolveHandleViaScraping(handle);
  }
  
  console.log('[Quota-Free] Could not parse input format');
  return null;
}

/**
 * Scrape the YouTube channel page to extract the channel ID
 * This is the main quota-free method for handle resolution
 */
async function resolveHandleViaScraping(handle: string): Promise<ChannelInfo | null> {
  try {
    console.log('[Quota-Free] Fetching channel page for handle:', handle);
    
    const response = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });
    
    if (!response.ok) {
      console.log('[Quota-Free] Channel page fetch failed:', response.status);
      return null;
    }
    
    const html = await response.text();
    
    // Try multiple patterns to extract channel ID from the page HTML
    const patterns = [
      /"channelId":"(UC[a-zA-Z0-9_-]{22})"/,
      /"externalId":"(UC[a-zA-Z0-9_-]{22})"/,
      /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
      /\\"channelId\\":\\"(UC[a-zA-Z0-9_-]{22})\\"/,
      /channel_id=(UC[a-zA-Z0-9_-]{22})/,
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})">/,
    ];
    
    let channelId: string | null = null;
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        channelId = match[1];
        console.log('[Quota-Free] Found channel ID via pattern:', channelId);
        break;
      }
    }
    
    if (!channelId) {
      console.log('[Quota-Free] Could not extract channel ID from page');
      return null;
    }
    
    // Extract additional info from the page
    const channelInfo = await getChannelInfoFromRSS(channelId);
    
    if (channelInfo) {
      // Try to extract more details from the scraped HTML
      const enhancedInfo = extractChannelDetailsFromHtml(html, channelInfo);
      enhancedInfo.channel_handle = `@${handle}`;
      enhancedInfo.resolution_method = 'scrape';
      return enhancedInfo;
    }
    
    return channelInfo;
    
  } catch (error) {
    console.error('[Quota-Free] Error scraping channel page:', error);
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
    // Try to extract channel name from multiple sources
    const namePatterns = [
      /"channelMetadataRenderer":\{"title":"([^"]+)"/,
      /"ownerChannelName":"([^"]+)"/,
      /<meta property="og:title" content="([^"]+)">/,
      /"name":"([^"]+)","url":"https:\/\/www\.youtube\.com\/@/,
    ];
    
    for (const pattern of namePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        result.channel_name = match[1];
        break;
      }
    }
    
    // Try to extract thumbnail
    const thumbnailPatterns = [
      /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
      /<meta property="og:image" content="([^"]+)">/,
      /"thumbnails":\[\{"url":"([^"]+)"[^}]*\}[^]]*"channelId"/,
    ];
    
    for (const pattern of thumbnailPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        result.channel_thumbnail = match[1].replace(/\\u0026/g, '&');
        break;
      }
    }
    
    // Try to extract subscriber count (approximate)
    const subCountPatterns = [
      /"subscriberCountText":\{"simpleText":"([^"]+) subscribers"\}/,
      /"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+) subscribers"\}/,
    ];
    
    for (const pattern of subCountPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        result.channel_subscribers = parseSubscriberCount(match[1]);
        break;
      }
    }
    
  } catch (error) {
    console.log('[Quota-Free] Error extracting details from HTML:', error);
  }
  
  return result;
}

/**
 * Parse subscriber count strings like "1.5M" or "500K" into numbers
 */
function parseSubscriberCount(countStr: string): number {
  const cleanStr = countStr.toLowerCase().replace(/,/g, '').trim();
  
  let multiplier = 1;
  let numStr = cleanStr;
  
  if (cleanStr.endsWith('k')) {
    multiplier = 1000;
    numStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('m')) {
    multiplier = 1000000;
    numStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('b')) {
    multiplier = 1000000000;
    numStr = cleanStr.slice(0, -1);
  }
  
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : Math.round(num * multiplier);
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
