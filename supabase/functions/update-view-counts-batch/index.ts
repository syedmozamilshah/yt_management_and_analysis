/**
 * OPTIMIZED Batch View Count Updater
 * 
 * AGGRESSIVE QUOTA OPTIMIZATION:
 * - Tiered updates: Recent videos updated more frequently, old videos rarely
 * - Active users only: Only update videos for channels with active subscribers (3 days)
 * - Smart batching: 50 videos per API call (1 quota unit)
 * 
 * TIERED SCHEDULE:
 * - Videos < 3 days old → Update every 6 hours
 * - Videos 3-7 days old → Update daily
 * - Videos 7-30 days old → Update every 3 days
 * - Videos > 30 days old → Update weekly (or skip)
 * 
 * QUOTA USAGE (for 1000 channels, 50k videos):
 * - Old approach: 2000 units/day
 * - New approach: ~100-200 units/day (90% reduction!)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 50;

// Tiered update intervals (in hours)
const UPDATE_TIERS = {
  VERY_RECENT: { maxAgeDays: 3, updateIntervalHours: 6, priority: 1 },
  RECENT: { maxAgeDays: 7, updateIntervalHours: 24, priority: 2 },
  MODERATE: { maxAgeDays: 30, updateIntervalHours: 72, priority: 3 },
  OLD: { maxAgeDays: 90, updateIntervalHours: 168, priority: 4 }, // Weekly
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse options
    let options = { 
      maxQuota: 50,  // Max quota units to use per run (default very conservative)
      activeUserDays: 3, // Only update for users active in last 3 days
    };
    
    try {
      const body = await req.json() as Record<string, unknown>;
      if (body.maxQuota !== undefined) options.maxQuota = body.maxQuota as number;
      if (body.activeUserDays !== undefined) options.activeUserDays = body.activeUserDays as number;
    } catch {
      // Use defaults
    }

    console.log('Starting OPTIMIZED view count update:', options);
    const now = new Date();

    // Step 1: Get channels with active subscribers only (3 days)
    const activeUserCutoff = new Date(now.getTime() - options.activeUserDays * 24 * 60 * 60 * 1000);
    
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('user_channel_subscriptions')
      .select(`
        channel_id,
        user_activity!inner(last_ideation_opened_at)
      `)
      .eq('is_active', true)
      .gte('user_activity.last_ideation_opened_at', activeUserCutoff.toISOString());

    // Extract unique channel IDs
    const channelIds = [...new Set(
      (activeSubscriptions || []).map(s => s.channel_id).filter(Boolean)
    )];
    
    if (channelIds.length === 0) {
      // Fallback: Get channels from tracked_channels if no subscriptions found
      const { data: allChannels } = await supabase
        .from('tracked_channels')
        .select('channel_id')
        .eq('is_active', true)
        .limit(50);
      
      if (allChannels) {
        channelIds.push(...allChannels.map(c => c.channel_id));
      }
    }

    if (channelIds.length === 0) {
      console.log('No channels to update');
      return new Response(
        JSON.stringify({ success: true, message: 'No active channels', quota_used: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${channelIds.length} channels with active subscribers`);

    // Step 2: Get videos by tier, prioritizing recent videos
    const maxVideos = options.maxQuota * BATCH_SIZE;
    let allVideoIds: string[] = [];

    for (const [tierName, tier] of Object.entries(UPDATE_TIERS)) {
      if (allVideoIds.length >= maxVideos) break;

      const ageLimit = new Date(now.getTime() - tier.maxAgeDays * 24 * 60 * 60 * 1000);
      const updateLimit = new Date(now.getTime() - tier.updateIntervalHours * 60 * 60 * 1000);
      
      // Get previous tier's age limit to exclude already-handled videos
      const prevTierDays = tier.priority === 1 ? 0 
        : tier.priority === 2 ? UPDATE_TIERS.VERY_RECENT.maxAgeDays
        : tier.priority === 3 ? UPDATE_TIERS.RECENT.maxAgeDays
        : UPDATE_TIERS.MODERATE.maxAgeDays;
      
      const prevAgeLimit = prevTierDays > 0 
        ? new Date(now.getTime() - prevTierDays * 24 * 60 * 60 * 1000)
        : null;

      // Build query
      let query = supabase
        .from('tracked_videos')
        .select('video_id')
        .in('channel_id', channelIds)
        .gte('published_at', ageLimit.toISOString())
        .or(`view_count_updated_at.is.null,view_count_updated_at.lt.${updateLimit.toISOString()}`)
        .order('published_at', { ascending: false })
        .limit(maxVideos - allVideoIds.length);

      if (prevAgeLimit) {
        query = query.lt('published_at', prevAgeLimit.toISOString());
      }

      const { data: tierVideos } = await query;
      
      if (tierVideos && tierVideos.length > 0) {
        console.log(`${tierName}: ${tierVideos.length} videos need update`);
        allVideoIds.push(...tierVideos.map(v => v.video_id));
      }
    }

    if (allVideoIds.length === 0) {
      console.log('All videos up to date');
      return new Response(
        JSON.stringify({ success: true, message: 'All videos up to date', quota_used: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Batch fetch from YouTube API
    const batches: string[][] = [];
    for (let i = 0; i < allVideoIds.length; i += BATCH_SIZE) {
      batches.push(allVideoIds.slice(i, i + BATCH_SIZE));
    }

    const limitedBatches = batches.slice(0, options.maxQuota);
    console.log(`Processing ${limitedBatches.length} batches = ${limitedBatches.length} quota units`);

    let totalUpdated = 0;
    let apiCalls = 0;

    for (let i = 0; i < limitedBatches.length; i++) {
      const batch = limitedBatches[i];
      
      try {
        const response = await makeYouTubeApiRequest(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(',')}`
        );
        apiCalls++;

        if (!response.ok) {
          if (response.status === 403) {
            console.error('Quota exceeded, stopping');
            break;
          }
          continue;
        }

        const data = await response.json() as { 
          items?: Array<{ 
            id: string; 
            statistics: { viewCount?: string; likeCount?: string; commentCount?: string } 
          }> 
        };

        if (!data.items) continue;

        // Batch update tracked_videos
        for (const item of data.items) {
          const viewCount = parseInt(item.statistics.viewCount || '0');
          
          await supabase
            .from('tracked_videos')
            .update({
              view_count: viewCount,
              like_count: parseInt(item.statistics.likeCount || '0'),
              comment_count: parseInt(item.statistics.commentCount || '0'),
              view_count_updated_at: now.toISOString()
            })
            .eq('video_id', item.id);

          // Also sync to user_videos
          await supabase
            .from('user_videos')
            .update({ view_count: viewCount })
            .eq('video_id', item.id);

          totalUpdated++;
        }

        // Small delay between batches
        if (i < limitedBatches.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (error) {
        console.error(`Batch ${i + 1} error:`, error);
      }
    }

    // Log the run
    await supabase.from('view_count_update_logs').insert({
      videos_processed: allVideoIds.length,
      videos_updated: totalUpdated,
      api_calls: apiCalls,
      quota_used: apiCalls,
      completed_at: now.toISOString()
    });

    const result = {
      success: true,
      active_channels: channelIds.length,
      videos_found: allVideoIds.length,
      videos_updated: totalUpdated,
      quota_used: apiCalls,
      message: `Updated ${totalUpdated} videos using ${apiCalls} quota units`
    };

    console.log('Optimized update complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
