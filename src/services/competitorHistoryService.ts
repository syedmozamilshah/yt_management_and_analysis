import { supabase } from "@/integrations/supabase/client";
import { SimilarChannel } from "@/components/tools/competitor/SimilarChannelCard";

export interface CompetitorAnalysis {
  id: string;
  user_id: string;
  source_channel_id: string;
  source_channel_name: string;
  source_channel_handle: string | null;
  source_channel_thumbnail: string | null;
  similar_channels: SimilarChannel[];
  total_channels_found: number;
  created_at: string;
  updated_at: string;
}

export async function saveCompetitorAnalysis(
  sourceChannel: {
    id: string;
    name: string;
    handle: string;
    thumbnail: string;
  },
  similarChannels: SimilarChannel[]
): Promise<CompetitorAnalysis | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("User not authenticated");
    return null;
  }

  // Use type assertion for the table that may not be in generated types yet
  const { data, error } = await (supabase as any)
    .from("competitor_analyses")
    .insert({
      user_id: user.id,
      source_channel_id: sourceChannel.id,
      source_channel_name: sourceChannel.name,
      source_channel_handle: sourceChannel.handle,
      source_channel_thumbnail: sourceChannel.thumbnail,
      similar_channels: similarChannels,
      total_channels_found: similarChannels.length,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving competitor analysis:", error);
    return null;
  }

  return data as CompetitorAnalysis;
}

export async function getCompetitorAnalysisHistory(
  limit: number = 10
): Promise<CompetitorAnalysis[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  // Use type assertion for the table that may not be in generated types yet
  const { data, error } = await (supabase as any)
    .from("competitor_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching competitor analysis history:", error);
    return [];
  }

  return (data || []) as CompetitorAnalysis[];
}

export async function deleteCompetitorAnalysis(id: string): Promise<boolean> {
  // Use type assertion for the table that may not be in generated types yet
  const { error } = await (supabase as any)
    .from("competitor_analyses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting competitor analysis:", error);
    return false;
  }

  return true;
}
