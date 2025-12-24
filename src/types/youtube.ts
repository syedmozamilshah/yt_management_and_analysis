// Types for YouTube API responses and internal use

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  channelHandle: string;
  channelThumbnail: string;
  viewCount: string;
  publishedTime: string;
  subscriberCount?: string;
  description?: string;
}

export interface YouTubeVideoMetadata {
  video_id: string;
  title: string;
  channel_id: string;
  channel_url: string;
  uploader: string;
  uploader_id: string;
  uploader_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  upload_date: string;
  duration: number;
  description: string;
  thumbnails: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  tags: string[];
  categories: string[];
}

export interface ChannelInfo {
  id: string;
  name: string;
  handle: string;
  thumbnail: string;
  subscribers?: string;
  videoCount?: number;
  description?: string;
}

export interface SimilarChannelData {
  id: string;
  name: string;
  handle: string;
  thumbnail: string;
  subscribers: string;
  similarityScore: number;
  matchedVideos: number;
  matchedTitles: string[];
  description?: string;
}

export interface AnalysisResult {
  sourceChannel: ChannelInfo;
  similarChannels: SimilarChannelData[];
  totalVideosAnalyzed: number;
  totalSearchesPerformed: number;
}

export interface ChannelVideoMatch {
  channelId: string;
  channelName: string;
  channelHandle: string;
  channelThumbnail: string;
  matchCount: number;
  matchedTitles: string[];
  subscriberCount?: string;
  description?: string;
}
