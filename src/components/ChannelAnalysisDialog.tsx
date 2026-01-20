import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Youtube, 
  Users, 
  Video, 
  Plus, 
  Loader2, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { formatNumber } from '@/utils/formatNumbers';
import { NicheCombobox } from '@/components/NicheCombobox';

interface ChannelData {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  videos_fetched?: number;
  videos?: Array<{
    id: string;
    video_id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string;
    youtube_url: string | null;
    view_count: number | null;
  }>;
  rss_feed_url?: string;
}

interface TrackedVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  view_count: number | null;
  youtube_url: string | null;
}

interface ChannelAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelData: ChannelData | null;
  daysPeriod: number;
  onComplete: () => void;
}

export const ChannelAnalysisDialog: React.FC<ChannelAnalysisDialogProps> = ({
  open,
  onOpenChange,
  channelData,
  daysPeriod,
  onComplete
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [niche, setNiche] = useState('');
  const [isAddingVideos, setIsAddingVideos] = useState(false);

  // Use videos from channelData directly (fetched via RSS)
  const videos = channelData?.videos || [];
  const videosLoaded = videos.length > 0 || (channelData && channelData.videos_fetched === 0);
  const isLoadingVideos = false; // Videos are already loaded from RSS

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setNiche('');
      setIsAddingVideos(false);
    }
  }, [open]);

  const handleAddVideos = async () => {
    if (!user?.id || !channelData || !niche.trim()) {
      toast({
        title: "Error",
        description: "Please select or enter a niche for the videos.",
        variant: "destructive"
      });
      return;
    }

    if (videos.length === 0) {
      toast({
        title: "No Videos",
        description: "No videos found to add.",
        variant: "destructive"
      });
      return;
    }

    setIsAddingVideos(true);

    try {
      // First, fetch view counts from YouTube API (1 quota unit per 50 videos)
      const videoIds = videos.map(v => v.video_id);
      let viewCountsMap: Record<string, number> = {};
      
      try {
        const { data: statsData, error: statsError } = await supabase.functions.invoke('get-video-stats', {
          body: { videoIds }
        });
        
        if (!statsError && statsData?.stats) {
          // Build a map of video_id -> view_count
          for (const stat of statsData.stats) {
            viewCountsMap[stat.video_id] = stat.view_count;
          }
          console.log(`Fetched view counts for ${Object.keys(viewCountsMap).length} videos`);
        } else {
          console.warn('Could not fetch view counts, using 0:', statsError);
        }
      } catch (e) {
        console.warn('View count fetch failed, videos will show 0 views initially:', e);
      }

      // Prepare videos for insertion into user_videos
      const videosToInsert = videos.map(video => ({
        user_id: user.id,
        title: video.title,
        youtube_url: video.youtube_url || `https://www.youtube.com/watch?v=${video.video_id}`,
        video_id: video.video_id,
        thumbnail_url: video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
        channel_name: channelData.channel_name,
        channel_id: channelData.channel_id, // Save channel_id for auto-sync
        channel_subscribers: channelData.channel_subscribers,
        upload_date: video.published_at,
        view_count: viewCountsMap[video.video_id] ?? video.view_count ?? 0,
        niche: niche.trim()
      }));

      const { error } = await (supabase as any)
        .from('user_videos')
        .insert(videosToInsert);

      if (error) throw error;

      // Save the channel-niche subscription for auto-syncing future videos
      await (supabase as any)
        .from('user_channel_subscriptions')
        .upsert({
          user_id: user.id,
          channel_id: channelData.channel_id,
          niche: niche.trim(),
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,channel_id'
        });

      // Update user activity to mark them as active
      await (supabase as any)
        .from('user_activity')
        .upsert({
          user_id: user.id,
          last_ideation_opened_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      // Invalidate queries to refresh the ideation page
      queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });

      toast({
        title: "✅ Videos Added!",
        description: `Successfully added ${videos.length} video${videos.length > 1 ? 's' : ''} to your ideation board. Future videos from this channel will be auto-added.`
      });

      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      console.error('Error adding videos:', error);
      
      // Check for duplicate video error
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        toast({
          title: "Some Videos Already Exist",
          description: "Some of these videos may already be in your collection.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add videos. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsAddingVideos(false);
    }
  };

  if (!channelData) return null;

  const videoCount = channelData.videos_fetched ?? videos.length;
  const timePeriodLabel = daysPeriod === 7 ? 'last 7 days' : 
                          daysPeriod === 28 ? 'last 28 days' : 
                          daysPeriod === 90 ? 'last 90 days' : `last ${daysPeriod} days`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#181818] border border-[#272727] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#cc0000]" />
            Channel Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Channel Info Card */}
          <div className="bg-[#0f0f0f] border border-[#272727] rounded-xl p-4">
            <div className="flex items-center gap-4">
              {/* Channel Thumbnail/Logo */}
              <div className="flex-shrink-0">
                {channelData.channel_thumbnail ? (
                  <img
                    src={channelData.channel_thumbnail}
                    alt={channelData.channel_name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#cc0000]"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center">
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>

              {/* Channel Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-[#f1f1f1] truncate">
                  {channelData.channel_name}
                </h3>
                {channelData.channel_handle && (
                  <p className="text-sm text-[#888888]">
                    {channelData.channel_handle}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Users className="w-4 h-4 text-[#cc0000]" />
                  <span className="text-sm text-[#aaaaaa]">
                    {formatNumber(channelData.channel_subscribers ?? 0)} subscribers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Videos Found Section */}
          <div className="bg-[#0f0f0f] border border-[#272727] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#cc0000]/10 border border-[#cc0000]/30 flex items-center justify-center">
                  <Video className="w-5 h-5 text-[#cc0000]" />
                </div>
                <div>
                  <p className="text-[#f1f1f1] font-medium">
                    {isLoadingVideos ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading videos...
                      </span>
                    ) : (
                      <>
                        <span className="text-[#cc0000] font-bold text-xl">{videoCount}</span> videos found
                      </>
                    )}
                  </p>
                  <p className="text-xs text-[#666666]">
                    From {timePeriodLabel}
                  </p>
                </div>
              </div>
              {videosLoaded && videos.length > 0 && (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
            </div>
          </div>

          {/* Niche Selection */}
          <div>
            <NicheCombobox
              value={niche}
              onChange={setNiche}
              disabled={isAddingVideos}
              placeholder="Select or create a niche..."
            />
          </div>

          {/* Add Videos Button */}
          <Button
            onClick={handleAddVideos}
            disabled={!niche.trim() || isAddingVideos || videoCount === 0 || isLoadingVideos}
            className="w-full h-12 bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white font-semibold rounded-xl shadow-lg shadow-[#cc0000]/30 disabled:opacity-50"
          >
            {isAddingVideos ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding Videos...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add {videoCount} Video{videoCount !== 1 ? 's' : ''} to Ideation
              </>
            )}
          </Button>

          <p className="text-xs text-[#666666] text-center">
            Videos will be added to your Ideation page with the selected niche
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
