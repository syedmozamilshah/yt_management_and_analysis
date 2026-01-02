import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const ACTIVE_USER_THRESHOLD = 72; // hours

/**
 * Parse YouTube Atom XML feed and extract video information
 */
function parseAtomFeed(xml: string): { video_id: string; title: string; published_at: string }[] {
  const videos: { video_id: string; title: string; published_at: string }[] = [];

  try {
    const entryRegex = /<entry>[\s\S]*?<\/entry>/g;
    const entries = xml.match(entryRegex) || [];

    for (const entry of entries) {
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);

      if (videoIdMatch && titleMatch && publishedMatch) {
        videos.push({
          video_id: videoIdMatch[1],
          title: titleMatch[1],
          published_at: publishedMatch[1],
        });
      }
    }
  } catch (error) {
    console.error("Error parsing RSS feed:", error);
  }

  return videos;
}

/**
 * Fetch and parse RSS feed for a channel
 */
async function fetchRssFeed(rssUrl: string): Promise<{ video_id: string; title: string; published_at: string }[]> {
  try {
    const response = await fetch(rssUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; YouTubeBot/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch RSS feed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return parseAtomFeed(xml);
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return [];
  }
}

/**
 * Check if user is active (visited competitor tracker within threshold)
 */
async function isUserActive(userId: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("last_competitor_route_opened")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Error fetching user:", error);
      return false;
    }

    if (!user?.last_competitor_route_opened) {
      return false;
    }

    const lastOpenedTime = new Date(user.last_competitor_route_opened);
    const hoursSinceLastOpen = (Date.now() - lastOpenedTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastOpen < ACTIVE_USER_THRESHOLD;
  } catch (error) {
    console.error("Error checking user activity:", error);
    return false;
  }
}

/**
 * Poll RSS feeds for active users and detect new videos
 */
async function pollRssFeeds() {
  try {
    console.log("Starting RSS feed polling for fallback mechanism");

    // Get all unique channels with RSS URLs for active users
    const { data: channels, error: fetchError } = await supabase
      .from("user_competitor_channels")
      .select("id, user_id, channel_id, rss_feed_url")
      .not("rss_feed_url", "is", null)
      .eq("webhook_subscribed", true); // Only poll channels with WebSub

    if (fetchError) {
      console.error("Error fetching channels:", fetchError);
      return;
    }

    if (!channels || channels.length === 0) {
      console.log("No channels to poll");
      return;
    }

    console.log(`Found ${channels.length} channels to poll`);

    let pollsAttempted = 0;
    let videosFound = 0;
    let videosSaved = 0;
    let skippedInactiveUsers = 0;

    // Group channels by user to minimize API calls
    const channelsByUser = new Map<string, typeof channels>();
    for (const channel of channels) {
      const userId = channel.user_id;
      if (!channelsByUser.has(userId)) {
        channelsByUser.set(userId, []);
      }
      channelsByUser.get(userId)!.push(channel);
    }

    for (const [userId, userChannels] of channelsByUser) {
      // Check if user is active
      const active = await isUserActive(userId);

      if (!active) {
        console.log(`Skipping user ${userId} - inactive`);
        skippedInactiveUsers += userChannels.length;
        continue;
      }

      for (const channel of userChannels) {
        if (!channel.rss_feed_url) continue;

        try {
          console.log(`Polling RSS feed for channel ${channel.channel_id}`);
          const videos = await fetchRssFeed(channel.rss_feed_url);
          pollsAttempted++;
          videosFound += videos.length;

          // Check and save new videos
          for (const video of videos) {
            const { error: insertError } = await supabase
              .from("user_competitor_videos")
              .insert({
                user_id: userId,
                channel_id: channel.channel_id,
                video_id: video.video_id,
                title: video.title,
                published_at: video.published_at,
                source: "rss_polling",
              });

            if (insertError) {
              if (insertError.code !== "23505") {
                // Not a duplicate error
                console.error(`Error inserting video: ${insertError.message}`);
              }
            } else {
              videosSaved++;
            }
          }
        } catch (error) {
          console.error(`Error polling channel ${channel.channel_id}:`, error);
        }
      }
    }

    console.log(
      `RSS polling complete - Polls: ${pollsAttempted}, Videos found: ${videosFound}, Saved: ${videosSaved}, Skipped users: ${skippedInactiveUsers}`
    );
  } catch (error) {
    console.error("Error in RSS polling job:", error);
  }
}

serve(async (req) => {
  // Trigger job via cron or manual request
  if (req.method === "POST" || req.method === "GET") {
    await pollRssFeeds();
    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
