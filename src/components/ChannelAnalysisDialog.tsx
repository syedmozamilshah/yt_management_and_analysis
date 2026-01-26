import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  Sparkles,
  Globe,
  User
} from 'lucide-react';
import { formatNumber } from '@/utils/formatNumbers';
import { NicheCombobox } from '@/components/NicheCombobox';

export type TabType = 'usa' | 'spanish' | 'ideation';

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
  tabType?: TabType;
}

export const ChannelAnalysisDialog: React.FC<ChannelAnalysisDialogProps> = ({
  open,
  onOpenChange,
  channelData,
  daysPeriod,
  onComplete,
  tabType: initialTabType = 'usa'
}) => {
  const { user, isAdmin, shouldQueryAllData } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [niche, setNiche] = useState('');
  const [isAddingVideos, setIsAddingVideos] = useState(false);
  const [addingMode, setAddingMode] = useState<'personal' | 'global' | null>(null);
  // For admin, allow tab selection; for regular users, use the tab they're on
  const [selectedTabType, setSelectedTabType] = useState<TabType>(initialTabType);

  // Use videos from channelData directly (fetched via RSS)
  const videos = channelData?.videos || [];
  const videosLoaded = videos.length > 0 || (channelData && channelData.videos_fetched === 0);
  const isLoadingVideos = false; // Videos are already loaded from RSS

  // Reset state when dialog closes or tabType changes
  React.useEffect(() => {
    if (!open) {
      setNiche('');
      setIsAddingVideos(false);
      setAddingMode(null);
      setSelectedTabType(initialTabType);
    }
  }, [open, initialTabType]);

  // Get the tab type to use (admin can override, regular users use the passed tabType)
  const getTabType = () => isAdmin ? selectedTabType : initialTabType;

  const handleAddVideos = async (mode: 'personal' | 'global' = 'personal') => {
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
    setAddingMode(mode);

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

      if (mode === 'global' && isAdmin) {
        // Admin adding for all users - add to ALL users' tracked_channels, user_videos, and user_niches
        const tabTypeToUse = getTabType();
        
        // 1. First, add the channel to admin_global_channels (triggers auto-sync to all users)
        const { error: globalChannelError } = await (supabase as any)
          .from('admin_global_channels')
          .upsert({
            channel_id: channelData.channel_id,
            channel_name: channelData.channel_name,
            channel_thumbnail: channelData.channel_thumbnail,
            channel_subscribers: channelData.channel_subscribers,
            niche: niche.trim(),
            tab_type: tabTypeToUse,
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'channel_id'
          });

        if (globalChannelError) {
          console.error('Error adding global channel:', globalChannelError);
        }

        // 2. Add niche to admin_global_niches (will sync to all users)
        await (supabase as any)
          .from('admin_global_niches')
          .upsert({
            niche: niche.trim(),
            is_active: true
          }, {
            onConflict: 'niche'
          });

        // 3. Get all users to add the channel/videos/niche to each
        const { data: allUsers, error: usersError } = await supabase
          .from('profiles')
          .select('id');

        if (usersError) throw usersError;

        // 4. Add tracked channel for each user with tab_type
        const trackedChannelsToInsert = (allUsers || []).map(u => ({
          user_id: u.id,
          channel_id: channelData.channel_id,
          channel_name: channelData.channel_name,
          channel_handle: channelData.channel_handle,
          channel_thumbnail: channelData.channel_thumbnail,
          channel_subscribers: channelData.channel_subscribers,
          tab_type: tabTypeToUse,
          is_global: true
        }));

        if (trackedChannelsToInsert.length > 0) {
          console.log(`Admin: Inserting tracked channels for ${trackedChannelsToInsert.length} users with tab_type=${tabTypeToUse}`);
          const { error: trackedError } = await (supabase as any)
            .from('tracked_channels')
            .upsert(trackedChannelsToInsert, {
              onConflict: 'user_id,channel_id,tab_type',
              ignoreDuplicates: false // Don't ignore - we want to see errors
            });
          
          if (trackedError) {
            console.error('Error inserting tracked channels:', trackedError);
          } else {
            console.log('Successfully inserted tracked channels for all users');
          }
        }

        // 5. Add videos to each user's user_videos with tab_type
        const userVideosToInsert: any[] = [];
        for (const u of (allUsers || [])) {
          for (const video of videos) {
            userVideosToInsert.push({
              user_id: u.id,
              title: video.title,
              youtube_url: video.youtube_url || `https://www.youtube.com/watch?v=${video.video_id}`,
              video_id: video.video_id,
              thumbnail_url: video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
              channel_name: channelData.channel_name,
              channel_id: channelData.channel_id,
              channel_subscribers: channelData.channel_subscribers,
              upload_date: video.published_at,
              view_count: viewCountsMap[video.video_id] ?? video.view_count ?? 0,
              niche: niche.trim(),
              tab_type: tabTypeToUse,
              is_global: true
            });
          }
        }

        console.log(`Admin: Inserting ${userVideosToInsert.length} videos for all users with tab_type=${tabTypeToUse}`);
        
        // Insert in batches of 500 to avoid timeouts
        const batchSize = 500;
        let videosInserted = 0;
        for (let i = 0; i < userVideosToInsert.length; i += batchSize) {
          const batch = userVideosToInsert.slice(i, i + batchSize);
          const { error: videosError, data: videosData } = await (supabase as any)
            .from('user_videos')
            .upsert(batch, {
              onConflict: 'user_id,video_id',
              ignoreDuplicates: false
            })
            .select('id');
          
          if (videosError) {
            console.error(`Error inserting videos batch ${i / batchSize + 1}:`, videosError);
          } else {
            videosInserted += videosData?.length || batch.length;
          }
        }
        console.log(`Successfully inserted ${videosInserted} videos for all users`);

        // 6. Add niche to each user's user_niches
        const userNichesToInsert = (allUsers || []).map(u => ({
          user_id: u.id,
          niche: niche.trim(),
          is_global: true
        }));

        if (userNichesToInsert.length > 0) {
          await (supabase as any)
            .from('user_niches')
            .upsert(userNichesToInsert, {
              onConflict: 'user_id,niche',
              ignoreDuplicates: true
            });
        }

        // 7. Add channel subscription for auto-syncing future videos to all users with tab_type
        const channelSubsToInsert = (allUsers || []).map(u => ({
          user_id: u.id,
          channel_id: channelData.channel_id,
          niche: niche.trim(),
          tab_type: tabTypeToUse,
          is_active: true,
          is_global: true,
          updated_at: new Date().toISOString()
        }));

        if (channelSubsToInsert.length > 0) {
          await (supabase as any)
            .from('user_channel_subscriptions')
            .upsert(channelSubsToInsert, {
              onConflict: 'user_id,channel_id,tab_type',
              ignoreDuplicates: true
            });
        }

        // Invalidate queries to refresh all views for this tab
        queryClient.invalidateQueries({ queryKey: ['user-videos'] });
        queryClient.invalidateQueries({ queryKey: ['all-users-videos', tabTypeToUse] });
        queryClient.invalidateQueries({ queryKey: ['tracked-channels'] });

        toast({
          title: "✅ Added for All Users!",
          description: `Successfully added ${videos.length} videos to ALL ${allUsers?.length || 0} users in the ${tabTypeToUse === 'usa' ? 'USA' : 'Spanish'} tab. Future videos will be auto-added.`
        });
      } else {
        // Regular user or admin personal mode - add to user_videos with tab_type
        const tabTypeToUse = getTabType();
        const videosToInsert = videos.map(video => ({
          user_id: user.id,
          title: video.title,
          youtube_url: video.youtube_url || `https://www.youtube.com/watch?v=${video.video_id}`,
          video_id: video.video_id,
          thumbnail_url: video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
          channel_name: channelData.channel_name,
          channel_id: channelData.channel_id,
          channel_subscribers: channelData.channel_subscribers,
          upload_date: video.published_at,
          view_count: viewCountsMap[video.video_id] ?? video.view_count ?? 0,
          niche: niche.trim(),
          tab_type: tabTypeToUse
        }));

        const { error } = await (supabase as any)
          .from('user_videos')
          .insert(videosToInsert);

        if (error) throw error;

        // Add tracked channel for this user
        await (supabase as any)
          .from('tracked_channels')
          .upsert({
            user_id: user.id,
            channel_id: channelData.channel_id,
            channel_name: channelData.channel_name,
            channel_handle: channelData.channel_handle,
            channel_thumbnail: channelData.channel_thumbnail,
            channel_subscribers: channelData.channel_subscribers,
            tab_type: tabTypeToUse,
            is_global: false
          }, {
            onConflict: 'user_id,channel_id,tab_type'
          });

        // Save the channel-niche subscription for auto-syncing future videos with tab_type
        await (supabase as any)
          .from('user_channel_subscriptions')
          .upsert({
            user_id: user.id,
            channel_id: channelData.channel_id,
            niche: niche.trim(),
            tab_type: tabTypeToUse,
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,channel_id,tab_type'
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

        // Invalidate queries to refresh the page for this tab
        queryClient.invalidateQueries({ queryKey: ['user-videos', user.id, tabTypeToUse] });
        queryClient.invalidateQueries({ queryKey: ['tracked-channels'] });

        const tabDisplayNames: Record<TabType, string> = {
          'usa': 'USA',
          'spanish': 'Spanish',
          'ideation': 'Ideation'
        };

        toast({
          title: "✅ Videos Added!",
          description: `Successfully added ${videos.length} video${videos.length > 1 ? 's' : ''} to your ${tabDisplayNames[tabTypeToUse]} tab. Future videos from this channel will be auto-added.`
        });
      }

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
              showAllUsers={shouldQueryAllData()}
            />
          </div>

          {/* Tab/Country Selection for Admin on country tabs */}
          {isAdmin && initialTabType !== 'ideation' && (
            <div className="space-y-2">
              <Label className="text-[#aaaaaa]">Select Country/Region</Label>
              <Select value={selectedTabType} onValueChange={(value: TabType) => setSelectedTabType(value)}>
                <SelectTrigger className="bg-[#0f0f0f] border-[#cc0000] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#181818] border-[#272727]">
                  <SelectItem value="usa">🇺🇸 USA</SelectItem>
                  <SelectItem value="spanish">🇪🇸 Spanish</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#888888]">
                Videos will be added to ALL users in this country tab.
              </p>
            </div>
          )}

          {/* Add Videos Buttons */}
          {isAdmin && initialTabType !== 'ideation' ? (
            // Admin on country tabs - only global add button (for all users)
            <div className="space-y-3">
              <Button
                onClick={() => handleAddVideos('global')}
                disabled={!niche.trim() || isAddingVideos || videoCount === 0 || isLoadingVideos}
                className="w-full h-12 bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white font-semibold rounded-xl shadow-lg shadow-[#cc0000]/30 disabled:opacity-50"
              >
                {isAddingVideos && addingMode === 'global' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding for All Users to {selectedTabType === 'usa' ? '🇺🇸 USA' : '🇪🇸 Spanish'}...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Add for All Users to {selectedTabType === 'usa' ? '🇺🇸 USA' : '🇪🇸 Spanish'} ({videoCount} Videos)
                  </>
                )}
              </Button>
            </div>
          ) : (
            // User on ideation tab OR admin on ideation tab - personal add only
            <Button
              onClick={() => handleAddVideos('personal')}
              disabled={!niche.trim() || isAddingVideos || videoCount === 0 || isLoadingVideos}
              className="w-full h-12 bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white font-semibold rounded-xl shadow-lg shadow-[#cc0000]/30 disabled:opacity-50"
            >
              {isAddingVideos ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding Videos to Ideation...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add {videoCount} Video{videoCount !== 1 ? 's' : ''} to Ideation
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-[#666666] text-center">
            {isAdmin && initialTabType !== 'ideation'
              ? `Videos will be added to ALL users in the ${selectedTabType === 'usa' ? 'USA' : 'Spanish'} tab and future videos will auto-sync.`
              : `Videos will be added to your Ideation tab with the selected niche.`
            }
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
