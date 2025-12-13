
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChannelStats {
  channel_name: string;
  total_views: number;
  video_count: number;
  channel_subscribers: number;
  channel_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { channel_name } = await req.json();
    
    if (!channel_name) {
      return new Response(
        JSON.stringify({ error: 'Channel name is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Fetching viewboard stats for channel: ${channel_name}`);

    // First, search for the channel to get the channel ID
    const searchResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channel_name)}&maxResults=1`
    );
    
    if (!searchResponse.ok) {
      throw new Error('Failed to search for channel');
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      console.log(`No channel found for: ${channel_name}`);
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const channelId = searchData.items[0].id.channelId;
    console.log(`Found channel ID: ${channelId} for channel: ${channel_name}`);

    // Get channel details including subscriber count
    const channelResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}`
    );
    
    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel details');
    }
    
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Channel details not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const channelInfo = channelData.items[0];
    const subscriberCount = parseInt(channelInfo.statistics.subscriberCount || '0');
    const actualChannelName = channelInfo.snippet.title;

    console.log(`Channel found: ${actualChannelName} Subscribers: ${subscriberCount}`);

    // Calculate date 28 days ago
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const publishedAfter = twentyEightDaysAgo.toISOString();

    console.log(`Looking for videos published after: ${publishedAfter}`);

    // Search for videos from this channel in the last 28 days
    const videosResponse = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&publishedAfter=${publishedAfter}&maxResults=50&order=date`
    );
    
    if (!videosResponse.ok) {
      throw new Error('Failed to fetch channel videos');
    }
    
    const videosData = await videosResponse.json();

    if (!videosData.items) {
      console.log(`No videos found for channel in last 28 days`);
      return new Response(
        JSON.stringify({
          channel_name: actualChannelName,
          total_views: 0,
          video_count: 0,
          channel_subscribers: subscriberCount,
          channel_id: channelId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoIds = videosData.items.map((item: any) => item.id.videoId).join(',');
    console.log(`Videos found in last 28 days: ${videosData.items.length}`);
    
    if (videoIds) {
      console.log(`Fetching stats for video IDs: ${videoIds}`);
      
      // Get detailed statistics for these videos
      const statsResponse = await makeYouTubeApiRequest(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}`
      );
      
      if (!statsResponse.ok) {
        throw new Error('Failed to fetch video statistics');
      }
      
      const statsData = await statsResponse.json();

      let totalViews = 0;
      let videoCount = 0;

      if (statsData.items) {
        statsData.items.forEach((video: any) => {
          const viewCount = parseInt(video.statistics.viewCount || '0');
          totalViews += viewCount;
          videoCount++;
          console.log(`Video: "${video.snippet.title}" - Views: ${viewCount}, Subscribers: ${subscriberCount}`);
        });
      }

      console.log(`Total views: ${totalViews} across ${videoCount} videos`);

      const result: ChannelStats = {
        channel_name: actualChannelName,
        total_views: totalViews,
        video_count: videoCount,
        channel_subscribers: subscriberCount,
        channel_id: channelId
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        channel_name: actualChannelName,
        total_views: 0,
        video_count: 0,
        channel_subscribers: subscriberCount,
        channel_id: channelId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching channel viewboard stats:', error);
    
    // Check if it's a quota exhaustion error
    if (error.message.includes('quota') || error.message.includes('API keys')) {
      return new Response(
        JSON.stringify({ 
          error: error.message
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to fetch channel stats' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
