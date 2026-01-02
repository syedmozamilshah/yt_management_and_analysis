import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookBaseUrl = Deno.env.get("WEBHOOK_BASE_URL") || "https://yt-management-and-analysis.vercel.app";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const HUB_URL = "https://pubsubhubbub.appspot.com/";
const HUB_LEASE_SECONDS = 432000; // 5 days
const ACTIVE_USER_THRESHOLD = 72; // hours

/**
 * Renewal subscription with WebSub hub
 */
async function renewWebSubSubscription(
  channelId: string,
  userId: string
): Promise<boolean> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const callbackUrl = `${webhookBaseUrl}/api/webhooks/youtube`;

    const formData = new URLSearchParams();
    formData.append("hub.mode", "subscribe");
    formData.append("hub.topic", rssUrl);
    formData.append("hub.callback", callbackUrl);
    formData.append("hub.verify", "async");
    formData.append("hub.lease_seconds", HUB_LEASE_SECONDS.toString());

    console.log(`Renewing WebSub subscription for channel ${channelId}`);

    const response = await fetch(HUB_URL, {
      method: "POST",
      body: formData.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WebSub renewal failed: ${response.status} - ${errorText}`);

      // Update subscription status as failed
      await supabase
        .from("websub_subscriptions")
        .update({
          renewal_status: "failed",
          last_renewal_error: `HTTP ${response.status}: ${errorText}`,
        })
        .eq("user_id", userId)
        .eq("channel_id", channelId);

      return false;
    }

    // Calculate new expiration
    const expiresAt = new Date(Date.now() + HUB_LEASE_SECONDS * 1000).toISOString();

    // Update subscription
    const { error } = await supabase
      .from("websub_subscriptions")
      .update({
        subscription_expires_at: expiresAt,
        renewal_status: "active",
        last_renewal_at: new Date().toISOString(),
        last_renewal_error: null,
      })
      .eq("user_id", userId)
      .eq("channel_id", channelId);

    if (error) {
      console.error("Error updating subscription after renewal:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error renewing subscription:", error);
    return false;
  }
}

/**
 * Check if user is active (has visited competitor tracker within threshold)
 */
async function isUserActive(userId: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("last_competitor_route_opened")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user:", error);
      return false;
    }

    if (!user.last_competitor_route_opened) {
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
 * Main renewal job - runs daily
 */
async function renewSubscriptions() {
  try {
    console.log("Starting WebSub subscription renewal job");

    // Find subscriptions expiring in next 24 hours
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: expiringSubscriptions, error: fetchError } = await supabase
      .from("websub_subscriptions")
      .select("user_id, channel_id")
      .lt("subscription_expires_at", tomorrow)
      .gte("subscription_expires_at", now)
      .eq("renewal_status", "active");

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      return;
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      console.log("No subscriptions expiring in next 24 hours");
      return;
    }

    console.log(`Found ${expiringSubscriptions.length} subscriptions to renew`);

    let renewed = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of expiringSubscriptions) {
      // Check if user is active
      const active = await isUserActive(sub.user_id);

      if (!active) {
        console.log(
          `Skipping renewal for user ${sub.user_id} - inactive (no competitor route access in ${ACTIVE_USER_THRESHOLD}h)`
        );
        skipped++;
        continue;
      }

      // Attempt renewal
      const success = await renewWebSubSubscription(sub.channel_id, sub.user_id);

      if (success) {
        renewed++;
      } else {
        failed++;
      }
    }

    console.log(`Renewal job complete - Renewed: ${renewed}, Failed: ${failed}, Skipped: ${skipped}`);
  } catch (error) {
    console.error("Error in renewal job:", error);
  }
}

serve(async (req) => {
  // Trigger job via cron or manual request
  if (req.method === "POST" || req.method === "GET") {
    await renewSubscriptions();
    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
