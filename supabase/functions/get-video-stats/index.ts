/**
 * Get Video Statistics (View Counts) from YouTube API
 * 
 * QUOTA COST: 1 unit per request (can fetch up to 50 videos per request)
 * 
 * This function fetches view counts for a batch of video IDs.
 * Used when adding videos to ideation to get accurate view counts.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { makeYouTubeApiRequest } from "../_shared/youtube-api-keys.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoStats {
  video_id: string;
  view_count: number;
  like_count?: number;
  comment_count?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoIds } = await req.json() as { videoIds: string[] }

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'videoIds array is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Limit to 50 videos per request (YouTube API limit)
    const limitedIds = videoIds.slice(0, 50)
    
    console.log(`Fetching stats for ${limitedIds.length} videos`)

    // Fetch video statistics from YouTube API (1 quota unit for up to 50 videos)
    const response = await makeYouTubeApiRequest(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${limitedIds.join(',')}`
    )

    if (!response.ok) {
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'YouTube API quota exceeded. View counts will be updated later.' }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      throw new Error(`YouTube API error: ${response.status}`)
    }

    const data = await response.json() as { 
      items?: Array<{ 
        id: string; 
        statistics: { 
          viewCount?: string; 
          likeCount?: string; 
          commentCount?: string 
        } 
      }> 
    }

    if (!data.items) {
      return new Response(
        JSON.stringify({ stats: [], message: 'No video data returned' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build stats map
    const stats: VideoStats[] = data.items.map(item => ({
      video_id: item.id,
      view_count: parseInt(item.statistics.viewCount || '0'),
      like_count: parseInt(item.statistics.likeCount || '0'),
      comment_count: parseInt(item.statistics.commentCount || '0')
    }))

    console.log(`Got stats for ${stats.length} videos`)

    return new Response(
      JSON.stringify({ 
        stats,
        fetched: stats.length,
        requested: limitedIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error fetching video stats:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch video statistics',
        details: (error as Error).message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
