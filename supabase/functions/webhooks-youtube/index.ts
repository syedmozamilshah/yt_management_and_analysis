import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Parse YouTube Atom XML feed and extract video information
 */
function parseAtomXml(xml: string): { video_id: string; title: string; published_at: string; channel_id: string }[] {
  const videos: { video_id: string; title: string; published_at: string; channel_id: string }[] = [];

  try {
    // Simple regex-based parsing for YouTube Atom feed
    // Extract video IDs from entries
    const entryRegex = /<entry>[\s\S]*?<\/entry>/g;
    const entries = xml.match(entryRegex) || [];

    for (const entry of entries) {
      // Extract video ID from yt:videoId
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      // Extract title
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      // Extract published date
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      // Extract channel ID from author/uri
      const channelIdMatch = entry.match(/<uri>yt:channel:([^<]+)<\/uri>/);

      if (videoIdMatch && titleMatch && publishedMatch && channelIdMatch) {
        videos.push({
          video_id: videoIdMatch[1],
          title: titleMatch[1],
          published_at: publishedMatch[1],
          channel_id: channelIdMatch[1],
        });
      }
    }
  } catch (error) {
    console.error("Error parsing Atom XML:", error);
  }

  return videos;
}

/**
 * Handle WebSub verification challenge
 */
function handleVerificationChallenge(req: Request): Response {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge");

  if (challenge) {
    console.log("WebSub verification challenge received and accepted");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Not a valid verification request", { status: 400 });
}

/**
 * Handle incoming video notifications from YouTube WebSub hub
 */
async function handleVideoNotification(body: string): Promise<{ saved: number; duplicates: number }> {
  const videos = parseAtomXml(body);
  let saved = 0;
  let duplicates = 0;

  for (const video of videos) {
    try {
      // Find all users subscribed to this channel
      const { data: subscriptions, error: fetchError } = await supabase
        .from("websub_subscriptions")
        .select("user_id")
        .eq("channel_id", video.channel_id);

      if (fetchError) {
        console.error("Error fetching subscriptions:", fetchError);
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No subscribers found for channel ${video.channel_id}`);
        continue;
      }

      // Insert video for each subscribed user
      for (const sub of subscriptions) {
        const { error: insertError } = await supabase
          .from("user_competitor_videos")
          .insert({
            user_id: sub.user_id,
            channel_id: video.channel_id,
            video_id: video.video_id,
            title: video.title,
            published_at: video.published_at,
            source: "websub",
          });

        if (insertError) {
          if (insertError.code === "23505") {
            // Unique constraint violation - duplicate video
            duplicates++;
          } else {
            console.error("Error inserting video:", insertError);
          }
        } else {
          saved++;
        }
      }

      // Update last webhook delivery timestamp
      await supabase
        .from("user_competitor_channels")
        .update({ last_webhook_delivery: new Date().toISOString() })
        .eq("channel_id", video.channel_id);
    } catch (error) {
      console.error(`Error processing video ${video.video_id}:`, error);
    }
  }

  return { saved, duplicates };
}

serve(async (req) => {
  // Handle WebSub verification (GET request with hub.challenge)
  if (req.method === "GET") {
    return handleVerificationChallenge(req);
  }

  // Handle video notifications (POST request)
  if (req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type");
      let body = "";

      if (contentType?.includes("application/xml") || contentType?.includes("text/xml")) {
        body = await req.text();
      } else if (contentType?.includes("application/x-www-form-urlencoded")) {
        const formData = await req.text();
        // Extract payload from form data
        const payloadMatch = formData.match(/payload=(.+?)(&|$)/);
        if (payloadMatch) {
          body = decodeURIComponent(payloadMatch[1]);
        }
      }

      if (!body) {
        console.warn("No valid payload received");
        return new Response("OK", { status: 200 });
      }

      const result = await handleVideoNotification(body);
      console.log(`Videos saved: ${result.saved}, Duplicates skipped: ${result.duplicates}`);

      // Always return 200 to acknowledge receipt
      return new Response(
        JSON.stringify({
          status: "success",
          saved: result.saved,
          duplicates: result.duplicates,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error processing webhook:", error);
      // Still return 200 to prevent redelivery attempts
      return new Response(
        JSON.stringify({ status: "error", message: error.message }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
