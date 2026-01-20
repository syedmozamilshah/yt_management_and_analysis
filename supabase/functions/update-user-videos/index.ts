/**
 * Resolve Channel IDs and Update View Counts for User Videos
 * 
 * This function:
 * 1. Fetches channel_id for user_videos that don't have one
 * 2. Updates view counts for all user_videos
 * 3. Creates tracked_channels and subscriptions for newly resolved channels
 * 
 * QUOTA: 1 unit per 50 videos (snippet+statistics request)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let options = { 
      limit: 200,  // Max videos to process
      resolveChannelIds: true,  // Resolve missing channel_ids
      updateViewCounts: true  // Update view counts
    };
    
    try {
      const body = await req.json() as Record<string, unknown>;
      if (body.limit !== undefined) options.limit = body.limit as number;
      if (body.resolveChannelIds !== undefined) options.resolveChannelIds = body.resolveChannelIds as boolean;
      if (body.updateViewCounts !== undefined) options.updateViewCounts = body.updateViewCounts as boolean;
    } catch {
      // Use defaults
    }

    console.log('Starting user videos update with options:', options);

    // Get user_videos that need channel_id resolution or view count updates
    const { data: videos, error: fetchError } = await supabase
      .from('user_videos')
      .select('id, video_id, channel_id, user_id, niche, channel_name')
      .or('channel_id.is.null,view_count.is.null,view_count.eq.0')
      .order('created_at', { ascending: false })
      .limit(options.limit);

    if (fetchError) {
      throw new Error(`Failed to fetch user_videos: ${fetchError.message}`);
    }

    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No videos need updating',
          videos_processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${videos.length} videos to process`);

    // Process in batches
    const videoIds = videos.map(v => v.video_id);
    const batches: string[][] = [];
    
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      batches.push(videoIds.slice(i, i + BATCH_SIZE));
    }

    let totalUpdated = 0;
    let channelIdsResolved = 0;
    let subscriptionsCreated = 0;
    let apiCalls = 0;
    const errors: string[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} videos)`);

      try {
        const videoIdsParam = batch.join(',');
        // Request snippet (for channelId) and statistics (for viewCount)
        const response = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIdsParam}`
        );
        apiCalls++;

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error for batch ${batchIndex + 1}:`, errorText);
          errors.push(`Batch ${batchIndex + 1}: API returned ${response.status}`);
          continue;
        }

        const data = await response.json() as { items?: Array<{ id: string; snippet?: { channelId?: string; channelTitle?: string }; statistics?: { viewCount?: string } }> };
        
        if (!data.items || data.items.length === 0) {
          console.log(`Batch ${batchIndex + 1}: No data returned`);
          continue;
        }

        // Update each video
        for (const item of data.items) {
          const videoId = item.id;
          const channelId = item.snippet?.channelId;
          const channelName = item.snippet?.channelTitle;
          const viewCount = parseInt(item.statistics?.viewCount || '0', 10);
          
          // Find the user_video record
          const userVideo = videos.find(v => v.video_id === videoId);
          if (!userVideo) continue;

          // Update user_videos with channel_id and view_count
          const updateData: any = { 
            view_count: viewCount
          };
          
          if (channelId && !userVideo.channel_id) {
            updateData.channel_id = channelId;
            channelIdsResolved++;

            // Create tracked_channel if doesn't exist
            await supabase
              .from('tracked_channels')
              .upsert({
                channel_id: channelId,
                channel_name: channelName || userVideo.channel_name || 'Unknown Channel',
                rss_feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                is_active: true,
                user_id: userVideo.user_id
              }, {
                onConflict: 'channel_id'
              });

            // Create subscription
            const { error: subError } = await supabase
              .from('user_channel_subscriptions')
              .upsert({
                user_id: userVideo.user_id,
                channel_id: channelId,
                niche: userVideo.niche || 'General',
                is_active: true
              }, {
                onConflict: 'user_id,channel_id'
              });
            
            if (!subError) {
              subscriptionsCreated++;
            }
          }

          const { error: updateError } = await supabase
            .from('user_videos')
            .update(updateData)
            .eq('id', userVideo.id);

          if (updateError) {
            console.error(`Failed to update video ${videoId}:`, updateError);
            errors.push(`Video ${videoId}: ${updateError.message}`);
          } else {
            totalUpdated++;
          }
        }

        console.log(`Batch ${batchIndex + 1}: Processed ${batch.length} videos`);

        // Small delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error);
        errors.push(`Batch ${batchIndex + 1}: ${error.message}`);
      }
    }

    const result = {
      success: true,
      message: `Processed ${totalUpdated} videos`,
      videos_processed: videos.length,
      videos_updated: totalUpdated,
      channel_ids_resolved: channelIdsResolved,
      subscriptions_created: subscriptionsCreated,
      api_calls: apiCalls,
      quota_used: apiCalls,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Update complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-user-videos:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
