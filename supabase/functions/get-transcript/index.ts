import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoId } = await req.json()

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Video ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Fetching transcript for video:', videoId)

    // First, fetch the video page to extract player response
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const pageResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cookie': 'CONSENT=YES+cb.20210720-07-p0.en+FX+{}'.replace('{}', String(Math.floor(Math.random() * 1000))),
      }
    })

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`)
    }

    const html = await pageResponse.text()
    
    // Extract ytInitialPlayerResponse
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/)
    if (!playerResponseMatch) {
      // Try alternative pattern
      const altMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/)
      if (!altMatch) {
        console.log('Could not find player response in page')
        return new Response(
          JSON.stringify({ error: 'Could not extract video data', transcript: '', videoId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let playerResponse: any
    try {
      const jsonStr = playerResponseMatch ? playerResponseMatch[1] : ''
      playerResponse = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse player response:', e)
      return new Response(
        JSON.stringify({ error: 'Failed to parse video data', transcript: '', videoId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caption tracks
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    
    if (!captions || captions.length === 0) {
      console.log('No captions found in player response')
      return new Response(
        JSON.stringify({ error: 'No captions available for this video', transcript: '', videoId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found caption tracks:', captions.length)

    // Find English caption or first available
    const captionTrack = captions.find((t: any) => 
      t.languageCode === 'en' || t.languageCode?.startsWith('en')
    ) || captions[0]

    if (!captionTrack?.baseUrl) {
      return new Response(
        JSON.stringify({ error: 'No caption URL found', transcript: '', videoId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch captions XML
    const captionUrl = captionTrack.baseUrl
    console.log('Fetching captions from:', captionUrl)
    
    const captionResponse = await fetch(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    })

    if (!captionResponse.ok) {
      throw new Error(`Failed to fetch captions: ${captionResponse.status}`)
    }

    const captionXml = await captionResponse.text()
    console.log('Caption XML length:', captionXml.length)

    // Parse XML to extract text
    const segments: string[] = []
    const textMatches = [...captionXml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    
    for (const match of textMatches) {
      const text = decodeHtmlEntities(match[1])
      if (text.trim()) {
        segments.push(text)
      }
    }

    const transcript = segments.join(' ').replace(/\s+/g, ' ').trim()
    console.log(`Transcript: ${transcript.length} chars, ${segments.length} segments`)

    return new Response(
      JSON.stringify({ 
        videoId,
        transcript,
        language: captionTrack.languageCode || 'en',
        segments: segments.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error fetching transcript:', error)
    return new Response(
      JSON.stringify({ error: error.message, transcript: '' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\n/g, ' ')
}
