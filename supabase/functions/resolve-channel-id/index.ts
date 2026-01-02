import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

interface ChannelResolution {
  channel_id: string;
  channel_name?: string;
}

/**
 * Resolves a YouTube channel ID from various URL formats
 * Accepts:
 * - Full URLs: https://www.youtube.com/@handle or https://www.youtube.com/channel/UC...
 * - Direct channel IDs: UC...
 * - Handles: @handle or handle
 */
function extractChannelInfoFromUrl(url: string): { type: 'id' | 'handle'; value: string } | null {
  try {
    // If it's a direct channel ID
    if (url.startsWith('UC') && url.length === 24) {
      return { type: 'id', value: url };
    }

    // Try parsing as URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Format: /channel/UC...
      if (pathname.includes('/channel/')) {
        const channelId = pathname.split('/channel/')[1];
        if (channelId && channelId.length === 24) {
          return { type: 'id', value: channelId };
        }
      }

      // Format: /@handle
      if (pathname.startsWith('/@')) {
        const handle = pathname.split('/@')[1];
        if (handle) {
          return { type: 'handle', value: handle };
        }
      }
    } catch (_urlError) {
      // Not a valid URL, try direct handle
      if (url.startsWith('@')) {
        return { type: 'handle', value: url.substring(1) };
      }
      if (!url.includes('/') && !url.includes('http')) {
        return { type: 'handle', value: url };
      }
    }

    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Resolves handle to channel ID using YouTube API
 */
async function resolveHandleToChannelId(handle: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      console.error(`YouTube API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error resolving handle:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { channel_input } = await req.json();

    if (!channel_input) {
      return new Response(
        JSON.stringify({ error: "channel_input is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const channelInfo = extractChannelInfoFromUrl(channel_input);

    if (!channelInfo) {
      return new Response(
        JSON.stringify({ error: "Invalid channel URL or ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let channelId: string;

    if (channelInfo.type === 'id') {
      channelId = channelInfo.value;
    } else {
      // Resolve handle to channel ID
      const resolved = await resolveHandleToChannelId(channelInfo.value);
      if (!resolved) {
        return new Response(
          JSON.stringify({ error: `Could not resolve handle: @${channelInfo.value}` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      channelId = resolved;
    }

    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    return new Response(
      JSON.stringify({
        channel_id: channelId,
        rss_feed_url: rssUrl,
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
