import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookBaseUrl = Deno.env.get("WEBHOOK_BASE_URL") || "https://yt-management-and-analysis.vercel.app";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const HUB_URL = "https://pubsubhubbub.appspot.com/";
const HUB_LEASE_SECONDS = 432000; // 5 days

/**
 * Subscribe to YouTube WebSub hub for real-time video notifications
 */
async function subscribeToWebSub(
  channelId: string,
  userId: string
): Promise<{ success: boolean; error?: string; expiresAt?: string }> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const callbackUrl = `${webhookBaseUrl}/api/webhooks/youtube`;

    const formData = new URLSearchParams();
    formData.append("hub.mode", "subscribe");
    formData.append("hub.topic", rssUrl);
    formData.append("hub.callback", callbackUrl);
    formData.append("hub.verify", "async");
    formData.append("hub.lease_seconds", HUB_LEASE_SECONDS.toString());

    console.log(`Subscribing to channel ${channelId} for user ${userId}`);

    const response = await fetch(HUB_URL, {
      method: "POST",
      body: formData.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WebSub subscription failed: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `WebSub hub returned ${response.status}`,
      };
    }

    // Calculate expiration time (now + lease seconds)
    const expiresAt = new Date(Date.now() + HUB_LEASE_SECONDS * 1000).toISOString();

    // Save subscription details
    const { error: saveError } = await supabase
      .from("websub_subscriptions")
      .upsert(
        {
          user_id: userId,
          channel_id: channelId,
          subscription_expires_at: expiresAt,
          renewal_status: "pending",
          last_renewal_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel_id" }
      );

    if (saveError) {
      console.error("Error saving subscription:", saveError);
      return {
        success: false,
        error: saveError.message,
      };
    }

    // Update channel with webhook subscription status
    const { error: updateError } = await supabase
      .from("user_competitor_channels")
      .update({
        webhook_subscribed: true,
        subscription_expires_at: expiresAt,
        subscription_status: "pending",
        rss_feed_url: rssUrl,
      })
      .eq("user_id", userId)
      .eq("channel_id", channelId);

    if (updateError) {
      console.error("Error updating channel:", updateError);
      return {
        success: false,
        error: updateError.message,
      };
    }

    console.log(`Successfully initiated WebSub subscription for channel ${channelId}`);

    return {
      success: true,
      expiresAt,
    };
  } catch (error) {
    console.error("Error in subscribeToWebSub:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { channel_id, user_id } = await req.json();

    if (!channel_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "channel_id and user_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await subscribeToWebSub(channel_id, user_id);

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: "WebSub subscription initiated",
        expiresAt: result.expiresAt,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
