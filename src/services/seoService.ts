/**
 * SEO Generation Service using OpenAI
 */

export interface SeoResult {
  titles: string[];
  description: string;
  tags: string;
  raw?: string;
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

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

function normalizeSeoResult(parsed: any, raw: string): SeoResult {
  const titles = Array.isArray(parsed?.titles)
    ? parsed.titles
        .map((title: unknown) => {
          let cleaned = String(title)
            .replace(/^\d+[\.)]\s*/, '')
            .replace(/^[-*•]\s*/, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/^["']|["']$/g, '')
            .replace(/^Title\s*\d*:\s*/i, '')
            .trim();
          return cleaned;
        })
        .filter(Boolean)
        .slice(0, 5)
    : [];

  let description = parsed?.description ? String(parsed.description) : "";
  if (description) {
    description = description
      .replace(/^\s*(Here is the description|Description|Here's the|Here is a).*?[:]/i, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^[-•]\s*/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
  }

  let tags = parsed?.tags ? String(parsed.tags) : "";
  if (tags) {
    tags = tags
      .replace(/^(Tags|Here are the tags|Tag list).*?[:]/i, '')
      .replace(/#/g, '')
      .replace(/\*/g, '')
      .replace(/\s+,/g, ',')
      .replace(/,\s+/g, ', ')
      .trim();
  }

  return {
    titles,
    description,
    tags,
    raw,
  };
}

function parseJsonFromText(text: string): SeoResult | null {
  const cleaned = cleanJsonText(text);

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeSeoResult(parsed, text);
  } catch (error) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return normalizeSeoResult(parsed, text);
      } catch (innerError) {
        // fall through
      }
    }
    return extractFromBrokenJson(text);
  }
}

function extractFromBrokenJson(text: string): SeoResult | null {
  try {
    const titlesMatch = text.match(/"titles"\s*:\s*\[([\s\S]*?)\]/);
    let titles: string[] = [];
    if (titlesMatch && titlesMatch[1]) {
      const titleMatches = titlesMatch[1].match(/"((?:[^"\\]|\\.)*)"/g);
      if (titleMatches) {
        titles = titleMatches.map(t => t.slice(1, -1).replace(/\\"/g, '"'));
      }
    }

    const descMatch = text.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    let description = "";
    if (descMatch && descMatch[1]) {
      description = descMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    }

    const tagsMatch = text.match(/"tags"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    let tags = "";
    if (tagsMatch && tagsMatch[1]) {
      tags = tagsMatch[1].replace(/\\"/g, '"');
    }

    if (titles.length > 0 || description || tags) {
      return normalizeSeoResult({ titles, description, tags }, text);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function buildFallback(text: string): SeoResult {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  const titles = lines
    .filter((line) => /^title/i.test(line) || line.length < 120)
    .slice(0, 5)
    .map((line) =>
      line
        .replace(/^title\s*\d*[:.-]?\s*/i, '')
        .replace(/^\d+[\.)]\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^["']|["']$/g, '')
        .trim()
    )
    .filter(Boolean);

  const tagsLine = lines.find((line) => /tags?:/i.test(line));
  const tags = tagsLine
    ? tagsLine
        .replace(/tags?:\s*/i, "")
        .replace(/#/g, '')
        .replace(/\*/g, '')
        .trim()
    : "youtube, video content, educational, learning";

  const descriptionCandidates = lines.filter((line) => !titles.includes(line) && line !== tagsLine);
  let description = descriptionCandidates.sort((a, b) => b.length - a.length)[0] || text;
  description = description
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-•]\s*/gm, '')
    .trim();

  return {
    titles: titles.length ? titles : ["Discover This Amazing Content Now", "Watch This Mind-Blowing Video Today", "You Won't Believe What Happens Next", "The Ultimate Guide You Need to See", "Everything Changes After This"],
    description: description || "Discover valuable insights and knowledge in this educational video. Learn something new and transform your perspective. Don't forget to like, subscribe, and hit the notification bell for more content!",
    tags: tags,
    raw: text,
  };
}

async function fetchWithRetry(
  endpoint: string,
  options: RequestInit,
  maxRetries: number = 5
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000;

        if (attempt < maxRetries - 1) {
          console.log(
            `Rate limited (429). Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      if (response.ok || attempt === maxRetries - 1) {
        return response;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(
          `Request failed: ${(error as Error).message}. Retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export async function generateYoutubeSeo(script: string, apiKey: string): Promise<SeoResult> {
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured");
  }

  try {
    console.log("Generating SEO content with OpenAI...");
    const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const jsonText = json?.choices?.[0]?.message?.content || "";

    console.log("OpenAI Raw Response:", jsonText);

    const cleanedJsonText = cleanJsonText(jsonText);

    const directParsed = parseJsonFromText(cleanedJsonText);
    if (directParsed) {
      return directParsed;
    }

    if (cleanedJsonText.startsWith('{') && cleanedJsonText.endsWith('}')) {
      console.warn("Failed to parse JSON response, and regex extraction also failed.");
      return {
        titles: [],
        description: "",
        tags: "",
        raw: jsonText,
      };
    }

    return buildFallback(jsonText || JSON.stringify(json));
  } catch (error) {
    console.error("OpenAI SEO generation error:", error);
    throw error;
  }
}

export function buildSeoHistoryItem(script: string, seo: SeoResult) {
  const randomId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  };

  return {
    id: randomId(),
    script,
    titles: seo.titles,
    description: seo.description,
    tags: seo.tags,
    timestamp: Date.now(),
  };
}
