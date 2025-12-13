import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const systemPrompt = `You are a YouTube SEO expert specializing in creating viral, high-conversion content.

Your job is to generate the following for a YouTube video script:

1. YouTube Titles (5 variations - VS-style)
   - Must create contrast or tension between two people, groups, or ideas
   - Use curiosity, emotional pull, or "power moment" framing
   - Keep it under 90 characters
   - Examples: "Michael Jordan's Powerful Words Left Caitlin Clark SPEECHLESS"
   - NO asterisks, dashes, markdown, or special formatting
   - Output ONLY the title text

2. Educational-Style YouTube Description
   - Summarize the script in a clear, educational tone
   - Explain what the viewer will learn, discover, or understand
   - End with a call to action (subscribe, like, comment)
   - NO asterisks, dashes, markdown, or bullet points
   - NO phrases like "Here is the description"
   - Output ONLY the description content

3. Tags (15-25 tags, comma-separated)
   - Must be relevant to the video topic
   - Must be in simple comma style with no special characters
   - NO hashtags, NO asterisks, NO markdown
   - Format: tag1, tag2, tag3, tag4

Return ONLY valid JSON with this exact structure:
{"titles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"], "description": "Your description text here", "tags": "tag1, tag2, tag3, tag4, tag5"}
CRITICAL: Do not include ANY markdown formatting, asterisks (*), dashes (-), or explanatory text. Output pure, copy-ready content.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { script } = await req.json()

    if (!script) {
      return new Response(
        JSON.stringify({ error: 'Script is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log("Generating SEO content with OpenAI...")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Please generate YouTube SEO content for this script:\n\n${script}`,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("OpenAI API error:", errorText)
      return new Response(
        JSON.stringify({ error: `OpenAI request failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const json = await response.json()
    const jsonText = json?.choices?.[0]?.message?.content || ""

    console.log("OpenAI Raw Response:", jsonText)

    // Parse the JSON response
    let seoResult
    try {
      seoResult = JSON.parse(jsonText)
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        seoResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("Failed to parse SEO result")
      }
    }

    // Normalize the result
    const titles = Array.isArray(seoResult?.titles)
      ? seoResult.titles
          .map((title: unknown) => {
            let cleaned = String(title)
              .replace(/^\d+[\.)]\s*/, '')
              .replace(/^[-*•]\s*/, '')
              .replace(/\*\*/g, '')
              .replace(/\*/g, '')
              .replace(/^["']|["']$/g, '')
              .replace(/^Title\s*\d*:\s*/i, '')
              .trim()
            return cleaned
          })
          .filter(Boolean)
          .slice(0, 5)
      : []

    let description = seoResult?.description ? String(seoResult.description) : ""
    if (description) {
      description = description
        .replace(/^\s*(Here is the description|Description|Here's the|Here is a).*?[:]/i, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[-•]\s*/gm, '')
        .trim()
    }

    let tags = seoResult?.tags ? String(seoResult.tags) : ""
    if (tags) {
      tags = tags
        .replace(/^(Tags|Here are the tags|Tag list).*?[:]/i, '')
        .replace(/#/g, '')
        .replace(/\*/g, '')
        .replace(/\s+,/g, ',')
        .replace(/,\s+/g, ', ')
        .trim()
    }

    return new Response(
      JSON.stringify({
        titles,
        description,
        tags,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-seo function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
