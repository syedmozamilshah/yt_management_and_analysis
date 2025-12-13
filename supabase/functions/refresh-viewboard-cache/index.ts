
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChannelCache {
  channel_name: string;
  channel_id: string;
  total_views: number;
  video_count: number;
  channel_subscribers: number;
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

    const { manual_refresh = false } = await req.json().catch(() => ({}));
    
    console.log(`Starting viewboard cache refresh${manual_refresh ? ' (manual)' : ' (automatic)'}`);

    // First, get current channels from videos database to sync cache
    console.log('Fetching current channels from videos database...');
    const { data: currentChannelsData, error: currentChannelsError } = await supabase
      .from('videos')
      .select('channel_name')
      .not('channel_name', 'is', null);

    if (currentChannelsError) {
      console.error('Error fetching current channels:', currentChannelsError);
      throw new Error(`Failed to fetch current channels: ${currentChannelsError.message}`);
    }

    const currentChannelNames = [...new Set(currentChannelsData?.map(v => v.channel_name).filter(Boolean) || [])];
    console.log(`Found ${currentChannelNames.length} unique channels in current database:`, currentChannelNames);

    // Clean up cache - remove entries for channels no longer in videos database
    if (currentChannelNames.length > 0) {
      console.log('Cleaning up cache for channels no longer in database...');
      const { error: cleanupError } = await supabase
        .from('viewboard_cache')
        .delete()
        .not('channel_name', 'in', `(${currentChannelNames.map(name => `"${name}"`).join(',')})`);

      if (cleanupError) {
        console.error('Error cleaning up cache:', cleanupError);
      } else {
        console.log('Cleaned up outdated cache entries');
      }
    } else {
      // If no channels in videos database, clear all cache
      console.log('No channels in videos database, clearing all cache...');
      const { error: clearError } = await supabase
        .from('viewboard_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (clearError) {
        console.error('Error clearing cache:', clearError);
      }

      return new Response(
        JSON.stringify({ 
          message: 'No channels found in videos database',
          success: true,
          channels_processed: 0,
          total_views: 0,
          videos_processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we need to refresh (only if more than 24 hours have passed)
    const { data: existingCache } = await supabase
      .from('viewboard_cache')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (existingCache && !manual_refresh) {
      const lastUpdate = new Date(existingCache.last_updated);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 24) {
        console.log(`Cache is still fresh (${hoursSinceUpdate.toFixed(1)} hours old). Skipping refresh.`);
        return new Response(
          JSON.stringify({ 
            message: 'Cache is still fresh',
            hours_since_update: hoursSinceUpdate,
            next_refresh_in_hours: 24 - hoursSinceUpdate
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch all videos for current channels to get sample video IDs
    console.log('Fetching videos for current channels...');
    const { data: channelsData, error: channelsError } = await supabase
      .from('videos')
      .select('channel_name, video_id')
      .not('channel_name', 'is', null)
      .in('channel_name', currentChannelNames);

    if (channelsError) {
      console.error('Error fetching channel videos:', channelsError);
      throw new Error(`Failed to fetch channel videos: ${channelsError.message}`);
    }

    // Get unique channel names and their sample video IDs to find channel IDs
    const uniqueChannels = currentChannelNames.map(channelName => {
      const sampleVideo = channelsData?.find(v => v.channel_name === channelName);
      return {
        name: channelName,
        sampleVideoId: sampleVideo?.video_id || ''
      };
    }).filter(channel => channel.sampleVideoId);

    console.log(`Processing ${uniqueChannels.length} channels with sample videos:`, uniqueChannels.map(c => c.name));

    // Calculate date 28 days ago
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const publishedAfter = twentyEightDaysAgo.toISOString();

    console.log(`Fetching YouTube data for videos published after: ${publishedAfter}`);

    const channelCacheData: ChannelCache[] = [];
    const errors: string[] = [];

    // Process each channel from our database
    for (let i = 0; i < uniqueChannels.length; i++) {
      const channel = uniqueChannels[i];
      
      try {
        console.log(`[${i + 1}/${uniqueChannels.length}] Processing channel: ${channel.name}`);
        
        // Step 1: Get channel ID from a sample video
        console.log(`Getting channel ID from sample video: ${channel.sampleVideoId}`);
        const videoResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${channel.sampleVideoId}`
        );

        if (!videoResponse.ok) {
          throw new Error(`Failed to get channel ID for ${channel.name}: ${videoResponse.status}`);
        }

        const videoData = await videoResponse.json();
        if (!videoData.items || videoData.items.length === 0) {
          console.log(`No video data found for ${channel.name}, skipping`);
          continue;
        }

        const channelId = videoData.items[0].snippet.channelId;
        console.log(`Found channel ID: ${channelId} for ${channel.name}`);
        
        // Step 2: Search for videos from this channel in the last 28 days
        console.log(`Searching for videos published after ${publishedAfter}`);
        
        let allVideoIds: string[] = [];
        let nextPageToken = '';
        let searchAttempts = 0;
        const maxSearchPages = 10; // Limit to prevent infinite loops
        
        do {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&publishedAfter=${publishedAfter}&type=video&order=date&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
          
          const searchResponse = await makeYouTubeApiRequest(searchUrl);
          
          if (!searchResponse.ok) {
            throw new Error(`Search failed for ${channel.name}: ${searchResponse.status}`);
          }
          
          const searchData = await searchResponse.json();
          
          if (searchData.items && searchData.items.length > 0) {
            const videoIds = searchData.items.map((item: any) => item.id.videoId).filter(Boolean);
            allVideoIds.push(...videoIds);
            console.log(`Found ${videoIds.length} videos in this page (total so far: ${allVideoIds.length})`);
          }
          
          nextPageToken = searchData.nextPageToken || '';
          searchAttempts++;
          
          // Add delay between requests
          if (nextPageToken && searchAttempts < maxSearchPages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } while (nextPageToken && searchAttempts < maxSearchPages);
        
        console.log(`Found ${allVideoIds.length} total videos for ${channel.name} in last 28 days`);
        
        if (allVideoIds.length === 0) {
          console.log(`No videos found for ${channel.name}, adding with zero stats`);
          channelCacheData.push({
            channel_name: channel.name,
            channel_id: channelId,
            total_views: 0,
            video_count: 0,
            channel_subscribers: 0
          });
          continue;
        }

        // Step 3: Get detailed statistics for all found videos
        let totalViews = 0;
        let subscriberCount = 0;
        
        // Process videos in batches of 50 (YouTube API limit)
        for (let j = 0; j < allVideoIds.length; j += 50) {
          const batch = allVideoIds.slice(j, j + 50);
          const videoIds = batch.join(',');
          
          console.log(`Fetching stats for batch ${Math.floor(j/50) + 1} (${batch.length} videos)`);
          
          const statsResponse = await makeYouTubeApiRequest(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}`
          );
          
          if (!statsResponse.ok) {
            throw new Error(`Video stats failed for ${channel.name}: ${statsResponse.status}`);
          }
          
          const statsData = await statsResponse.json();

          if (statsData.items) {
            statsData.items.forEach((video: any) => {
              const viewCount = parseInt(video.statistics.viewCount || '0');
              totalViews += viewCount;
            });
          }

          // Add delay between API calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Step 4: Get current subscriber count
        console.log(`Fetching current subscriber count for ${channel.name}`);
        const channelResponse = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`
        );
        
        if (channelResponse.ok) {
          const channelData = await channelResponse.json();
          if (channelData.items && channelData.items[0]) {
            subscriberCount = parseInt(channelData.items[0].statistics.subscriberCount || '0');
          }
        }
        
        console.log(`Channel: ${channel.name} - Total views: ${totalViews}, Videos: ${allVideoIds.length}, Subscribers: ${subscriberCount}`);

        channelCacheData.push({
          channel_name: channel.name,
          channel_id: channelId,
          total_views: totalViews,
          video_count: allVideoIds.length,
          channel_subscribers: subscriberCount
        });

      } catch (error) {
        console.error(`Error processing channel ${channel.name}:`, error);
        errors.push(`Error processing ${channel.name}: ${error.message}`);
        
        // If we get quota exhaustion, stop processing
        if (error.message.includes('quota') || error.message.includes('403')) {
          console.log('API quota exhausted, stopping refresh');
          break;
        }
      }
    }

    console.log(`Processed ${channelCacheData.length} channels successfully`);

    // Update the cache table with fresh data
    if (channelCacheData.length > 0) {
      console.log('Updating viewboard cache in database');
      
      // Clear existing cache for these specific channels
      const channelNames = channelCacheData.map(c => c.channel_name);
      const { error: deleteError } = await supabase
        .from('viewboard_cache')
        .delete()
        .in('channel_name', channelNames);

      if (deleteError) {
        console.error('Error clearing existing cache:', deleteError);
      } else {
        console.log('Cleared existing cache for updated channels');
      }

      // Insert new cache data
      const { error: insertError } = await supabase
        .from('viewboard_cache')
        .insert(channelCacheData);

      if (insertError) {
        console.error('Error inserting cache data:', insertError);
        throw insertError;
      }

      console.log(`Successfully cached data for ${channelCacheData.length} channels`);
    }

    const response = {
      success: true,
      channels_processed: channelCacheData.length,
      total_views: channelCacheData.reduce((sum, channel) => sum + channel.total_views, 0),
      videos_processed: channelCacheData.reduce((sum, channel) => sum + channel.video_count, 0),
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      data_source: 'fresh_youtube_api'
    };

    console.log('Viewboard cache refresh completed:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error refreshing viewboard cache:', error);
    
    // Check if it's a quota exhaustion error
    if (error.message.includes('quota') || error.message.includes('API keys')) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          success: false
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to refresh viewboard cache',
        details: error.message,
        success: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
