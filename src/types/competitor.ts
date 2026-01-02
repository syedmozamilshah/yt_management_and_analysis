// Type definitions for WebSub and Competitor tracking

export interface CompetitorChannel {
  id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  channel_subscribers: number | null;
  total_videos: number | null;
  rss_feed_url: string | null;
  webhook_subscribed: boolean;
  subscription_expires_at: string | null;
  last_webhook_delivery: string | null;
  subscription_status: 'inactive' | 'pending' | 'active' | 'failed';
  created_at: string;
}

export interface CompetitorVideo {
  id: string;
  user_id: string;
  channel_id: string;
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string | null;
  source: 'websub' | 'rss_polling' | 'manual';
  created_at: string;
}

export interface WebSubSubscription {
  id: string;
  user_id: string;
  channel_id: string;
  hub_lease_seconds: number;
  subscription_expires_at: string;
  last_renewal_at: string;
  renewal_status: 'active' | 'failed' | 'pending';
  last_renewal_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelResolution {
  channel_id: string;
  rss_feed_url: string;
}

export interface WebhookPayload {
  videos: {
    video_id: string;
    title: string;
    published_at: string;
    channel_id: string;
  }[];
}

export interface SubscriptionRenewalJob {
  status: string;
  renewed: number;
  failed: number;
  skipped: number;
}

export interface RSSPollingJob {
  status: string;
  polls_attempted: number;
  videos_found: number;
  videos_saved: number;
  skipped_inactive_users: number;
}
