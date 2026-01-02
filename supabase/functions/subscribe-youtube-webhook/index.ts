import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WEBSUB_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe'
const WEBHOOK_CALLBACK_URL = 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/webhooks-youtube'

interface SubscribeRequest {
  channel_id: string;
  mode?: 'subscribe' | 'unsubscribe';
}

interface SubscribeResponse {
  success: boolean;
  channel_id: string;
  mode: string;
  message: string;
  hub_response?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel_id, mode = 'subscribe' }: SubscribeRequest = await req.json()

    if (!channel_id) {
      return new Response(
        JSON.stringify({ error: 'channel_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`WebSub ${mode} request for channel:`, channel_id)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user from the authorization header (optional for cron jobs)
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // Build the topic URL (RSS feed URL)
    const topicUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel_id}`

    // Prepare the WebSub subscription request
    const formData = new URLSearchParams({
      'hub.mode': mode,
      'hub.topic': topicUrl,
      'hub.callback': WEBHOOK_CALLBACK_URL,
      'hub.verify': 'async'
    })

    console.log('Sending WebSub request to hub:', WEBSUB_HUB_URL)
    console.log('Form data:', formData.toString())

    // Send the subscription request to Google's PubSubHubbub hub
    const hubResponse = await fetch(WEBSUB_HUB_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    const hubResponseText = await hubResponse.text()
    console.log('Hub response status:', hubResponse.status)
    console.log('Hub response:', hubResponseText)

    // Log the subscription attempt
    await supabase.from('websub_subscription_logs').insert({
      channel_id,
      action: mode,
      status: hubResponse.ok ? 'pending' : 'failed',
      hub_response: `Status: ${hubResponse.status}, Body: ${hubResponseText}`
    })

    if (!hubResponse.ok) {
      console.error('WebSub hub returned error:', hubResponse.status, hubResponseText)
      
      return new Response(
        JSON.stringify({
          success: false,
          channel_id,
          mode,
          message: `WebSub hub returned status ${hubResponse.status}`,
          hub_response: hubResponseText
        }),
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // For async verification, the hub returns 202 Accepted
    // The actual verification happens when the hub calls our webhook with hub.challenge
    
    if (mode === 'subscribe') {
      // Set pending subscription status
      // subscription_expires_at will be set when we receive the verification callback
      await supabase
        .from('tracked_channels')
        .update({
          webhook_subscribed: false, // Will be true after verification
          updated_at: new Date().toISOString()
        })
        .eq('channel_id', channel_id)

      console.log(`Subscription request sent for channel ${channel_id}, awaiting verification`)
    } else if (mode === 'unsubscribe') {
      console.log(`Unsubscription request sent for channel ${channel_id}`)
    }

    const response: SubscribeResponse = {
      success: true,
      channel_id,
      mode,
      message: mode === 'subscribe' 
        ? 'Subscription request sent. Awaiting hub verification.'
        : 'Unsubscription request sent.',
      hub_response: `Status: ${hubResponse.status}`
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process subscription request'
    console.error('Error in subscribe-youtube-webhook:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
