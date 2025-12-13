/**
 * Tool Usage API Utility
 * 
 * This utility interacts with Supabase to track user word usage
 * for the script generator and SEO tools.
 */

import { supabase } from '@/integrations/supabase/client';

export interface UsageData {
  wordUsage: number;
  maxWords: number;
  month: string;
}

/**
 * Get current word usage for the authenticated user
 */
export async function getWordUsage(): Promise<UsageData | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No authenticated session');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('tool-usage', {
      method: 'GET',
    });

    if (error) {
      console.error('Failed to get word usage:', error);
      return null;
    }

    return {
      wordUsage: data.wordUsage,
      maxWords: data.maxWords,
      month: data.month,
    };
  } catch (error) {
    console.error('Error getting word usage:', error);
    return null;
  }
}

/**
 * Sync word usage with the backend
 */
export async function syncWordUsage(
  action: 'add' | 'subtract' | 'get' | 'reset',
  wordCount?: number
): Promise<UsageData | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No authenticated session');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('tool-usage', {
      method: 'POST',
      body: {
        action,
        wordCount: wordCount || 0,
      },
    });

    if (error) {
      console.error('Failed to sync word usage:', error);
      return null;
    }

    return {
      wordUsage: data.wordUsage,
      maxWords: data.maxWords,
      month: data.month,
    };
  } catch (error) {
    console.error('Error syncing word usage:', error);
    return null;
  }
}

/**
 * Add word usage
 */
export async function addWordUsage(wordCount: number): Promise<UsageData | null> {
  return syncWordUsage('add', wordCount);
}

/**
 * Subtract word usage
 */
export async function subtractWordUsage(wordCount: number): Promise<UsageData | null> {
  return syncWordUsage('subtract', wordCount);
}

/**
 * Reset word usage (admin only)
 */
export async function resetWordUsage(): Promise<UsageData | null> {
  return syncWordUsage('reset');
}
