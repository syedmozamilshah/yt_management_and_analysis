import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { makeYouTubeApiRequest } from '../_shared/youtube-api-keys.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fetch view count for a single video (1 quota unit per 50 videos)
async function fetchVideoViewCount(videoId: string): Promise<number | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`
    const response = await makeYouTubeApiRequest(url)
    
    if (!response.ok) {
      console.error(`YouTube API error: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    
    if (data.items && data.items.length > 0) {
      return parseInt(data.items[0].statistics?.viewCount || '0', 10)
    }
    
    return null
  } catch (error) {
    console.error('Error fetching view count:', error)
    return null
  }
}

// Simple XML parser for Atom feeds
function parseAtomEntry(xml: string): {
  videoId: string | null;
  channelId: string | null;
  title: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  link: string | null;
} {
  const result = {
    videoId: null as string | null,
    channelId: null as string | null,
    title: null as string | null,
    publishedAt: null as string | null,
    updatedAt: null as string | null,
    link: null as string | null,
  }

  // Extract video ID from yt:videoId
  const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)
  if (videoIdMatch) {
    result.videoId = videoIdMatch[1].trim()
  }

  // Extract channel ID from yt:channelId
  const channelIdMatch = xml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i)
  if (channelIdMatch) {
    result.channelId = channelIdMatch[1].trim()
  }

  // Extract title
  const titleMatch = xml.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }

  // Extract published date
  const publishedMatch = xml.match(/<published>([^<]+)<\/published>/i)
  if (publishedMatch) {
    result.publishedAt = publishedMatch[1].trim()
  }

  // Extract updated date
  const updatedMatch = xml.match(/<updated>([^<]+)<\/updated>/i)
  if (updatedMatch) {
    result.updatedAt = updatedMatch[1].trim()
  }

  // Extract link
  const linkMatch = xml.match(/<link[^>]*href="([^"]+)"[^>]*>/i)
  if (linkMatch) {
    result.link = linkMatch[1].trim()
  }

  return result
}

// Parse multiple entries from feed
function parseAtomFeed(xml: string): Array<ReturnType<typeof parseAtomEntry>> {
  const entries: Array<ReturnType<typeof parseAtomEntry>> = []
  
  // Find all entry elements
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = parseAtomEntry(match[1])
    if (entry.videoId && entry.channelId) {
      entries.push(entry)
    }
  }
  
  return entries
}

serve(async (req: Request) => {
  const url = new URL(req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // ============================================
  // Handle WebSub Verification (GET request)
  // ============================================
  if (req.method === 'GET') {
    const hubChallenge = url.searchParams.get('hub.challenge')
    const hubMode = url.searchParams.get('hub.mode')
    const hubTopic = url.searchParams.get('hub.topic')
    const hubLeaseSeconds = url.searchParams.get('hub.lease_seconds')

    console.log('WebSub verification request:', { hubMode, hubTopic, hubChallenge: hubChallenge?.substring(0, 20) })

    if (hubChallenge) {
      // Log the verification event
      await supabase.from('webhook_events').insert({
        event_type: 'verification',
        channel_id: hubTopic ? extractChannelIdFromTopic(hubTopic) : null,
        payload: JSON.stringify({ hubMode, hubTopic, hubLeaseSeconds }),
        processed: true
      })

      // If subscribing, update the subscription status
      if (hubMode === 'subscribe' && hubTopic) {
        const channelId = extractChannelIdFromTopic(hubTopic)
        if (channelId) {
          const leaseSeconds = hubLeaseSeconds ? parseInt(hubLeaseSeconds) : 432000 // Default 5 days
          const expiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString()
          
          await supabase
            .from('tracked_channels')
            .update({
              webhook_subscribed: true,
              subscription_expires_at: expiresAt,
              updated_at: new Date().toISOString()
            })
            .eq('channel_id', channelId)

          // Log subscription success
          await supabase.from('websub_subscription_logs').insert({
            channel_id: channelId,
            action: 'verify',
            status: 'success',
            hub_response: `Lease: ${leaseSeconds}s, Expires: ${expiresAt}`
          })

          console.log(`Subscription verified for channel ${channelId}, expires at ${expiresAt}`)
        }
      } else if (hubMode === 'unsubscribe' && hubTopic) {
        const channelId = extractChannelIdFromTopic(hubTopic)
        if (channelId) {
          await supabase
            .from('tracked_channels')
            .update({
              webhook_subscribed: false,
              subscription_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('channel_id', channelId)

          console.log(`Unsubscribe verified for channel ${channelId}`)
        }
      }

      // Return the challenge as plain text (CRITICAL: no JSON, no formatting)
      return new Response(hubChallenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    return new Response('Missing hub.challenge', { status: 400 })
  }

  // ============================================
  // Handle WebSub Notification (POST request)
  // ============================================
  if (req.method === 'POST') {
    try {
      const contentType = req.headers.get('content-type') || ''
      const body = await req.text()

      console.log('WebSub notification received, content-type:', contentType)
      console.log('Body length:', body.length)

      // Log raw event for debugging
      await supabase.from('webhook_events').insert({
        event_type: 'notification',
        payload: body.substring(0, 10000), // Limit payload size
        processed: false
      })

      // Parse the Atom XML
      if (contentType.includes('xml') || contentType.includes('atom') || body.includes('<feed')) {
        const entries = parseAtomFeed(body)
        console.log('Parsed entries:', entries.length)

        for (const entry of entries) {
          if (!entry.videoId || !entry.channelId) {
            console.log('Skipping entry with missing data:', entry)
            continue
          }

          const youtubeUrl = entry.link || `https://www.youtube.com/watch?v=${entry.videoId}`
          const thumbnailUrl = `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`

          console.log('Processing video:', entry.videoId, entry.title)

          // Check if video already exists (ignore duplicates)
          const { data: existingVideo } = await supabase
            .from('tracked_videos')
            .select('id')
            .eq('video_id', entry.videoId)
            .single()

          if (existingVideo) {
            console.log('Video already exists, skipping:', entry.videoId)
            continue
          }

          // Fetch view count from YouTube API (1 quota unit per video)
          // This is acceptable because webhooks are triggered infrequently (only for new videos)
          console.log('Fetching view count for new video:', entry.videoId)
          const viewCount = await fetchVideoViewCount(entry.videoId)
          console.log('View count fetched:', viewCount)

          // Insert new video WITH view count
          // CRITICAL: Use the RSS published date, not now()
          const publishedAt = entry.publishedAt
          if (!publishedAt) {
            console.warn(`WARNING: No published date for video ${entry.videoId}, skipping to avoid wrong timestamp`)
            continue
          }
          console.log(`Inserting video ${entry.videoId} with published_at: ${publishedAt}`)
          
          const { error: insertError } = await supabase
            .from('tracked_videos')
            .insert({
              video_id: entry.videoId,
              channel_id: entry.channelId,
              title: entry.title || 'Untitled',
              thumbnail_url: thumbnailUrl,
              youtube_url: youtubeUrl,
              published_at: publishedAt,
              view_count: viewCount,
              view_count_updated_at: viewCount !== null ? new Date().toISOString() : null,
              source: 'websub'
            })

          if (insertError) {
            // Handle unique constraint violation gracefully
            if (insertError.code === '23505') {
              console.log('Duplicate video (race condition), skipping:', entry.videoId)
            } else {
              console.error('Error inserting video:', insertError)
            }
          } else {
            console.log('Successfully inserted video:', entry.videoId)
          }

          // Update last_webhook_received_at for the channel
          await supabase
            .from('tracked_channels')
            .update({ 
              last_webhook_received_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('channel_id', entry.channelId)
        }

        // Mark the webhook event as processed
        // Note: This is a simplified approach; in production you might want to track individual entries
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .is('processed', false)
          .order('created_at', { ascending: false })
          .limit(1)
      }

      // Always return 200 to acknowledge receipt
      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error processing webhook:', error)
      
      // Log the error
      await supabase.from('webhook_events').insert({
        event_type: 'error',
        error_message: errorMessage,
        processed: false
      })

      // Still return 200 to prevent retries for parsing errors
      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})

// Helper function to extract channel ID from topic URL
function extractChannelIdFromTopic(topic: string): string | null {
  const match = topic.match(/channel_id=([^&]+)/)
  return match ? match[1] : null
}
