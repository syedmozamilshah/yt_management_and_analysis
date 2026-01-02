// Example usage of the WebSub competitor tracking system

import {
  resolveChannelId,
  subscribeToYouTubeWebhook,
  getLatestCompetitorVideos,
  getSubscribedChannels,
  getChannelVideos,
  subscribeToCompetitorVideos,
} from '@/services/competitorWebhookService';

// ============================================================================
// EXAMPLE 1: Subscribe to a New Competitor Channel
// ============================================================================

async function subscribeToCompetitor() {
  try {
    const channelInput = '@TechGuruDaily'; // Can be URL or @handle
    const userId = 'user-uuid-here';

    // Step 1: Resolve channel ID from input
    const { channel_id, rss_feed_url } = await resolveChannelId(channelInput);
    console.log(`Resolved channel ID: ${channel_id}`);
    console.log(`RSS feed URL: ${rss_feed_url}`);

    // Step 2: Subscribe to WebSub
    const subscription = await subscribeToYouTubeWebhook(channel_id, userId);
    console.log(`Subscription status: ${subscription.status}`);
    console.log(`Expires at: ${subscription.expiresAt}`);

    // Hub will send a verification request
    // Your webhook endpoint (/webhooks/youtube) will handle it
  } catch (error) {
    console.error('Failed to subscribe:', error);
  }
}

// ============================================================================
// EXAMPLE 2: Fetch Latest Videos Across All Subscribed Channels
// ============================================================================

async function displayLatestVideos() {
  try {
    // Get up to 50 latest videos across all channels (sorted by newest)
    const videos = await getLatestCompetitorVideos(50);

    console.log(`Found ${videos.length} recent videos:`);

    videos.forEach((video) => {
      console.log(`
        Title: ${video.title}
        Video ID: ${video.video_id}
        Channel: ${video.user_competitor_channels?.[0]?.channel_name}
        Published: ${video.published_at}
        Source: ${video.source} (websub | rss_polling)
        YouTube: https://www.youtube.com/watch?v=${video.video_id}
      `);
    });
  } catch (error) {
    console.error('Failed to fetch videos:', error);
  }
}

// ============================================================================
// EXAMPLE 3: Get Subscribed Channels with Status
// ============================================================================

async function showSubscribedChannels() {
  try {
    const channels = await getSubscribedChannels();

    console.log(`You are subscribed to ${channels.length} channels:\n`);

    channels.forEach((channel) => {
      const status = channel.subscription_status;
      const statusEmoji =
        status === 'active'
          ? '✅'
          : status === 'pending'
            ? '⏳'
            : status === 'failed'
              ? '❌'
              : '⭕';

      console.log(`
        ${statusEmoji} ${channel.channel_name}
        Channel ID: ${channel.channel_id}
        Status: ${status}
        Expires: ${channel.subscription_expires_at ? new Date(channel.subscription_expires_at).toLocaleDateString() : 'N/A'}
        Last Delivery: ${channel.last_webhook_delivery ? new Date(channel.last_webhook_delivery).toLocaleString() : 'Pending'}
      `);
    });
  } catch (error) {
    console.error('Failed to fetch channels:', error);
  }
}

// ============================================================================
// EXAMPLE 4: Get Videos for Specific Channel
// ============================================================================

async function getChannelHistory(channelId: string, limit: number = 20) {
  try {
    const videos = await getChannelVideos(channelId, limit);

    console.log(`Found ${videos.length} videos for channel ${channelId}:`);

    videos.forEach((video, index) => {
      console.log(`
        ${index + 1}. ${video.title}
        Views: TBD (would need separate API call)
        Published: ${video.published_at}
        Source: ${video.source}
      `);
    });
  } catch (error) {
    console.error('Failed to fetch channel videos:', error);
  }
}

// ============================================================================
// EXAMPLE 5: Real-time Subscription to New Videos
// ============================================================================

function setupRealtimeUpdates() {
  console.log('Setting up real-time video notifications...');

  const subscription = subscribeToCompetitorVideos((payload) => {
    console.log('🎉 New video received!');
    console.log(`Video ID: ${payload.new.video_id}`);
    console.log(`Title: ${payload.new.title}`);
    console.log(`Channel: ${payload.new.channel_id}`);
    console.log(`Source: ${payload.new.source}`);

    // Update UI, send notification, etc.
    showNotification(`New video from competitor!`, payload.new.title);
  });

  // Later, to unsubscribe:
  // subscription.unsubscribe();
}

// ============================================================================
// EXAMPLE 6: React Component Integration
// ============================================================================

import React, { useEffect, useState } from 'react';

function CompetitorVideosComponent() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    (async () => {
      try {
        const data = await getLatestCompetitorVideos(20);
        setVideos(data);
      } catch (error) {
        console.error('Error loading videos:', error);
      } finally {
        setLoading(false);
      }
    })();

    // Set up real-time subscription
    const subscription = subscribeToCompetitorVideos((payload) => {
      setVideos((prev) => {
        const newVideos = [payload.new, ...prev];
        // Keep only latest 20
        return newVideos.slice(0, 20);
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Latest Competitor Videos ({videos.length})</h2>
      {videos.map((video) => (
        <div key={video.id} className="video-card">
          <h3>{video.title}</h3>
          <p>Channel: {video.channel_id}</p>
          <p>Published: {new Date(video.published_at).toLocaleDateString()}</p>
          <p>Source: {video.source}</p>
          <a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank">
            Watch on YouTube
          </a>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EXAMPLE 7: Handle WebSub Hub Webhook
// ============================================================================

// This is automatically handled by the webhooks-youtube function
// But here's what happens on the backend:

async function handleWebhookDelivery(request: Request) {
  // 1. Check if it's a verification request
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const challenge = url.searchParams.get('hub.challenge');

    if (challenge) {
      return new Response(challenge, { status: 200 });
    }
  }

  // 2. Parse video notification
  if (request.method === 'POST') {
    const xml = await request.text();

    // Parse Atom XML entries
    const entries = parseAtomFeed(xml);

    // For each video:
    entries.forEach(async (video) => {
      // 1. Find users subscribed to this channel
      const users = await findUsersSubscribedToChannel(video.channel_id);

      // 2. Save video for each user
      for (const user of users) {
        await saveVideo({
          user_id: user.id,
          channel_id: video.channel_id,
          video_id: video.video_id,
          title: video.title,
          published_at: video.published_at,
          source: 'websub',
        });
      }
    });

    // 3. Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  }
}

// ============================================================================
// EXAMPLE 8: Subscription Renewal Logic (runs daily)
// ============================================================================

async function renewExpiredSubscriptions() {
  // 1. Find subscriptions expiring in next 24 hours
  const expiringSubscriptions = await findExpiringSubscriptions();

  for (const sub of expiringSubscriptions) {
    // 2. Check if user is active (visited competitor route in last 72h)
    const isActive = await checkUserActivity(sub.user_id);

    if (!isActive) {
      console.log(`Skipping renewal for inactive user ${sub.user_id}`);
      continue;
    }

    // 3. Re-subscribe to WebSub
    try {
      await subscribeToWebSubHub({
        channel_id: sub.channel_id,
        callback_url: 'https://your-domain.com/api/webhooks/youtube',
      });

      // 4. Update subscription expiration
      await updateSubscriptionExpiration(sub.id, nowPlus5Days());
      console.log(`Renewed subscription for channel ${sub.channel_id}`);
    } catch (error) {
      console.error(`Failed to renew subscription: ${error}`);
      await markSubscriptionFailed(sub.id, error.message);
    }
  }
}

// ============================================================================
// EXAMPLE 9: RSS Polling Fallback (runs every 12 hours)
// ============================================================================

async function pollRSSFeeds() {
  // 1. Get all RSS feed URLs for active users
  const activeUsers = await findActiveUsers();

  for (const user of activeUsers) {
    const channels = await getUserChannels(user.id);

    for (const channel of channels) {
      // 2. Fetch RSS feed
      const feed = await fetchRSSFeed(channel.rss_feed_url);
      const entries = parseAtomFeed(feed);

      // 3. Check for new videos not in database
      for (const entry of entries) {
        const exists = await videoExists(user.id, entry.video_id);

        if (!exists) {
          // 4. Save new video (skipped if WebSub already saved it)
          await saveVideo({
            user_id: user.id,
            channel_id: channel.channel_id,
            video_id: entry.video_id,
            title: entry.title,
            published_at: entry.published_at,
            source: 'rss_polling',
          });
        }
      }
    }
  }

  console.log('RSS polling completed');
}

// ============================================================================
// EXAMPLE 10: Error Handling and Retry Logic
// ============================================================================

async function subscribeWithRetry(
  channelId: string,
  userId: string,
  maxRetries: number = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await subscribeToYouTubeWebhook(channelId, userId);
      console.log(`Successfully subscribed (attempt ${attempt})`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed: ${error}`);

      // Exponential backoff: wait 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw new Error(`Failed to subscribe after ${maxRetries} attempts: ${lastError?.message}`);
}

// ============================================================================
// UTILITY FUNCTIONS (for reference)
// ============================================================================

function parseAtomFeed(xml: string) {
  // Simple XML parsing example
  const videoIds = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/g) || [];
  return videoIds.map((id) => id.replace(/<[^>]+>/g, ''));
}

async function fetchRSSFeed(url: string): Promise<string> {
  const response = await fetch(url);
  return await response.text();
}

function showNotification(title: string, message: string) {
  // Use browser Notification API or toast library
  console.log(`${title}: ${message}`);
}
