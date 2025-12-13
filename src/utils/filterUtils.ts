import { Video } from '../types/video';

export interface FilterState {
  viralOnly: boolean;
  selectedNiches: string; // Changed from array to string to match select pattern
  channelSizeRange: string[];
  uploadTiming: string;
  viewRange: number[];
  subscriberRange: number[];
}

export const defaultFilters: FilterState = {
  viralOnly: false,
  selectedNiches: 'all', // Changed to string default
  channelSizeRange: [],
  uploadTiming: 'all',
  viewRange: [0, 10000000],
  subscriberRange: [0, 10000000]
};

export const channelSizeRanges = [
  { label: 'Micro (<10K)', value: 'micro', min: 0, max: 10000 },
  { label: 'Mid (10K-100K)', value: 'mid', min: 10000, max: 100000 },
  { label: 'Macro (100K+)', value: 'macro', min: 100000, max: Infinity }
];

// Keep the old viewRanges for reference but we'll use slider values instead
export const viewRanges = [
  { label: 'Under 1K', value: 'under-1k', min: 0, max: 1000 },
  { label: '1K-10K', value: '1k-10k', min: 1000, max: 10000 },
  { label: '10K-100K', value: '10k-100k', min: 10000, max: 100000 },
  { label: '100K-1M', value: '100k-1m', min: 100000, max: 1000000 },
  { label: '1M+', value: '1m-plus', min: 1000000, max: Infinity }
];

// Helper function to get min/max view counts from videos
export const getViewCountBounds = (videos: Video[]): { min: number; max: number } => {
  const viewCounts = videos
    .map(video => video.view_count)
    .filter((count): count is number => count !== null && count !== undefined);
  
  if (viewCounts.length === 0) {
    return { min: 0, max: 10000000 };
  }
  
  return {
    min: Math.min(...viewCounts),
    max: Math.max(...viewCounts)
  };
};

// Helper function to get min/max subscriber counts from videos
export const getSubscriberCountBounds = (videos: Video[]): { min: number; max: number } => {
  const subscriberCounts = videos
    .map(video => video.channel_subscribers)
    .filter((count): count is number => count !== null && count !== undefined);
  
  if (subscriberCounts.length === 0) {
    return { min: 0, max: 10000000 };
  }
  
  return {
    min: Math.min(...subscriberCounts),
    max: Math.max(...subscriberCounts)
  };
};

export const uploadTimingOptions = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 48 Hours', value: '48h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 28 Days', value: '28d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 60 Days', value: '60d' },
  { label: 'Last 90 Days', value: '90d' }
];

export const isViralVideo = (video: Video): boolean => {
  // Changed to use Views > Subscribers logic
  return !!(video.view_count && video.channel_subscribers && video.view_count > video.channel_subscribers);
};

export const getChannelSize = (subscribers: number | null): string => {
  if (!subscribers) return 'unknown';
  
  if (subscribers < 10000) return 'micro';
  if (subscribers < 100000) return 'mid';
  return 'macro';
};

export const getViewRange = (views: number | null): string => {
  if (!views) return 'unknown';
  
  if (views < 1000) return 'under-1k';
  if (views < 10000) return '1k-10k';
  if (views < 100000) return '10k-100k';
  if (views < 1000000) return '100k-1m';
  return '1m-plus';
};

export const isWithinTimeRange = (uploadDate: string | null, timeRange: string): boolean => {
  if (!uploadDate || timeRange === 'all') return true;
  
  const now = new Date();
  const videoDate = new Date(uploadDate);
  const diffMs = now.getTime() - videoDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  
  switch (timeRange) {
    case '24h': return diffHours <= 24;
    case '48h': return diffHours <= 48;
    case '7d': return diffDays <= 7;
    case '28d': return diffDays <= 28;
    case '30d': return diffDays <= 30;
    case '60d': return diffDays <= 60;
    case '90d': return diffDays <= 90;
    default: return true;
  }
};

export const applyFilters = (videos: Video[], filters: FilterState): Video[] => {
  return videos.filter(video => {
    // Viral filter
    if (filters.viralOnly && !isViralVideo(video)) {
      return false;
    }
    
    // Niche filter - now using string instead of array
    if (filters.selectedNiches !== 'all' && video.niche) {
      if (video.niche !== filters.selectedNiches) {
        return false;
      }
    }
    
    // Subscriber range filter (now using slider range instead of channel size categories)
    if (video.channel_subscribers !== null && video.channel_subscribers !== undefined && filters.subscriberRange) {
      const [minSubs, maxSubs] = filters.subscriberRange;
      if (video.channel_subscribers < minSubs || video.channel_subscribers > maxSubs) {
        return false;
      }
    }
    
    // View range filter (now using slider range)
    if (video.view_count !== null && video.view_count !== undefined && filters.viewRange) {
      const [minViews, maxViews] = filters.viewRange;
      if (video.view_count < minViews || video.view_count > maxViews) {
        return false;
      }
    }
    
    // Upload timing filter
    if (!isWithinTimeRange(video.upload_date, filters.uploadTiming)) {
      return false;
    }
    
    return true;
  });
};

export const getUniqueNiches = (videos: Video[]): string[] => {
  const niches = videos
    .map(video => video.niche)
    .filter((niche): niche is string => !!niche);
  
  return Array.from(new Set(niches)).sort();
};
