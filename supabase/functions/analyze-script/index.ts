
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScriptAnalysisRequest {
  userScript: string;
}

interface ScriptAnalysis {
  mainTopic: string;
  mainAuthority: string;
  authorityVsAuthority: {
    authority1: string;
    authority2: string;
    relationship: string; // "athlete vs athlete", "athlete vs team", "country vs country", etc.
  } | null;
  contentType: string;
  niche: string;
}

// Helper function to clean and parse JSON from OpenAI responses
function cleanAndParseJSON(text: string): any {
  console.log('Original response text:', text);
  
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // If the response starts with some explanation text, try to find the JSON part
  const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  console.log('Cleaned JSON string:', cleaned);
  
  try {
    const parsed = JSON.parse(cleaned);
    console.log('Successfully parsed JSON:', parsed);
    return parsed;
  } catch (e) {
    console.error('Failed to parse JSON:', cleaned);
    console.error('Parse error:', e);
    throw new Error('Invalid JSON response from AI');
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userScript } = await req.json() as ScriptAnalysisRequest;
    
    console.log('Analyzing script:', userScript.substring(0, 100) + '...');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Script analysis with enhanced authority detection
    const scriptAnalysisPrompt = `Analyze this video script/content and extract key information. Return a JSON object with these fields:

- mainTopic: The primary subject/topic (max 50 chars)
- mainAuthority: The most prominent person, brand, company, or entity mentioned
- authorityVsAuthority: If there's a comparison, conflict, or "vs" scenario, return an object with:
  - authority1: First entity
  - authority2: Second entity  
  - relationship: One of these types: "athlete vs athlete", "athlete vs team", "athlete vs organization", "president vs president", "country vs country", "company vs company", "brand vs brand", "team vs team", "celebrity vs celebrity", "expert vs expert", or "other"
  If no vs/comparison detected, return null
- contentType: Type of content (e.g., "tutorial", "news", "review", "analysis", "story", "interview", "comparison", "debate")
- niche: The content category (e.g., "sports", "politics", "tech", "finance", "fitness", "gaming", "lifestyle", "business", "entertainment")

Examples of authority vs authority detection:
- "Messi vs Ronaldo" → athlete vs athlete
- "Lakers vs Warriors" → team vs team  
- "USA vs China trade war" → country vs country
- "Biden vs Trump" → president vs president
- "Apple vs Samsung" → company vs company
- "LeBron vs the NBA" → athlete vs organization

Script: "${userScript}"

Return only valid JSON, no other text.`;

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: scriptAnalysisPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!analysisResponse.ok) {
      console.error('OpenAI analysis error:', await analysisResponse.text());
      throw new Error('Failed to analyze script content');
    }

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.choices[0]?.message?.content || '{}';
    
    let scriptAnalysis: ScriptAnalysis;
    try {
      scriptAnalysis = cleanAndParseJSON(analysisText);
    } catch (e) {
      console.error('Failed to parse script analysis:', analysisText);
      scriptAnalysis = {
        mainTopic: userScript.substring(0, 50),
        mainAuthority: '',
        authorityVsAuthority: null,
        contentType: 'general',
        niche: ''
      };
    }

    console.log('Script analysis result:', scriptAnalysis);

    return new Response(JSON.stringify({
      scriptAnalysis,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-script function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
