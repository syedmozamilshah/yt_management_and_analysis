import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WEBSUB_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe'
const WEBHOOK_CALLBACK_URL = 'https://baffhoalkllpeugluyon.supabase.co/functions/v1/webhooks-youtube'

interface RenewalResult {
  channel_id: string;
  channel_name: string | null;
  success: boolean;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting WebSub subscription renewal job...')

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get channels needing renewal (expiring in next 24 hours, belonging to active users)
    const { data: channelsToRenew, error: fetchError } = await supabase
      .rpc('get_channels_needing_renewal')

    if (fetchError) {
      console.error('Error fetching channels for renewal:', fetchError)
      throw fetchError
    }

    console.log(`Found ${channelsToRenew?.length || 0} channels needing renewal`)

    if (!channelsToRenew || channelsToRenew.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No channels need renewal',
          renewed: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: RenewalResult[] = []
    let renewed = 0
    let failed = 0

    for (const channel of channelsToRenew) {
      try {
        console.log(`Renewing subscription for channel: ${channel.channel_id} (${channel.channel_name})`)

        const topicUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`

        const formData = new URLSearchParams({
          'hub.mode': 'subscribe',
          'hub.topic': topicUrl,
          'hub.callback': WEBHOOK_CALLBACK_URL,
          'hub.verify': 'async'
        })

        const hubResponse = await fetch(WEBSUB_HUB_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        })

        const hubResponseText = await hubResponse.text()

        // Log the renewal attempt
        await supabase.from('websub_subscription_logs').insert({
          channel_id: channel.channel_id,
          action: 'renew',
          status: hubResponse.ok ? 'pending' : 'failed',
          hub_response: `Status: ${hubResponse.status}, Body: ${hubResponseText}`
        })

        if (hubResponse.ok) {
          console.log(`Renewal request sent for ${channel.channel_id}`)
          renewed++
          results.push({
            channel_id: channel.channel_id,
            channel_name: channel.channel_name,
            success: true
          })
        } else {
          console.error(`Renewal failed for ${channel.channel_id}: ${hubResponse.status}`)
          failed++
          results.push({
            channel_id: channel.channel_id,
            channel_name: channel.channel_name,
            success: false,
            error: `Hub returned ${hubResponse.status}`
          })
        }

        // Small delay between requests to be nice to the hub
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error renewing ${channel.channel_id}:`, error)
        failed++
        results.push({
          channel_id: channel.channel_id,
          channel_name: channel.channel_name,
          success: false,
          error: errorMessage
        })

        // Log the error
        await supabase.from('websub_subscription_logs').insert({
          channel_id: channel.channel_id,
          action: 'renew',
          status: 'failed',
          error_message: errorMessage
        })
      }
    }

    console.log(`Renewal job completed. Renewed: ${renewed}, Failed: ${failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${channelsToRenew.length} channels`,
        renewed,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process renewals'
    console.error('Error in renew-websub-subscriptions:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
