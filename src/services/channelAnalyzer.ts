import {
  searchYouTube,
  searchChannel,
  extractChannelIdentifier,
  getVideoMetadata,
} from "./youtubeApi";
import {
  ChannelInfo,
  SimilarChannelData,
  AnalysisResult,
  ChannelVideoMatch,
  YouTubeSearchResult,
} from "@/types/youtube";

export type ProgressCallback = (
  step: string,
  progress: number,
  message: string
) => void;

/**
 * Analyze a YouTube channel and find similar channels
 */
export async function analyzeChannel(
  channelInput: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const progressUpdate = (step: string, progress: number, message: string) => {
    onProgress?.(step, progress, message);
  };

  // Step 1: Extract channel identifier
  progressUpdate("extract", 0, "Extracting channel information...");
  const channelIdentifier = extractChannelIdentifier(channelInput);
  console.log("Channel identifier:", channelIdentifier);

  // Step 2: Find the channel and get its info
  progressUpdate("extract", 50, "Finding channel details...");

  let sourceChannel: ChannelInfo | null = null;

  // If it's a video URL, get channel info from video metadata
  if (channelIdentifier.type === "videoId") {
    console.log("Detected video URL, fetching video metadata to get channel info...");
    sourceChannel = await getChannelFromVideo(channelIdentifier.value);
  } else {
    sourceChannel = await findChannel(channelIdentifier.value);
  }

  if (!sourceChannel) {
    throw new Error("Could not find the specified channel. Please check the URL or handle.");
  }

  progressUpdate("extract", 100, "Channel found!");

  // Step 3: Fetch recent videos from the channel
  progressUpdate("fetch", 0, "Fetching recent videos...");
  const channelVideos = await fetchChannelRecentVideos(
    sourceChannel.name,
    sourceChannel.handle,
    sourceChannel.id,
    (progress) => progressUpdate("fetch", progress, `Fetching videos... ${progress}%`)
  );

  if (channelVideos.length === 0) {
    throw new Error("No videos found for this channel. Please try another channel.");
  }

  progressUpdate("fetch", 100, `Found ${channelVideos.length} recent videos`);

  // Step 4: Search for similar content using video titles
  progressUpdate("search", 0, "Searching for similar content...");
  const channelMatches = await searchSimilarContent(
    channelVideos,
    sourceChannel.id,
    (progress, message) => progressUpdate("search", progress, message)
  );

  // Step 5: Calculate similarity scores
  progressUpdate("analyze", 0, "Processing results...");

  // Small delay to show the processing step
  await delay(100);

  const similarChannels = calculateSimilarityScores(
    channelMatches,
    channelVideos.length
  );
  progressUpdate("analyze", 100, "Analysis complete!");

  // Step 6: Prepare results - Add source channel as #1 with 100% similarity
  progressUpdate("results", 0, "Finalizing...");

  // Small delay to show the finalizing step
  await delay(100);

  // Create source channel entry with 100% similarity
  const sourceChannelEntry: SimilarChannelData = {
    id: sourceChannel.id,
    name: sourceChannel.name,
    handle: sourceChannel.handle,
    thumbnail: sourceChannel.thumbnail || generatePlaceholderThumbnail(sourceChannel.name),
    subscribers: sourceChannel.subscribers || "",
    description: sourceChannel.description || "",
    similarityScore: 100,
    matchedVideos: channelVideos.length,
    matchedTitles: channelVideos.map(v => v.title),
  };

  // Combine source channel with similar channels (source first)
  const allChannels = [sourceChannelEntry, ...similarChannels.slice(0, 9)]; // Source + top 9 similar
  progressUpdate("results", 100, "Results ready!");

  return {
    sourceChannel,
    similarChannels: allChannels,
    totalVideosAnalyzed: channelVideos.length,
    totalSearchesPerformed: channelVideos.length,
  };
}

/**
 * Find a channel by handle, ID, or name
 */
async function findChannel(query: string): Promise<ChannelInfo | null> {
  try {
    // Clean the query
    const cleanQuery = query.replace("@", "").trim();

    // First, try searching for the channel directly
    const searchQuery = `@${cleanQuery}`;
    console.log("Searching for channel:", searchQuery);

    const results = await searchChannel(searchQuery);
    console.log("Channel search results:", results.length);

    if (results.length > 0) {
      const channelInfo = extractChannelInfoFromResult(results[0]);
      if (channelInfo.id || channelInfo.name) {
        return channelInfo;
      }
    }

    // Fallback: Search for videos from this channel and extract channel info
    console.log("Trying video search fallback...");
    const videoResults = await searchYouTube(searchQuery, {
      type: "video",
      sortBy: "relevance",
    });

    if (videoResults.length > 0) {
      // Find a video that matches the channel handle
      const matchingVideo = videoResults.find((video) => {
        const videoHandle = video.channelHandle.toLowerCase().replace("@", "");
        return videoHandle === cleanQuery.toLowerCase();
      });

      if (matchingVideo) {
        return {
          id: matchingVideo.channelId,
          name: matchingVideo.channelName,
          handle: matchingVideo.channelHandle,
          thumbnail: matchingVideo.channelThumbnail,
        };
      }

      // If no exact match, use the first result's channel
      const firstVideo = videoResults[0];
      if (firstVideo.channelId) {
        return {
          id: firstVideo.channelId,
          name: firstVideo.channelName,
          handle: firstVideo.channelHandle || `@${cleanQuery}`,
          thumbnail: firstVideo.channelThumbnail,
        };
      }
    }

    // Last resort: search without @ prefix
    const fallbackResults = await searchChannel(cleanQuery);
    if (fallbackResults.length > 0) {
      return extractChannelInfoFromResult(fallbackResults[0]);
    }

    return null;
  } catch (error) {
    console.error("Error finding channel:", error);
    return null;
  }
}

/**
 * Extract channel info from a search result
 */
function extractChannelInfoFromResult(result: any): ChannelInfo {
  return {
    id: result.channelId || "",
    name: result.channelName || result.title || "",
    handle: result.channelHandle || "",
    thumbnail: result.channelThumbnail || "",
    subscribers: result.subscriberCount || "",
    description: result.description || "",
  };
}

/**
 * Get channel info from a video ID using the metadata endpoint
 */
async function getChannelFromVideo(videoId: string): Promise<ChannelInfo | null> {
  try {
    console.log(`Fetching metadata for video: ${videoId}`);
    const metadata = await getVideoMetadata(videoId);

    if (!metadata) {
      console.error("Could not fetch video metadata");
      return null;
    }

    console.log("Video metadata:", {
      title: metadata.title,
      channel: metadata.uploader,
      channelId: metadata.channel_id,
      channelUrl: metadata.channel_url,
      uploaderId: metadata.uploader_id,
    });

    // Extract channel info from video metadata
    const channelInfo: ChannelInfo = {
      id: metadata.channel_id || "",
      name: metadata.uploader || "",
      handle: metadata.uploader_id || "", // This is usually @handle
      thumbnail: "", // Video metadata doesn't include channel thumbnail
      subscribers: "",
      description: "",
    };

    // If we have a channel ID, try to get more details via channel search
    if (channelInfo.name) {
      console.log(`Found channel from video: ${channelInfo.name} (${channelInfo.handle})`);

      // Try to get channel thumbnail and more details
      const channelDetails = await findChannel(channelInfo.handle || channelInfo.name);
      if (channelDetails) {
        channelInfo.thumbnail = channelDetails.thumbnail || channelInfo.thumbnail;
        channelInfo.subscribers = channelDetails.subscribers || channelInfo.subscribers;
        channelInfo.description = channelDetails.description || channelInfo.description;
      }
    }

    return channelInfo.id || channelInfo.name ? channelInfo : null;
  } catch (error) {
    console.error("Error getting channel from video:", error);
    return null;
  }
}

/**
 * Fetch videos from a channel
 * Since ScrapingBee YouTube API doesn't have a direct "get channel videos" endpoint,
 * we try multiple search strategies to find videos from the channel
 */
async function fetchChannelRecentVideos(
  channelName: string,
  channelHandle: string,
  channelId: string,
  onProgress?: (progress: number) => void
): Promise<YouTubeSearchResult[]> {
  const handle = channelHandle.startsWith("@") ? channelHandle : `@${channelHandle}`;
  const normalizedHandle = handle.toLowerCase().replace("@", "");
  const normalizedChannelId = channelId;

  // Helper function to filter videos by channel - match by ID primarily
  const filterByChannel = (videos: YouTubeSearchResult[]) => {
    return videos.filter((video) => {
      // Match by channel ID (most reliable)
      if (normalizedChannelId && video.channelId === normalizedChannelId) {
        console.log(`✓ Matched video by channel ID: "${video.title.substring(0, 40)}..."`);
        return true;
      }

      // Match by handle
      const videoHandle = video.channelHandle.toLowerCase().replace("@", "").replace("/", "");
      if (videoHandle === normalizedHandle) {
        console.log(`✓ Matched video by handle: "${video.title.substring(0, 40)}..."`);
        return true;
      }

      return false;
    });
  };

  try {
    onProgress?.(10);

    const channelVideos: YouTubeSearchResult[] = [];
    const existingIds = new Set<string>();

    // Strategy 1: Search with exact channel name in quotes
    console.log(`\n🔹 Strategy 1: Searching with quoted name: "${channelName}"`);
    const quotedResults = await searchYouTube(`"${channelName}"`, {
      type: "video",
      sortBy: "upload_date",
    });
    console.log(`   Found ${quotedResults.length} total results`);

    const quotedVideos = filterByChannel(quotedResults);
    console.log(`   Matched ${quotedVideos.length} videos from target channel`);

    for (const video of quotedVideos) {
      if (!existingIds.has(video.videoId)) {
        channelVideos.push(video);
        existingIds.add(video.videoId);
      }
    }

    onProgress?.(30);

    // Strategy 2: Search with channel handle
    if (channelVideos.length < 5) {
      console.log(`\n🔹 Strategy 2: Searching with handle: ${handle}`);
      const handleResults = await searchYouTube(handle, {
        type: "video",
        sortBy: "upload_date",
      });
      console.log(`   Found ${handleResults.length} total results`);

      const handleVideos = filterByChannel(handleResults);
      console.log(`   Matched ${handleVideos.length} videos from target channel`);

      for (const video of handleVideos) {
        if (!existingIds.has(video.videoId)) {
          channelVideos.push(video);
          existingIds.add(video.videoId);
        }
      }
    }

    onProgress?.(50);

    // Strategy 3: Search with just channel name
    if (channelVideos.length < 5) {
      console.log(`\n🔹 Strategy 3: Searching with name: ${channelName}`);
      const nameResults = await searchYouTube(channelName, {
        type: "video",
        sortBy: "upload_date",
      });
      console.log(`   Found ${nameResults.length} total results`);

      const nameVideos = filterByChannel(nameResults);
      console.log(`   Matched ${nameVideos.length} videos from target channel`);

      for (const video of nameVideos) {
        if (!existingIds.has(video.videoId)) {
          channelVideos.push(video);
          existingIds.add(video.videoId);
        }
      }
    }

    onProgress?.(70);

    // Strategy 4: Search by popular views
    if (channelVideos.length < 3) {
      console.log(`\n🔹 Strategy 4: Searching by view count: ${channelName}`);
      const viewResults = await searchYouTube(channelName, {
        type: "video",
        sortBy: "view_count",
      });
      console.log(`   Found ${viewResults.length} total results`);

      const viewVideos = filterByChannel(viewResults);
      console.log(`   Matched ${viewVideos.length} videos from target channel`);

      for (const video of viewVideos) {
        if (!existingIds.has(video.videoId)) {
          channelVideos.push(video);
          existingIds.add(video.videoId);
        }
      }
    }

    onProgress?.(85);

    // Strategy 5: If still no videos, try with topic keywords based on channel name
    if (channelVideos.length < 3) {
      // Extract potential topic keywords from channel name
      const keywords = channelName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const keyword of keywords.slice(0, 2)) {
        if (channelVideos.length >= 3) break;
        
        console.log(`\n🔹 Strategy 5: Searching with keyword: ${keyword}`);
        const keywordResults = await searchYouTube(keyword, {
          type: "video",
          sortBy: "relevance",
        });
        console.log(`   Found ${keywordResults.length} total results`);

        const keywordVideos = filterByChannel(keywordResults);
        console.log(`   Matched ${keywordVideos.length} videos from target channel`);

        for (const video of keywordVideos) {
          if (!existingIds.has(video.videoId)) {
            channelVideos.push(video);
            existingIds.add(video.videoId);
          }
        }
      }
    }

    onProgress?.(100);

    console.log(`\n✅ Total videos found for channel "${channelName}": ${channelVideos.length}`);

    // Limit to 10 videos to manage API costs
    return channelVideos.slice(0, 10);
  } catch (error) {
    console.error("Error fetching channel videos:", error);
    throw error;
  }
}

/**
 * Search for similar content by searching for each video title
 */
async function searchSimilarContent(
  videos: YouTubeSearchResult[],
  sourceChannelId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Map<string, ChannelVideoMatch>> {
  const channelMatches = new Map<string, ChannelVideoMatch>();

  // Limit to first 5 videos to manage API costs (5 credits per search)
  const videosToSearch = videos.slice(0, 5);
  console.log(`Searching similar content for ${videosToSearch.length} videos`);

  for (let i = 0; i < videosToSearch.length; i++) {
    const video = videosToSearch[i];
    const progress = Math.round(((i + 1) / videosToSearch.length) * 100);
    onProgress?.(progress, `Searching similar content...`);

    try {
      // Search YouTube for videos with similar titles
      const searchResults = await searchYouTube(video.title, {
        type: "video",
        sortBy: "relevance",
      });

      console.log(`Search for "${video.title.substring(0, 30)}..." returned ${searchResults.length} results`);

      // Process results and accumulate channel matches
      for (const result of searchResults) {
        // Skip the source channel and results without channel info
        if (
          result.channelId === sourceChannelId ||
          !result.channelId ||
          !result.channelName
        ) {
          continue;
        }

        const existingMatch = channelMatches.get(result.channelId);
        if (existingMatch) {
          existingMatch.matchCount++;
          if (!existingMatch.matchedTitles.includes(video.title)) {
            existingMatch.matchedTitles.push(video.title);
          }
        } else {
          channelMatches.set(result.channelId, {
            channelId: result.channelId,
            channelName: result.channelName,
            channelHandle: result.channelHandle,
            channelThumbnail: result.channelThumbnail,
            matchCount: 1,
            matchedTitles: [video.title],
          });
        }
      }

      // Add a small delay between searches to be respectful to the API
      if (i < videosToSearch.length - 1) {
        await delay(300);
      }
    } catch (error) {
      console.error(`Error searching for video title: ${video.title}`, error);
      // Continue with other videos even if one fails
    }
  }

  console.log(`Found ${channelMatches.size} similar channels`);
  return channelMatches;
}

/**
 * Calculate similarity scores for matched channels
 */
function calculateSimilarityScores(
  channelMatches: Map<string, ChannelVideoMatch>,
  totalVideosSearched: number
): SimilarChannelData[] {
  const channels: SimilarChannelData[] = [];

  for (const [channelId, match] of channelMatches) {
    // Calculate similarity score based on:
    // 1. Number of matched videos (how often this channel appears in similar searches)
    // 2. The uniqueness of the matches (different video titles matched)

    const matchFrequency = match.matchCount;
    const uniqueMatches = match.matchedTitles.length;

    // Base score: percentage of searches where this channel appeared
    const baseScore = (uniqueMatches / totalVideosSearched) * 100;

    // Bonus for frequency (same channel appearing multiple times per search)
    const frequencyBonus = Math.min((matchFrequency / uniqueMatches - 1) * 10, 20);

    // Final score (capped at 100)
    const similarityScore = Math.min(Math.round(baseScore + frequencyBonus), 100);

    // Only include channels with meaningful similarity
    if (similarityScore >= 10 || uniqueMatches >= 2) {
      channels.push({
        id: channelId,
        name: match.channelName,
        handle: match.channelHandle || `@${match.channelName.toLowerCase().replace(/\s+/g, "")}`,
        thumbnail: match.channelThumbnail || generatePlaceholderThumbnail(match.channelName),
        subscribers: "N/A", // Would need additional API call to get this
        similarityScore,
        matchedVideos: uniqueMatches,
        matchedTitles: match.matchedTitles,
      });
    }
  }

  // Sort by similarity score (descending)
  channels.sort((a, b) => b.similarityScore - a.similarityScore);

  return channels;
}

/**
 * Generate a placeholder thumbnail URL if none available
 */
function generatePlaceholderThumbnail(channelName: string): string {
  const initials = channelName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Use a placeholder service or return empty string
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&size=176`;
}

/**
 * Utility delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate if the input looks like a valid YouTube channel reference
 */
export function isValidChannelInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Check for @ handle
  if (trimmed.startsWith("@") && trimmed.length > 1) return true;

  // Check for YouTube URLs
  if (
    trimmed.includes("youtube.com") ||
    trimmed.includes("youtu.be")
  ) {
    return true;
  }

  // Check for channel ID pattern
  if (trimmed.startsWith("UC") && trimmed.length >= 20) return true;

  // Allow plain text channel names (at least 2 characters)
  return trimmed.length >= 2;
}
