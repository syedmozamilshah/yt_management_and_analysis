import { supabase } from '@/integrations/supabase/client';

const SCRAPINGBEE_API_KEY = import.meta.env.VITE_SCRAPINGBEE_API_KEY;
const SEARCHAPI_API_KEY = import.meta.env.VITE_SEARCHAPI_API_KEY;

export interface TranscriptResult {
  videoId: string;
  transcript: string;
}

/**
 * Fetch YouTube video transcript using multiple methods
 * Priority: 1. SearchAPI (best quality) 2. Supabase Edge Function (YouTube API) 3. ScrapingBee API
 */
export async function getVideoTranscript(videoId: string): Promise<TranscriptResult> {
  console.log(`Fetching transcript for video: ${videoId}`);
  
  // Try SearchAPI first (best quality and reliability)
  if (SEARCHAPI_API_KEY) {
    try {
      const result = await fetchViaSearchAPI(videoId);
      if (result.transcript && result.transcript.length > 0) {
        console.log('Transcript fetched via SearchAPI');
        return result;
      }
    } catch (error) {
      console.warn('SearchAPI failed:', error);
    }
  }
  
  // Try Supabase Edge Function (YouTube API)
  try {
    const result = await fetchViaSupabase(videoId);
    if (result.transcript && result.transcript.length > 0) {
      console.log('Transcript fetched via Supabase Edge Function');
      return result;
    }
  } catch (error) {
    console.warn('Supabase Edge Function failed:', error);
  }
  
  // Try ScrapingBee as fallback
  if (SCRAPINGBEE_API_KEY) {
    try {
      const result = await fetchViaScrapingBee(videoId);
      if (result.transcript && result.transcript.length > 0) {
        console.log('Transcript fetched via ScrapingBee');
        return result;
      }
    } catch (error) {
      console.warn('ScrapingBee failed:', error);
    }
  }

  throw new Error('No transcript available for this video. The video may not have captions enabled, or the transcript service is temporarily unavailable.');
}

/**
 * Fetch transcript using SearchAPI (YouTube Transcripts engine)
 * Best quality and most reliable
 */
async function fetchViaSearchAPI(videoId: string): Promise<TranscriptResult> {
  console.log('Fetching from SearchAPI...');
  
  const params = new URLSearchParams({
    engine: 'youtube_transcripts',
    video_id: videoId,
    api_key: SEARCHAPI_API_KEY,
  });

  const url = `https://www.searchapi.io/api/v1/search?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SearchAPI error:', response.status, errorText);
    throw new Error(`SearchAPI error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.transcripts || data.transcripts.length === 0) {
    throw new Error('No transcripts found in SearchAPI response');
  }

  // Join all transcript segments into single text
  const transcript = data.transcripts
    .map((segment: any) => segment.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!transcript || transcript.length === 0) {
    throw new Error('Empty transcript received from SearchAPI');
  }

  return { videoId, transcript };
}

/**
 * Fetch transcript using Supabase Edge Function (no CORS)
 */
async function fetchViaSupabase(videoId: string): Promise<TranscriptResult> {
  console.log('Fetching from Supabase Edge Function...');
  
  const { data, error } = await supabase.functions.invoke('get-transcript', {
    body: { videoId }
  });

  if (error) {
    throw new Error(`Supabase function error: ${error.message}`);
  }

  if (!data || !data.transcript || data.transcript.length === 0) {
    throw new Error(data?.error || 'Empty transcript received');
  }

  return { videoId, transcript: data.transcript };
}

/**
 * Fetch transcript using ScrapingBee YouTube Transcript API
 * API Documentation: https://app.scrapingbee.com/api/v1/youtube/transcript
 */
async function fetchViaScrapingBee(videoId: string): Promise<TranscriptResult> {
  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_API_KEY,
    video_id: videoId,
  });

  // Use proxy in development to avoid CORS, direct URL in production
  const baseUrl = import.meta.env.DEV
    ? '/api/scrapingbee/youtube/transcript'
    : 'https://app.scrapingbee.com/api/v1/youtube/transcript';
  const url = `${baseUrl}?${params.toString()}`;
  console.log('Fetching from ScrapingBee...', import.meta.env.DEV ? '(via proxy)' : '(direct)');

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ScrapingBee error:', response.status, errorText);
    throw new Error(`ScrapingBee API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('ScrapingBee response keys:', Object.keys(data));
  console.log('ScrapingBee data preview:', JSON.stringify(data).substring(0, 500));

  // Parse response - ScrapingBee returns { text: "...", transcript: [...] }
  let transcript = '';
  
  // Try the "text" field first (full transcript as single string) - this is the primary field
  if (data.text && typeof data.text === 'string' && data.text.trim().length > 0) {
    transcript = data.text.trim();
    console.log('Using text field, length:', transcript.length);
  }
  // Fall back to "transcript" array if text is empty
  else if (data.transcript && Array.isArray(data.transcript) && data.transcript.length > 0) {
    transcript = data.transcript
      .map((segment: any) => {
        // Skip empty/header segments
        if (!segment || !segment.snippet) return '';
        
        // Extract text from snippet.runs array
        if (segment.snippet?.runs && Array.isArray(segment.snippet.runs)) {
          return segment.snippet.runs
            .map((run: any) => run.text || '')
            .filter(Boolean)
            .join('');
        }
        
        // Fallback: direct text property
        if (segment.text) return segment.text;
        
        return '';
      })
      .filter((text: string) => text && text.trim().length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.log('Using transcript array, length:', transcript.length);
  }

  if (!transcript) {
    throw new Error('ScrapingBee returned empty transcript');
  }

  console.log(`ScrapingBee transcript: ${transcript.length} chars`);
  return { videoId, transcript };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n/g, ' ');
}

/**
 * Fetch transcript from URL
 */
export async function getTranscriptFromUrl(videoUrl: string): Promise<TranscriptResult> {
  // Extract video ID from URL
  const urlMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/);
  if (!urlMatch) {
    throw new Error('Could not extract video ID from URL');
  }
  return getVideoTranscript(urlMatch[1]);
}

// Default AI prompts
export const DEFAULT_AI_PROMPTS = {
  claude: `You are a YouTube content strategist expert. I'm going to provide you with a transcript of a viral YouTube video. Analyze this transcript and provide:

1. **Hook Analysis**: What hook did they use in the first 30 seconds? Why is it effective?
2. **Content Structure**: How is the video structured? What pattern do they follow?
3. **Engagement Tactics**: What techniques do they use to keep viewers watching?
4. **Key Takeaways**: What makes this video successful from a content perspective?
5. **Replication Strategy**: How can I create similar content in my niche while maintaining originality?

Here's the transcript:

`,
  gemini: `You are a YouTube content strategist expert. I'm going to provide you with a transcript of a viral YouTube video. Analyze this transcript and provide:

1. **Hook Analysis**: What hook did they use in the first 30 seconds? Why is it effective?
2. **Content Structure**: How is the video structured? What pattern do they follow?
3. **Engagement Tactics**: What techniques do they use to keep viewers watching?
4. **Key Takeaways**: What makes this video successful from a content perspective?
5. **Replication Strategy**: How can I create similar content in my niche while maintaining originality?

Here's the transcript:

`,
  gpt: `You are a YouTube content strategist expert. I'm going to provide you with a transcript of a viral YouTube video. Analyze this transcript and provide:

1. **Hook Analysis**: What hook did they use in the first 30 seconds? Why is it effective?
2. **Content Structure**: How is the video structured? What pattern do they follow?
3. **Engagement Tactics**: What techniques do they use to keep viewers watching?
4. **Key Takeaways**: What makes this video successful from a content perspective?
5. **Replication Strategy**: How can I create similar content in my niche while maintaining originality?

Here's the transcript:

`
};

// Storage key for custom prompts
const AI_PROMPTS_STORAGE_KEY = 'video_stash_ai_prompts';

/**
 * Get AI prompts from localStorage
 */
export function getAIPrompts(): typeof DEFAULT_AI_PROMPTS {
  try {
    const stored = localStorage.getItem(AI_PROMPTS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_AI_PROMPTS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error reading AI prompts:', e);
  }
  return DEFAULT_AI_PROMPTS;
}

/**
 * Save AI prompts to localStorage
 */
export function saveAIPrompts(prompts: Partial<typeof DEFAULT_AI_PROMPTS>): void {
  try {
    const current = getAIPrompts();
    const updated = { ...current, ...prompts };
    localStorage.setItem(AI_PROMPTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving AI prompts:', e);
  }
}

/**
 * Get the display name for an AI tool
 */
function getAIToolName(aiTool: 'claude' | 'gemini' | 'gpt'): string {
  switch (aiTool) {
    case 'claude':
      return 'Claude';
    case 'gemini':
      return 'Gemini';
    case 'gpt':
      return 'ChatGPT';
    default:
      return 'AI Tool';
  }
}

/**
 * Get the URL for an AI tool
 */
function getAIToolUrl(aiTool: 'claude' | 'gemini' | 'gpt'): string {
  switch (aiTool) {
    case 'claude':
      return 'https://claude.ai/new';
    case 'gemini':
      return 'https://gemini.google.com/app';
    case 'gpt':
      return 'https://chat.openai.com/';
    default:
      return '';
  }
}

/**
 * Clipboard helper with fallback for non-secure contexts
 */
async function copyToClipboardFallback(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, trying fallback:', err);
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

/**
 * Open AI tool with prompt and transcript
 * Copies the prompt + transcript to clipboard, shows a toast, waits 1.5s, then opens the AI tool
 */
export async function openAIWithTranscript(
  aiTool: 'claude' | 'gemini' | 'gpt',
  transcript: string,
  showToast?: (options: { title: string; description: string }) => void
): Promise<void> {
  const prompts = getAIPrompts();
  const fullPrompt = prompts[aiTool] + transcript;
  const toolName = getAIToolName(aiTool);
  const url = getAIToolUrl(aiTool);
  
  if (!url) return;
  
  try {
    // Copy prompt + transcript to clipboard using fallback-safe method
    const success = await copyToClipboardFallback(fullPrompt);
    
    // Show toast notification if callback provided
    if (showToast) {
      showToast({
        title: success ? "Copied to Clipboard!" : "Could not copy",
        description: success 
          ? `Transcript with Prompt has been copied. Opening ${toolName}... Use Ctrl+V to paste in ${toolName}.`
          : `Opening ${toolName}... You may need to copy the transcript manually.`
      });
    }
    
    // Wait 3 seconds before opening the AI tool (so user can read the toast)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Open the AI tool in a new tab
    window.open(url, '_blank');
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Still open the AI tool even if clipboard fails
    window.open(url, '_blank');
  }
}
