
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TitleGenerationRequest {
  userScript: string;
  scriptAnalysis: ScriptAnalysis;
  dataSource?: 'outliers' | 'favorites';
  customAuthority?: string;
  authorityVsAuthority?: { authority1: string; authority2: string };
}

interface ScriptAnalysis {
  mainTopic: string;
  mainAuthority: string;
  authorityVsAuthority: {
    authority1: string;
    authority2: string;
    relationship: string;
  } | null;
  contentType: string;
  niche: string;
}

interface PatternAnalysis {
  commonPatterns: string[];
  workingStatements: string[];
  titleStructures: string[];
}

interface GeneratedTitleWithAnalysis {
  title: string;
  adaptedFrom: string;
  patterns: string[];
  statements: string[];
  authorityReplacement: string;
}

// Helper function to clean and parse JSON from OpenAI responses
function cleanAndParseJSON(text: string): any {
  console.log('Original response text:', text);
  
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // If the response starts with some explanation text, try to find the JSON part
  const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
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
    
    // Try to extract titles using regex as fallback
    const titleMatches = text.match(/"title":\s*"([^"]+)"/g);
    if (titleMatches) {
      console.log('Using regex fallback, found title matches:', titleMatches);
      return titleMatches.map((match, index) => {
        const titleMatch = match.match(/"title":\s*"([^"]+)"/);
        return {
          title: titleMatch ? titleMatch[1] : `Generated Title ${index + 1}`,
          adaptedFrom: '',
          patterns: [],
          statements: [],
          authorityReplacement: ''
        };
      });
    }
    
    throw new Error('Invalid JSON response from AI');
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { userScript, scriptAnalysis, dataSource = 'outliers', customAuthority, authorityVsAuthority } = await req.json() as TitleGenerationRequest;
    
    console.log('Generating titles with pre-analyzed data:', scriptAnalysis);
    console.log('Data source:', dataSource);
    console.log('Custom authority:', customAuthority);
    console.log('Authority vs Authority:', authorityVsAuthority);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare custom authorities for analysis
    let customAuthorities: string[] = [];
    if (customAuthority) {
      customAuthorities.push(customAuthority);
    }
    if (authorityVsAuthority) {
      customAuthorities.push(authorityVsAuthority.authority1, authorityVsAuthority.authority2);
    }
    
    // Add authorities from script analysis
    if (scriptAnalysis.mainAuthority) {
      customAuthorities.push(scriptAnalysis.mainAuthority);
    }
    if (scriptAnalysis.authorityVsAuthority) {
      customAuthorities.push(scriptAnalysis.authorityVsAuthority.authority1, scriptAnalysis.authorityVsAuthority.authority2);
    }

    // Add custom authorities to the analysis
    const enhancedScriptAnalysis = {
      ...scriptAnalysis,
      authorities: [...new Set(customAuthorities)],
      keywords: [scriptAnalysis.mainTopic, scriptAnalysis.contentType, scriptAnalysis.niche].filter(Boolean)
    };

    // Fetch ALL relevant videos based on data source
    let allRelevantVideos: any[] = [];
    let totalAnalyzedCount = 0;

    if (dataSource === 'favorites') {
      // Query ALL favorite videos (no limit)
      const { data: favoriteVideos, error: favoriteError } = await supabaseClient
        .from('videos')
        .select('id, title, view_count, channel_subscribers, niche, youtube_url, thumbnail_url, channel_name, upload_date')
        .eq('is_favorite', true)
        .order('view_count', { ascending: false });

      if (favoriteError) {
        console.error('Error fetching favorite videos:', favoriteError);
        return new Response(JSON.stringify({ error: 'Failed to fetch favorite videos' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      allRelevantVideos = favoriteVideos || [];
      console.log(`Found ${allRelevantVideos.length} total favorite videos`);

      // If user has very few favorites, suggest using outliers instead
      if (allRelevantVideos.length < 5) {
        return new Response(JSON.stringify({ 
          error: 'Not enough favorite videos. Please add at least 5 favorites or use the outliers database.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter for high-performing videos from ALL favorites
      const successfulVideos = allRelevantVideos.filter(video => 
        video.view_count && video.channel_subscribers && 
        (video.view_count > video.channel_subscribers * 0.1 || video.view_count > 10000)
      );

      // Set the total analyzed count to ALL favorites that were processed
      totalAnalyzedCount = allRelevantVideos.length;
      allRelevantVideos = successfulVideos;
      
      console.log(`Analyzed ${totalAnalyzedCount} favorite videos, ${allRelevantVideos.length} passed performance filtering`);
    } else {
      // Use existing outliers logic with limits
      // Filter by niche if detected
      if (enhancedScriptAnalysis.niche) {
        const { data: nicheVideos, error: nicheError } = await supabaseClient
          .from('videos')
          .select('id, title, view_count, channel_subscribers, niche, youtube_url, thumbnail_url, channel_name, upload_date')
          .ilike('niche', `%${enhancedScriptAnalysis.niche}%`)
          .order('view_count', { ascending: false })
          .limit(50);

        if (!nicheError && nicheVideos) {
          allRelevantVideos = nicheVideos;
          console.log(`Found ${allRelevantVideos.length} videos by niche: ${enhancedScriptAnalysis.niche}`);
        }
      }

      // Search by keywords in titles if needed
      if (allRelevantVideos.length < 10 && enhancedScriptAnalysis.keywords.length > 0) {
        const keywordSearchTerms = enhancedScriptAnalysis.keywords.slice(0, 3);
        
        for (const keyword of keywordSearchTerms) {
          const { data: keywordVideos, error: keywordError } = await supabaseClient
            .from('videos')
            .select('id, title, view_count, channel_subscribers, niche, youtube_url, thumbnail_url, channel_name, upload_date')
            .ilike('title', `%${keyword}%`)
            .order('view_count', { ascending: false })
            .limit(30);

          if (!keywordError && keywordVideos) {
            keywordVideos.forEach(video => {
              if (!allRelevantVideos.find(v => v.id === video.id)) {
                allRelevantVideos.push(video);
              }
            });
          }
        }
        console.log(`After keyword search, found ${allRelevantVideos.length} relevant videos`);
      }

      // Fallback: Get top performing videos if insufficient results
      if (allRelevantVideos.length < 8) {
        const { data: fallbackVideos, error: fallbackError } = await supabaseClient
          .from('videos')
          .select('id, title, view_count, channel_subscribers, niche, youtube_url, thumbnail_url, channel_name, upload_date')
          .order('view_count', { ascending: false })
          .limit(30);

        if (!fallbackError && fallbackVideos) {
          fallbackVideos.forEach(video => {
            if (!allRelevantVideos.find(v => v.id === video.id)) {
              allRelevantVideos.push(video);
            }
          });
        }
        console.log(`After fallback, total videos: ${allRelevantVideos.length}`);
      }

      // Filter for high-performing videos
      const successfulVideos = allRelevantVideos.filter(video => 
        video.view_count && video.channel_subscribers && 
        (video.view_count > video.channel_subscribers * 0.1 || video.view_count > 10000)
      );

      totalAnalyzedCount = allRelevantVideos.length;
      allRelevantVideos = successfulVideos;
    }

    // For pattern analysis, use ALL qualifying videos (not limited to 8)
    const videosForPatternAnalysis = allRelevantVideos;
    
    // For display in results, select up to 8 representative videos
    const referenceVideosForDisplay = allRelevantVideos.slice(0, 8);
    
    console.log(`Total videos analyzed: ${totalAnalyzedCount}`);
    console.log(`Videos used for pattern analysis: ${videosForPatternAnalysis.length}`);
    console.log(`Reference videos for display: ${referenceVideosForDisplay.length}`);

    // Analyze patterns from ALL qualifying video titles
    const dataSourceContext = dataSource === 'favorites' 
      ? "user's personally curated favorite videos" 
      : "viral outlier videos that broke through subscriber barriers";

    const patternAnalysisPrompt = `Analyze these successful video titles from ${dataSourceContext} and extract reusable patterns, statements, and structures. Return a JSON object with:
- commonPatterns: Array of specific phrases/patterns that appear across multiple titles (e.g., "How to", "X vs Y", "Why X", "The Truth About")
- workingStatements: Array of powerful statements/phrases that make titles compelling (e.g., "Changed Everything", "Nobody Talks About", "Finally Revealed")
- titleStructures: Array of structural templates (e.g., "[AUTHORITY] Says [CLAIM]", "[NUMBER] [THINGS] That [OUTCOME]")

Titles to analyze (${videosForPatternAnalysis.length} total):
${videosForPatternAnalysis.map((video, i) => `${i + 1}. "${video.title}"`).join('\n')}

Return only valid JSON, no other text.`;

    const patternResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: patternAnalysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    const patternData = await patternResponse.json();
    const patternText = patternData.choices[0]?.message?.content || '{}';
    
    let patternAnalysis: PatternAnalysis;
    try {
      patternAnalysis = cleanAndParseJSON(patternText);
    } catch (e) {
      console.error('Failed to parse pattern analysis:', patternText);
      patternAnalysis = {
        commonPatterns: [],
        workingStatements: [],
        titleStructures: []
      };
    }

    console.log('Pattern analysis result:', patternAnalysis);

    // Prepare authority context for title generation
    let authorityContext = '';
    if (customAuthority) {
      authorityContext += `\n- Use this authority: ${customAuthority}`;
    }
    if (authorityVsAuthority) {
      authorityContext += `\n- Create "vs" titles using: ${authorityVsAuthority.authority1} vs ${authorityVsAuthority.authority2}`;
    }

    // Generate titles with pattern tracking (using a representative sample for the prompt)
    const sampleTitlesForPrompt = videosForPatternAnalysis.slice(0, 12); // Use up to 12 for prompt readability
    
    const titleGenerationPrompt = `You are a YouTube title optimizer specializing in pattern adaptation and authority replacement.

SCRIPT ANALYSIS:
- Main Topic: ${enhancedScriptAnalysis.mainTopic}
- Content Type: ${enhancedScriptAnalysis.contentType}
- Niche: ${enhancedScriptAnalysis.niche || 'General'}
- Key Terms: ${enhancedScriptAnalysis.keywords.join(', ')}
- Authorities in Script: ${enhancedScriptAnalysis.authorities.join(', ')}${authorityContext}

DATA SOURCE: ${dataSourceContext} (analyzed ${totalAnalyzedCount} videos total)

SUCCESSFUL PATTERNS IDENTIFIED:
- Common Patterns: ${patternAnalysis.commonPatterns.join(', ')}
- Working Statements: ${patternAnalysis.workingStatements.join(', ')}
- Title Structures: ${patternAnalysis.titleStructures.join(', ')}

REFERENCE TITLES FOR PATTERN ADAPTATION (sample from ${videosForPatternAnalysis.length} analyzed):
${sampleTitlesForPrompt.map((video, i) => `${i + 1}. "${video.title}"`).join('\n')}

USER'S CONTENT: ${userScript.substring(0, 400)}...

INSTRUCTIONS:
1. Create 8 new titles by adapting the EXACT patterns, statements, and structures from the reference titles
2. Replace authorities in reference titles with authorities from the user's script when possible
3. Keep the proven patterns/statements EXACTLY as they appear in successful titles
4. For each generated title, identify which specific patterns/statements/structures were borrowed
5. ${dataSource === 'favorites' ? 'Since these patterns come from the user\'s favorites, they should align with their personal taste and style' : 'Use viral patterns proven to break through subscriber barriers'}

You must respond with ONLY a valid JSON array. No markdown, no explanations, no other text. Format:
[
  {
    "title": "Generated title text",
    "adaptedFrom": "Original reference title",
    "patterns": ["exact pattern used"],
    "statements": ["exact statement used"],
    "authorityReplacement": "Original Authority → New Authority (if any)"
  }
]`;

    const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube title optimization expert. You must respond with ONLY a valid JSON array. No markdown formatting, no code blocks, no explanations, no additional text whatsoever. Just the raw JSON array.'
          },
          {
            role: 'user',
            content: titleGenerationPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!titleResponse.ok) {
      console.error('OpenAI title generation error:', await titleResponse.text());
      return new Response(JSON.stringify({ error: 'Failed to generate titles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const titleData = await titleResponse.json();
    const generatedText = titleData.choices[0]?.message?.content || '';
    
    console.log('Raw title generation response:', generatedText);
    
    let titlesWithAnalysis: GeneratedTitleWithAnalysis[];
    try {
      const cleanedResponse = cleanAndParseJSON(generatedText);
      // Ensure we have an array of titles
      if (Array.isArray(cleanedResponse)) {
        titlesWithAnalysis = cleanedResponse;
      } else if (cleanedResponse.titles && Array.isArray(cleanedResponse.titles)) {
        titlesWithAnalysis = cleanedResponse.titles;
      } else {
        throw new Error('Response is not an array');
      }
      
      // Ensure each title has all required properties
      titlesWithAnalysis = titlesWithAnalysis.map(title => ({
        title: title.title || 'Generated Title',
        adaptedFrom: title.adaptedFrom || '',
        patterns: Array.isArray(title.patterns) ? title.patterns : [],
        statements: Array.isArray(title.statements) ? title.statements : [],
        authorityReplacement: title.authorityReplacement || ''
      }));
      
    } catch (e) {
      console.error('Failed to parse title generation response:', generatedText);
      console.error('Parse error:', e);
      
      // Create fallback titles if parsing completely fails
      titlesWithAnalysis = Array.from({ length: 8 }, (_, i) => ({
        title: `${enhancedScriptAnalysis.mainTopic} - Title ${i + 1}`,
        adaptedFrom: '',
        patterns: [],
        statements: [],
        authorityReplacement: ''
      }));
    }

    console.log('Final processed titles:', titlesWithAnalysis);

    // Store the generation in database
    const { error: insertError } = await supabaseClient
      .from('title_generations')
      .insert({
        user_script: userScript,
        generated_titles: titlesWithAnalysis.map(t => t.title),
        selected_niche: enhancedScriptAnalysis.niche,
      });

    if (insertError) {
      console.error('Error storing generation:', insertError);
    }

    return new Response(JSON.stringify({
      titles: titlesWithAnalysis,
      scriptAnalysis: enhancedScriptAnalysis,
      patternAnalysis,
      dataSource,
      totalAnalyzed: totalAnalyzedCount, // This is the key addition - total videos analyzed
      referenceVideos: referenceVideosForDisplay.map(video => ({
        id: video.id,
        title: video.title,
        youtube_url: video.youtube_url,
        thumbnail_url: video.thumbnail_url,
        view_count: video.view_count,
        channel_subscribers: video.channel_subscribers,
        channel_name: video.channel_name,
        niche: video.niche,
        upload_date: video.upload_date
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-titles function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
