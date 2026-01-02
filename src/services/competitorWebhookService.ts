import { supabase } from "@/integrations/supabase";

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "";

/**
 * Resolve YouTube channel ID from URL or handle
 */
export async function resolveChannelId(channelInput: string): Promise<{
  channel_id: string;
  rss_feed_url: string;
}> {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/resolve-channel-id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel_input: channelInput }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to resolve channel");
  }

  return await response.json();
}

/**
 * Subscribe to YouTube WebSub notifications for a channel
 */
export async function subscribeToYouTubeWebhook(
  channelId: string,
  userId: string
): Promise<{
  status: string;
  message: string;
  expiresAt?: string;
}> {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/subscribe-youtube-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
    body: JSON.stringify({ channel_id: channelId, user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to subscribe to webhook");
  }

  return await response.json();
}

/**
 * Get competitor videos for current user
 */
export async function getCompetitorVideos(limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from("user_competitor_videos")
    .select("*")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update user's competitor route activity
 */
export async function updateCompetitorRouteActivity(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // This is handled by a trigger on user_competitor_channels insertion
  // But we can also update it directly if needed through a custom function
  // For now, this is a placeholder that can be extended
}

/**
 * Get user's subscribed competitor channels
 */
export async function getSubscribedChannels() {
  const { data, error } = await supabase
    .from("user_competitor_channels")
    .select(
      `
      id,
      channel_id,
      channel_name,
      rss_feed_url,
      webhook_subscribed,
      subscription_expires_at,
      last_webhook_delivery,
      subscription_status
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get videos for a specific competitor channel
 */
export async function getChannelVideos(channelId: string, limit = 20) {
  const { data, error } = await supabase
    .from("user_competitor_videos")
    .select("*")
    .eq("channel_id", channelId)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Count videos for a channel
 */
export async function getChannelVideoCount(channelId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_competitor_videos")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", channelId);

  if (error) {
    console.error("Error counting videos:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get latest videos across all competitor channels
 */
export async function getLatestCompetitorVideos(limit = 20) {
  const { data, error } = await supabase
    .from("user_competitor_videos")
    .select(
      `
      id,
      channel_id,
      video_id,
      title,
      published_at,
      thumbnail_url,
      source,
      created_at,
      user_competitor_channels:channel_id(channel_name)
    `
    )
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Subscribe to real-time competitor videos using Supabase RealtimeChannel
 */
export function subscribeToCompetitorVideos(
  onInsert: (payload: any) => void
): {
  unsubscribe: () => Promise<string>;
} {
  const channel = supabase
    .channel("public:user_competitor_videos")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_competitor_videos" }, onInsert)
    .subscribe();

  return {
    unsubscribe: () => channel.unsubscribe(),
  };
}
