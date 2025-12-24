import { YouTubeSearchResult, YouTubeVideoMetadata } from "@/types/youtube";

const API_KEY = import.meta.env.VITE_SCRAPINGBEE_API_KEY;

// Use proxy in development to avoid CORS, direct URL in production
const getBaseUrl = () => {
  if (import.meta.env.DEV) {
    return "/api/scrapingbee/youtube";
  }
  return "https://app.scrapingbee.com/api/v1/youtube";
};

/**
 * Search YouTube videos using ScrapingBee API
 */
export async function searchYouTube(
  query: string,
  options: {
    uploadDate?: "today" | "last_hour" | "this_week" | "this_month" | "this_year";
    type?: "video" | "channel" | "playlist" | "movie";
    sortBy?: "rating" | "relevance" | "view_count" | "upload_date";
  } = {}
): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    search: query,
    type: options.type || "video",
    sort_by: options.sortBy || "relevance",
  });

  if (options.uploadDate) {
    params.append("upload_date", options.uploadDate);
  }

  const baseUrl = getBaseUrl();
  console.log(`Fetching: ${baseUrl}/search with query: ${query}`);

  try {
    const response = await fetch(`${baseUrl}/search?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`YouTube search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Video search raw response:", JSON.stringify(data).substring(0, 1000));
    return parseSearchResults(data.results || []);
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

/**
 * Get video metadata using ScrapingBee API
 */
export async function getVideoMetadata(videoId: string): Promise<YouTubeVideoMetadata | null> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    video_id: videoId,
  });

  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/metadata?${params.toString()}`);

    if (!response.ok) {
      console.error(`Failed to get metadata for video ${videoId}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching metadata for video ${videoId}:`, error);
    return null;
  }
}

/**
 * Search for a channel by name or handle
 */
export async function searchChannel(
  channelNameOrHandle: string
): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    search: channelNameOrHandle,
    type: "channel",
  });

  const baseUrl = getBaseUrl();
  console.log(`Fetching channel: ${baseUrl}/search with query: ${channelNameOrHandle}`);

  try {
    const response = await fetch(`${baseUrl}/search?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`Channel search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Channel search raw response:", JSON.stringify(data).substring(0, 1000));

    // Handle different response formats
    const results = data.results || data.items || [];
    return parseSearchResults(results);
  } catch (error) {
    console.error("Channel search error:", error);
    throw error;
  }
}

/**
 * Get videos from a specific channel (by searching channel videos)
 */
export async function getChannelVideos(
  channelHandle: string,
  options: {
    uploadDate?: "today" | "last_hour" | "this_week" | "this_month" | "this_year";
    maxResults?: number;
  } = {}
): Promise<YouTubeSearchResult[]> {
  // Search for videos from this channel using the channel handle in search
  const searchQuery = channelHandle.startsWith("@") ? channelHandle : `@${channelHandle}`;

  const params = new URLSearchParams({
    api_key: API_KEY,
    search: searchQuery,
    type: "video",
    sort_by: "upload_date",
  });

  if (options.uploadDate) {
    params.append("upload_date", options.uploadDate);
  }

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Channel videos search failed: ${response.statusText}`);
  }

  const data = await response.json();
  const results = parseSearchResults(data.results || []);

  // Filter to only include videos from the target channel
  const normalizedHandle = channelHandle.toLowerCase().replace("@", "");
  const filteredResults = results.filter(
    (video) => video.channelHandle.toLowerCase().replace("@", "") === normalizedHandle
  );

  return options.maxResults ? filteredResults.slice(0, options.maxResults) : filteredResults;
}

/**
 * Parse raw YouTube search results into structured format
 */
function parseSearchResults(results: any): YouTubeSearchResult[] {
  // Ensure results is an array
  if (!results || !Array.isArray(results)) {
    console.warn("parseSearchResults received non-array:", typeof results);
    return [];
  }

  return results
    .filter((item) => {
      // Allow video results (have videoId) or channel results (have channelId/browseId)
      const hasVideoId = item.videoId || item.navigationEndpoint?.watchEndpoint?.videoId;
      const hasChannelId = item.channelId ||
                          item.navigationEndpoint?.browseEndpoint?.browseId ||
                          item.subscriberCountText;
      return item && (hasVideoId || hasChannelId);
    })
    .map((item) => {
      // Extract video ID (may be empty for channel results)
      const videoId = item.videoId || item.navigationEndpoint?.watchEndpoint?.videoId || "";

      // Extract title
      const title = extractTitle(item);

      // Extract channel info - for channel search results, the item IS the channel
      const channelInfo = extractChannelInfo(item);

      // For channel results, override with direct channel data
      if (!videoId && (item.channelId || item.navigationEndpoint?.browseEndpoint?.browseId)) {
        const browseEndpoint = item.navigationEndpoint?.browseEndpoint;
        channelInfo.channelId = item.channelId || browseEndpoint?.browseId || channelInfo.channelId;
        channelInfo.channelHandle = (browseEndpoint?.canonicalBaseUrl || channelInfo.channelHandle).replace(/^\//, "");
        channelInfo.channelName = title || channelInfo.channelName;

        // Get thumbnail from channel-specific locations - try multiple sources
        const thumbnailSources = [
          item.thumbnail?.thumbnails,
          item.avatar?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources,
          item.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails,
        ];

        for (const thumbnails of thumbnailSources) {
          if (thumbnails && thumbnails.length > 0) {
            // Prefer larger thumbnails
            const sortedThumbnails = [...thumbnails].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
            channelInfo.channelThumbnail = sortedThumbnails[0]?.url || "";
            if (channelInfo.channelThumbnail) break;
          }
        }
      }

      // Extract view count
      const viewCount = item.viewCountText?.simpleText ||
                       item.shortViewCountText?.simpleText ||
                       item.videoCountText?.simpleText ||
                       "0 views";

      // Extract published time
      const publishedTime = item.publishedTimeText?.simpleText || "";

      // Extract subscriber count (for channel results)
      const subscriberCount = item.subscriberCountText?.simpleText ||
                             item.subscriberCountText?.accessibility?.accessibilityData?.label ||
                             "";

      // Extract description snippet
      const description = extractDescription(item);

      // Debug log for video results
      if (videoId) {
        console.log(`   🎬 Video: "${title.substring(0, 35)}..." | Channel: ${channelInfo.channelName} | Handle: ${channelInfo.channelHandle} | ID: ${channelInfo.channelId}`);
      }

      return {
        videoId,
        title,
        channelId: channelInfo.channelId,
        channelName: channelInfo.channelName,
        channelHandle: channelInfo.channelHandle,
        channelThumbnail: channelInfo.channelThumbnail,
        viewCount,
        publishedTime,
        subscriberCount,
        description,
      };
    });
}

/**
 * Extract description from various possible locations
 */
function extractDescription(item: any): string {
  // Try detailedMetadataSnippets
  if (item.detailedMetadataSnippets?.[0]?.snippetText?.runs) {
    return item.detailedMetadataSnippets[0].snippetText.runs
      .map((run: any) => run.text)
      .join("");
  }

  // Try descriptionSnippet
  if (item.descriptionSnippet?.runs) {
    return item.descriptionSnippet.runs.map((run: any) => run.text).join("");
  }
  
  return "";
}

/**
 * Extract title from various possible locations in the response
 */
function extractTitle(item: any): string {
  if (item.title?.runs?.[0]?.text) {
    return item.title.runs[0].text;
  }
  if (item.title?.simpleText) {
    return item.title.simpleText;
  }
  if (item.headline?.runs?.[0]?.text) {
    return item.headline.runs[0].text;
  }
  return "";
}

/**
 * Extract channel information from various possible locations
 */
function extractChannelInfo(item: any): {
  channelId: string;
  channelName: string;
  channelHandle: string;
  channelThumbnail: string;
} {
  let channelId = "";
  let channelName = "";
  let channelHandle = "";
  let channelThumbnail = "";

  // Try to get from longBylineText
  if (item.longBylineText?.runs?.[0]) {
    const run = item.longBylineText.runs[0];
    channelName = run.text || "";
    const endpoint = run.navigationEndpoint?.browseEndpoint;
    if (endpoint) {
      channelId = endpoint.browseId || "";
      channelHandle = endpoint.canonicalBaseUrl || "";
    }
  }

  // Try to get from ownerText
  if (!channelName && item.ownerText?.runs?.[0]) {
    const run = item.ownerText.runs[0];
    channelName = run.text || "";
    const endpoint = run.navigationEndpoint?.browseEndpoint;
    if (endpoint) {
      channelId = channelId || endpoint.browseId || "";
      channelHandle = channelHandle || endpoint.canonicalBaseUrl || "";
    }
  }

  // Try to get from shortBylineText
  if (!channelName && item.shortBylineText?.runs?.[0]) {
    const run = item.shortBylineText.runs[0];
    channelName = run.text || "";
    const endpoint = run.navigationEndpoint?.browseEndpoint;
    if (endpoint) {
      channelId = channelId || endpoint.browseId || "";
      channelHandle = channelHandle || endpoint.canonicalBaseUrl || "";
    }
  }

  // Try to get from avatar's nested browse endpoint (new YouTube format)
  if (!channelId) {
    const avatarEndpoint = item.avatar?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint;
    if (avatarEndpoint) {
      channelId = avatarEndpoint.browseId || "";
      channelHandle = channelHandle || avatarEndpoint.canonicalBaseUrl || "";
    }
  }

  // Try to get channel name from channelTitleText or title
  if (!channelName) {
    channelName = item.channelTitleText?.simpleText ||
                  item.channelTitle ||
                  item.title?.simpleText ||
                  item.title?.runs?.[0]?.text ||
                  "";
  }

  // Get channel thumbnail
  const thumbnailRenderers = [
    item.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails,
    item.channelThumbnail?.thumbnails,
    item.avatar?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources,
  ];

  for (const thumbnails of thumbnailRenderers) {
    if (thumbnails && thumbnails.length > 0) {
      channelThumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || "";
      break;
    }
  }

  return {
    channelId,
    channelName,
    channelHandle: channelHandle.replace(/^\//, ""), // Remove leading slash from canonicalBaseUrl
    channelThumbnail,
  };
}

/**
 * Format subscriber count (e.g., "1.5M subscribers" -> "1.5M")
 */
export function formatSubscriberCount(count: string): string {
  if (!count) return "N/A";
  return count.replace(/\s*subscribers?/i, "").trim();
}

/**
 * Extract channel ID from various URL formats
 */
export function extractChannelIdentifier(input: string): {
  type: "handle" | "channelId" | "customUrl" | "videoId" | "unknown";
  value: string;
} {
  const trimmedInput = input.trim();

  // Handle @username format
  if (trimmedInput.startsWith("@")) {
    // Remove any trailing paths like /videos, /playlists, etc.
    const cleanHandle = trimmedInput.split("/")[0];
    return { type: "handle", value: cleanHandle };
  }

  // Handle full YouTube URLs
  try {
    const url = new URL(trimmedInput);
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    // Handle video URL: /watch?v=VIDEO_ID or youtu.be/VIDEO_ID
    if (pathname === "/watch" && searchParams.has("v")) {
      const videoId = searchParams.get("v") || "";
      return { type: "videoId", value: videoId };
    }

    // Handle youtu.be short URLs
    if (url.hostname === "youtu.be" && pathname.length > 1) {
      const videoId = pathname.slice(1).split("/")[0].split("?")[0];
      return { type: "videoId", value: videoId };
    }

    // Handle /shorts/VIDEO_ID format
    if (pathname.startsWith("/shorts/")) {
      const videoId = pathname.replace("/shorts/", "").split("/")[0];
      return { type: "videoId", value: videoId };
    }

    // Handle /@username format (may include /videos, /playlists, etc.)
    if (pathname.startsWith("/@")) {
      // Extract just the handle part, removing any trailing paths
      const pathParts = pathname.slice(1).split("/"); // Remove leading / and split
      const handle = pathParts[0]; // Get just @username
      return { type: "handle", value: handle };
    }

    // Handle /channel/CHANNEL_ID format (may include /videos, /playlists, etc.)
    if (pathname.startsWith("/channel/")) {
      const channelPath = pathname.replace("/channel/", "");
      const channelId = channelPath.split("/")[0]; // Get just the channel ID
      return { type: "channelId", value: channelId };
    }

    // Handle /c/customname or /user/username format
    if (pathname.startsWith("/c/") || pathname.startsWith("/user/")) {
      const customPath = pathname.replace(/^\/(c|user)\//, "");
      const customName = customPath.split("/")[0]; // Get just the custom name
      return { type: "customUrl", value: customName };
    }

    // Handle just /username (old format)
    if (pathname.length > 1 && !pathname.includes("/", 1)) {
      return { type: "customUrl", value: pathname.slice(1) };
    }
  } catch {
    // Not a valid URL, might be just a channel name or handle
    // Check if it looks like a channel ID (starts with UC and is 24 chars)
    if (trimmedInput.startsWith("UC") && trimmedInput.length === 24) {
      return { type: "channelId", value: trimmedInput };
    }

    // Otherwise, treat as a custom name/handle
    return { type: "customUrl", value: trimmedInput };
  }

  return { type: "unknown", value: trimmedInput };
}
