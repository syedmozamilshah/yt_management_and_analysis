/// <reference types="https://deno.land/x/types/index.d.ts" />
// @ts-ignore - Deno types are available at runtime in Supabase Edge Functions

interface ApiKeyStatus {
  key: string;
  isExhausted: boolean;
  lastUsed: Date;
}

class YouTubeApiKeyManager {
  private keys: ApiKeyStatus[] = [];
  private currentIndex = 0;
  private lastResetDate: string;

  constructor() {
    this.initializeKeys();
    this.lastResetDate = new Date().toDateString();
  }

  private initializeKeys() {
    const keyNames = [
      'YOUTUBE_API_KEY',
      'YOUTUBE_API_KEY_1', 
      'YOUTUBE_API_KEY_2',
      'YOUTUBE_API_KEY_3',
      'YOUTUBE_API_KEY_4'
    ];

    this.keys = keyNames
      .map(name => {
        const key = Deno.env.get(name);
        if (key && key.trim() !== '') {
          console.log(`Found API key: ${name}`);
          return key;
        } else {
          console.log(`API key not found or empty: ${name}`);
          return null;
        }
      })
      .filter(key => key !== null)
      .map(key => ({
        key: key!,
        isExhausted: false,
        lastUsed: new Date(0)
      }));

    console.log(`Initialized ${this.keys.length} YouTube API keys from: ${keyNames.join(', ')}`);
  }

  private resetDailyQuotas() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      console.log('Resetting daily quotas for all API keys');
      this.keys.forEach(keyStatus => {
        keyStatus.isExhausted = false;
      });
      this.lastResetDate = today;
      this.currentIndex = 0;
    }
  }

  getCurrentKey(): string | null {
    this.resetDailyQuotas();

    if (this.keys.length === 0) {
      console.error('No YouTube API keys configured');
      return null;
    }

    // Find next available key
    for (let i = 0; i < this.keys.length; i++) {
      const keyIndex = (this.currentIndex + i) % this.keys.length;
      const keyStatus = this.keys[keyIndex];
      
      if (!keyStatus.isExhausted) {
        this.currentIndex = keyIndex;
        keyStatus.lastUsed = new Date();
        console.log(`Using API key ${keyIndex + 1} of ${this.keys.length}`);
        return keyStatus.key;
      }
    }

    console.error('All YouTube API keys are exhausted');
    return null;
  }

  markKeyAsExhausted(apiKey: string) {
    const keyStatus = this.keys.find(k => k.key === apiKey);
    if (keyStatus) {
      keyStatus.isExhausted = true;
      console.log(`Marked API key as exhausted. ${this.getAvailableKeysCount()} keys remaining`);
      
      // Move to next key
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
  }

  getAvailableKeysCount(): number {
    this.resetDailyQuotas();
    return this.keys.filter(k => !k.isExhausted).length;
  }

  getAllKeysExhausted(): boolean {
    this.resetDailyQuotas();
    return this.keys.length > 0 && this.keys.every(k => k.isExhausted);
  }
}

// Create singleton instance
const keyManager = new YouTubeApiKeyManager();

export async function makeYouTubeApiRequest(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts < maxRetries && !keyManager.getAllKeysExhausted()) {
    const apiKey = keyManager.getCurrentKey();
    
    if (!apiKey) {
      throw new Error('No YouTube API keys available');
    }

    const requestUrl = `${url}${url.includes('?') ? '&' : '?'}key=${apiKey}`;
    
    try {
      console.log(`YouTube API request attempt ${attempts + 1}/${maxRetries}`);
      const response = await fetch(requestUrl);
      
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded' || 
            errorData.error?.message?.includes('quota')) {
          console.log('Quota exceeded, marking key as exhausted and retrying with next key');
          keyManager.markKeyAsExhausted(apiKey);
          attempts++;
          continue;
        }
      }
      
      // For non-quota 403 errors or successful responses, return immediately
      return response;
      
    } catch (error) {
      console.error(`YouTube API request failed:`, error);
      lastError = error as Error;
      attempts++;
      
      if (attempts < maxRetries) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (keyManager.getAllKeysExhausted()) {
    throw new Error('All YouTube API keys have exceeded their quota limits. Please try again tomorrow or add more API keys.');
  }

  throw lastError || new Error('YouTube API request failed after all retries');
}

export { keyManager };
