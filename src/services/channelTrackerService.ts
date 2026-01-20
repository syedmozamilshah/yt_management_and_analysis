import { supabase } from '@/integrations/supabase/client';

export interface TrackedChannel {
  id: string;
  channel_id: string;
  channel_name: string | null;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number | null;
  rss_feed_url: string | null;
  webhook_subscribed: boolean;
  subscription_expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TrackedVideo {
  id: string;
  video_id: string;
  channel_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string;
  youtube_url: string | null;
  view_count: number | null;
  source: string;
  created_at: string;
}

export interface AnalyzedVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  youtube_url: string | null;
  view_count: number | null;
}

export interface AnalyzeChannelResponse {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  videos_fetched: number;
  videos: AnalyzedVideo[];
  rss_feed_url: string;
  days_period: number;
}

/**
 * Analyze a channel - fetches channel info and videos from RSS (minimal quota usage)
 * Only uses YouTube API for: 1) resolving handle to channel ID, 2) getting channel info
 * Videos are fetched from RSS (FREE!)
 */
export async function analyzeChannel(channelUrl: string, daysPeriod: number = 7): Promise<AnalyzeChannelResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-channel', {
    body: { channelUrl, daysPeriod }
  });

  if (error) {
    throw new Error(error.message || 'Failed to analyze channel');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Subscribe a channel to YouTube WebSub notifications
 */
export async function subscribeToWebhook(channelId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('subscribe-youtube-webhook', {
    body: { channel_id: channelId, mode: 'subscribe' }
  });

  if (error) {
    throw new Error(error.message || 'Failed to subscribe to webhook');
  }

  return data;
}

/**
 * Unsubscribe a channel from YouTube WebSub notifications
 */
export async function unsubscribeFromWebhook(channelId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('subscribe-youtube-webhook', {
    body: { channel_id: channelId, mode: 'unsubscribe' }
  });

  if (error) {
    throw new Error(error.message || 'Failed to unsubscribe from webhook');
  }

  return data;
}

/**
 * Get all tracked channels for the current user
 */
export async function getTrackedChannels(): Promise<TrackedChannel[]> {
  const { data, error } = await supabase
    .from('tracked_channels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to fetch tracked channels');
  }

  return data || [];
}

/**
 * Remove a tracked channel
 */
export async function removeTrackedChannel(channelId: string): Promise<void> {
  // First unsubscribe from webhook
  try {
    await unsubscribeFromWebhook(channelId);
  } catch (e) {
    console.warn('Failed to unsubscribe from webhook:', e);
  }

  const { error } = await supabase
    .from('tracked_channels')
    .delete()
    .eq('channel_id', channelId);

  if (error) {
    throw new Error(error.message || 'Failed to remove channel');
  }
}

/**
 * Get videos from tracked channels
 */
export async function getTrackedVideos(limit = 50): Promise<TrackedVideo[]> {
  const { data, error } = await supabase
    .from('tracked_videos')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || 'Failed to fetch tracked videos');
  }

  return data || [];
}

/**
 * Get videos for a specific channel
 */
export async function getChannelVideos(channelId: string, limit = 20): Promise<TrackedVideo[]> {
  const { data, error } = await supabase
    .from('tracked_videos')
    .select('*')
    .eq('channel_id', channelId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || 'Failed to fetch channel videos');
  }

  return data || [];
}

/**
 * Update user activity - call this when user opens the competitor tracker route
 */
export async function updateUserActivity(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  const { error } = await supabase
    .from('user_activity')
    .upsert({
      user_id: user.id,
      last_competitor_route_opened_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Failed to update user activity:', error);
  }
}

/**
 * Re-subscribe all user's channels (when user becomes active again after 72 hours)
 */
export async function resubscribeAllChannels(): Promise<{ success: number; failed: number }> {
  const channels = await getTrackedChannels();
  let success = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      await subscribeToWebhook(channel.channel_id);
      success++;
    } catch (e) {
      console.error(`Failed to resubscribe ${channel.channel_id}:`, e);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Add a new channel and subscribe to webhooks
 * Now uses analyzeChannel for initial setup (minimal quota)
 */
export async function addTrackedChannel(channelUrl: string, fetchDays: number = 7): Promise<AnalyzeChannelResponse> {
  // Use the new analyze-channel function that returns videos directly
  const result = await analyzeChannel(channelUrl, fetchDays);
  
  // Save channel to tracked_channels for future RSS polling
  try {
    await supabase
      .from('tracked_channels')
      .upsert({
        channel_id: result.channel_id,
        channel_name: result.channel_name,
        channel_handle: result.channel_handle,
        channel_thumbnail: result.channel_thumbnail,
        channel_subscribers: result.channel_subscribers,
        rss_feed_url: result.rss_feed_url,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'channel_id'
      });
  } catch (error) {
    console.warn('Failed to save tracked channel:', error);
  }
  
  // Subscribe to webhooks for real-time notifications
  try {
    await subscribeToWebhook(result.channel_id);
  } catch (error) {
    console.warn('Failed to subscribe to webhook:', error);
    // Don't fail the whole operation
  }
  
  return result;
}

/**
 * Fetch historical videos for a channel using RSS (NO quota cost!)
 */
export async function fetchChannelVideos(channelId: string, rssFeedUrl: string, days: number = 7): Promise<{ videos_inserted: number; videos_found: number }> {
  const { data, error } = await supabase.functions.invoke('fetch-channel-videos', {
    body: { channel_id: channelId, rss_feed_url: rssFeedUrl, days }
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch channel videos');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    videos_inserted: data.videos_inserted || 0,
    videos_found: data.videos_found || 0
  };
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffMins > 0) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else {
    return 'Just now';
  }
}
