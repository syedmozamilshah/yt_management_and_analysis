import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { VideoCard } from './VideoCard';
import { FilterBar } from './FilterBar';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Video } from '@/types/video';
import { FilterState, defaultFilters, applyFilters, getUniqueNiches, getViewCountBounds, getSubscriberCountBounds } from '@/utils/filterUtils';
import { Grid3X3, Sparkles, Plus, Trash2, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type TabType = 'usa' | 'spanish' | 'ideation';

interface UserVideoGridProps {
  refreshTrigger?: number;
  tabType?: TabType;
}

export const UserVideoGrid: React.FC<UserVideoGridProps> = ({ refreshTrigger = 0, tabType = 'usa' }) => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Debounced refetch to prevent update loops - only refetch max once per 5 seconds
  const debouncedRefetch = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 5000) {
      // Skip if we just refetched
      return;
    }
    
    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current);
    }
    
    updateDebounceRef.current = setTimeout(() => {
      lastUpdateTimeRef.current = Date.now();
      queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id, tabType] });
    }, 2000); // Wait 2 seconds before refetching to batch updates
  }, [queryClient, user?.id, tabType]);

  // Reset filters when tab changes
  useEffect(() => {
    setFilters(defaultFilters);
    setSelectedVideos(new Set());
    setIsSelectionMode(false);
  }, [tabType]);

  // Fetch user's personal videos for the specific tab
  const { data: videos = [], isLoading, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ['user-videos', user?.id, tabType, refreshTrigger],
    queryFn: async () => {
      if (!user?.id) {
        console.log('UserVideoGrid: No user ID, returning empty array');
        return [];
      }
      
      console.log('UserVideoGrid: Fetching videos for user:', user.id, 'tab:', tabType);
      
      // Fetch all videos for the specific tab
      let allVideos: any[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        // First try with tab_type filter (after migration)
        let query = (supabase as any)
          .from('user_videos')
          .select('id, title, youtube_url, video_id, thumbnail_url, channel_name, channel_subscribers, upload_date, view_count, niche, is_favorite, created_at, tab_type')
          .eq('user_id', user.id);
        
        // Try to filter by tab_type - if column doesn't exist, we'll catch the error
        query = query.eq('tab_type', tabType);
        
        query = query
          .order('upload_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        
        const { data, error } = await query;

        if (error) {
          // If the error is about tab_type column not existing, fall back to fetching all videos
          if (error.message?.includes('tab_type') || error.code === '42703' || error.message?.includes('column')) {
            console.warn('tab_type column not found, fetching all videos (migration may not be run yet)');
            // Fetch without tab_type filter
            const { data: fallbackData, error: fallbackError } = await (supabase as any)
              .from('user_videos')
              .select('id, title, youtube_url, video_id, thumbnail_url, channel_name, channel_subscribers, upload_date, view_count, niche, is_favorite, created_at')
              .eq('user_id', user.id)
              .order('upload_date', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
              .range(from, from + pageSize - 1);
            
            if (fallbackError) {
              console.error('Error fetching user videos (fallback):', fallbackError);
              throw fallbackError;
            }
            
            if (!fallbackData || fallbackData.length === 0) break;
            allVideos = [...allVideos, ...fallbackData];
            if (fallbackData.length < pageSize) break;
            from += pageSize;
            continue;
          }
          console.error('Error fetching user videos:', error);
          throw error;
        }

        if (!data || data.length === 0) break;
        
        allVideos = [...allVideos, ...data];
        
        // If we got less than pageSize, we've reached the end
        if (data.length < pageSize) break;
        
        from += pageSize;
      }

      if (allVideos.length === 0) {
        return [];
      }

      // Transform user_videos to Video format
      const transformedVideos = allVideos.map((uv: any) => ({
        id: uv.id,
        title: uv.title,
        youtube_url: uv.youtube_url,
        video_id: uv.video_id,
        thumbnail_url: uv.thumbnail_url,
        channel_name: uv.channel_name,
        channel_subscribers: uv.channel_subscribers,
        upload_date: uv.upload_date,
        view_count: uv.view_count,
        niche: uv.niche,
        is_favorite: uv.is_favorite,
        created_at: uv.created_at,
      })) as Video[];

      // Deduplicate by video_id, keeping the entry with highest view count
      const videoMap = new Map<string, Video>();
      for (const video of transformedVideos) {
        const existing = videoMap.get(video.video_id);
        if (!existing || (video.view_count || 0) > (existing.view_count || 0)) {
          videoMap.set(video.video_id, video);
        }
      }
      
      const deduplicatedVideos = Array.from(videoMap.values());
      
      return deduplicatedVideos;
    },
    enabled: !!user?.id,
    staleTime: 60000, // Cache for 60 seconds to avoid excessive refetches
    refetchOnMount: false, // Don't refetch on every mount
    retry: 2,
  });

  // Real-time subscription for new videos (e.g., when admin adds videos for all users)
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to user_videos table for this user and tab
    const channelName = `user-videos-realtime-${tabType}`;
    const userVideosChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          // Only show notification if the video belongs to the current tab
          if (payload.new?.tab_type === tabType) {
            console.log('Real-time: New video added for tab', tabType, payload.new);
            queryClient.invalidateQueries({ queryKey: ['user-videos', user.id, tabType] });
            toast({
              title: "New Video Added",
              description: `A new video has been added to your ${tabType.toUpperCase()} tab.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.tab_type === tabType) {
            // Use debounced refetch to prevent update loops
            debouncedRefetch();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('Real-time: Video deleted', payload.old);
          queryClient.invalidateQueries({ queryKey: ['user-videos', user.id, tabType] });
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    // Also subscribe to tracked_videos for new channel uploads (global)
    const trackedVideosChannel = supabase
      .channel(`tracked-videos-realtime-${tabType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracked_videos',
        },
        (payload) => {
          console.log('Real-time: New tracked video', payload.new);
          // Refetch user videos as the trigger should have synced it
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['user-videos', user.id, tabType] });
          }, 1000); // Small delay to allow trigger to complete
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userVideosChannel);
      supabase.removeChannel(trackedVideosChannel);
    };
  }, [user?.id, tabType, queryClient, toast]);

  // One-time metadata refresh to fix channel_subscribers, niche, upload_date etc.
  useEffect(() => {
    if (!user?.id) return;

    const refreshMetadata = async () => {
      try {
        console.log('Refreshing video metadata for user (fixing timestamps, niches)...');
        const { data, error } = await (supabase as any).rpc('refresh_user_video_metadata', {
          p_user_id: user.id
        });
        if (error) {
          console.error('Error refreshing metadata:', error);
        } else {
          console.log('Metadata refresh complete, updated rows:', data);
          // Refetch videos to get updated data
          queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
        }
      } catch (err) {
        console.error('Failed to refresh metadata:', err);
      }
    };

    // Always run on component mount to ensure data is correct
    // This fixes timestamps, niches, and other metadata
    refreshMetadata();
  }, [user?.id, queryClient]);

  // Poll for new videos every 30 seconds while page is open
  // This triggers the server-side RSS polling to catch new uploads quickly
  useEffect(() => {
    if (!user?.id) return;

    const pollForNewVideos = async () => {
      try {
        console.log('Polling RSS feeds for new videos...');
        // Trigger server-side RSS polling
        const { error } = await supabase.functions.invoke('poll-rss-feeds', {
          body: {}
        });
        
        if (error) {
          console.error('Error polling RSS feeds:', error);
          return;
        }
        
        // After polling, sync any new videos to this user
        const { data: syncCount } = await (supabase as any).rpc('sync_missed_videos_for_user', {
          p_user_id: user.id
        });
        
        if (syncCount && syncCount > 0) {
          console.log(`Found ${syncCount} new videos from RSS poll`);
          queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
          toast({
            title: "New Video Discovered!",
            description: `${syncCount} new video${syncCount > 1 ? 's' : ''} from your tracked channels.`,
          });
        }
      } catch (err) {
        console.error('Failed to poll for new videos:', err);
      }
    };

    // Initial poll after 5 seconds
    const initialPoll = setTimeout(pollForNewVideos, 5000);
    
    // Then poll every 30 seconds
    const pollInterval = setInterval(pollForNewVideos, 30000);

    return () => {
      clearTimeout(initialPoll);
      clearInterval(pollInterval);
    };
  }, [user?.id, queryClient, toast]);

  // Sync missed videos when user opens ideation (updates activity and syncs videos from last 7 days)
  useEffect(() => {
    if (!user?.id) return;

    const syncMissedVideos = async () => {
      try {
        console.log('Syncing missed videos for user:', user.id);
        const { data, error } = await (supabase as any).rpc('sync_missed_videos_for_user', {
          p_user_id: user.id
        });
        
        if (error) {
          console.error('Error syncing missed videos:', error);
          return;
        }
        
        if (data && data > 0) {
          console.log(`Synced ${data} missed videos`);
          // Refetch videos to show newly synced ones
          queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
          toast({
            title: "Videos Synced",
            description: `${data} new video${data > 1 ? 's' : ''} added from your tracked channels.`,
          });
        }
      } catch (err) {
        console.error('Failed to sync missed videos:', err);
      }
    };

    syncMissedVideos();
  }, [user?.id, queryClient, toast]);

  // Update filters when data changes
  React.useEffect(() => {
    if (videos && videos.length > 0) {
      const viewBounds = getViewCountBounds(videos);
      const subscriberBounds = getSubscriberCountBounds(videos);
      setFilters(prev => ({
        ...prev,
        viewRange: [viewBounds.min, viewBounds.max],
        subscriberRange: [subscriberBounds.min, subscriberBounds.max]
      }));
    }
  }, [videos]);

  // Memoized filtered videos and unique niches
  const filteredVideos = useMemo(() => {
    return applyFilters(videos, filters);
  }, [videos, filters]);

  const availableNiches = useMemo(() => {
    const videoNiches = getUniqueNiches(videos);
    return videoNiches;
  }, [videos]);

  // Fetch global niches from admin_global_niches
  const { data: globalNiches = [] } = useQuery({
    queryKey: ['global-niches'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('admin_global_niches')
        .select('niche')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching global niches:', error);
        return [];
      }
      return data?.map(n => n.niche) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Combine video niches and global niches
  const allNiches = useMemo(() => {
    const combined = new Set([...availableNiches, ...globalNiches]);
    return Array.from(combined).sort();
  }, [availableNiches, globalNiches]);

  const handleFavoriteUpdate = () => {
    refetch();
  };

  // Toggle selection mode
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedVideos(new Set());
  }, []);

  // Handle long press for mobile
  const handleLongPressStart = useCallback((videoId: string) => {
    if (!isMobile) return;
    
    longPressTimerRef.current = setTimeout(() => {
      enterSelectionMode();
      setSelectedVideos(new Set([videoId]));
    }, 500); // 500ms long press duration
  }, [isMobile, enterSelectionMode]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle card click in selection mode
  const handleCardClick = useCallback((videoId: string) => {
    if (!isSelectionMode) return;
    
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  }, [isSelectionMode]);

  const toggleVideoSelection = useCallback((videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedVideos(new Set());
  }, []);

  const handleDeleteSelected = async () => {
    if (selectedVideos.size === 0 || !user?.id) return;
    
    setIsDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('user_videos')
        .delete()
        .in('id', Array.from(selectedVideos));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''}`
      });

      setSelectedVideos(new Set());
      setIsSelectionMode(false);
      setShowDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
    } catch (error) {
      console.error('Error deleting videos:', error);
      toast({
        title: "Error",
        description: "Failed to delete videos",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Only show loading skeleton on initial load (when we have no cached data)
  // This prevents skeleton flash on navigation back to the page
  const showLoadingSkeleton = isLoading && videos.length === 0;

  if (showLoadingSkeleton) {
    return (
      <div className="space-y-6">
        {/* Loading Filter Bar */}
        <div className="animate-pulse">
          <div className="h-16 bg-[#272727] rounded-lg"></div>
        </div>
        
        {/* Loading Grid - 4 videos per row, responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-[#181818] rounded-xl overflow-hidden">
                <div className="aspect-video bg-[#272727]"></div>
                <div className="p-3 space-y-3">
                  <div className="h-4 bg-[#272727] rounded w-3/4"></div>
                  <div className="h-3 bg-[#272727] rounded w-1/2"></div>
                  <div className="h-3 bg-[#272727] rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    const isIdeationTab = tabType === 'ideation';
    
    return (
      <div className="space-y-6">
        <div className="bg-[#181818] rounded-2xl border border-[#272727] p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#272727] mb-6">
            <Sparkles className="w-10 h-10 text-[#aaaaaa]" />
          </div>
          {isIdeationTab ? (
            <>
              <h3 className="text-2xl font-bold text-[#f1f1f1] mb-3">Start Tracking Your Competitors</h3>
              <p className="text-[#aaaaaa] text-lg mb-4 max-w-md mx-auto">
                Add your competitor channels to start seeing how they're doing.
              </p>
              <p className="text-[#888888] text-base max-w-md mx-auto">
                Click the <span className="text-[#cc0000] font-semibold">"Add Channel"</span> button above to get started.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-[#f1f1f1] mb-3">No Videos Yet</h3>
              <p className="text-[#aaaaaa] text-lg mb-4 max-w-md mx-auto">
                Videos will appear here once they are added by the admin.
              </p>
              <p className="text-[#888888] text-base max-w-md mx-auto">
                Check back later for new content in the {tabType === 'usa' ? 'USA' : 'Spanish'} tab.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            availableNiches={allNiches}
            filteredCount={filteredVideos.length}
            totalCount={videos.length}
            videos={videos}
          />
        </div>
        {!isSelectionMode && !isMobile && filteredVideos.length > 0 && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              onClick={enterSelectionMode}
              variant="ghost"
              size="sm"
              className="text-[#888888] hover:text-[#f1f1f1] hover:bg-[#272727] gap-1.5"
            >
              <CheckSquare className="w-4 h-4" />
              Select
            </Button>
          </div>
        )}
      </div>
      
      {/* Results Section */}
      {filteredVideos.length === 0 ? (
        <div className="bg-[#181818] rounded-xl border border-[#272727] p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#272727] mb-4">
            <Grid3X3 className="w-8 h-8 text-[#aaaaaa]" />
          </div>
          <h3 className="text-xl font-bold text-[#f1f1f1] mb-2">No matches found</h3>
          <p className="text-[#aaaaaa] max-w-md mx-auto">
            Try adjusting your filters or search terms to find more videos in your collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className={`relative ${isSelectionMode ? 'cursor-pointer' : ''}`}
              onClick={() => handleCardClick(video.id)}
              onTouchStart={() => handleLongPressStart(video.id)}
              onTouchEnd={handleLongPressEnd}
              onMouseDown={() => isMobile ? null : undefined}
            >
              {/* Selection Overlay */}
              {isSelectionMode && (
                <div 
                  className={`absolute inset-0 z-10 rounded-xl border-2 transition-all duration-200 pointer-events-none ${
                    selectedVideos.has(video.id) 
                      ? 'border-[#cc0000] bg-[#cc0000]/10' 
                      : 'border-transparent hover:border-[#404040]'
                  }`}
                >
                  {/* Checkbox indicator */}
                  <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedVideos.has(video.id)
                      ? 'bg-[#cc0000] border-[#cc0000]'
                      : 'bg-black/40 border-white/30'
                  }`}>
                    {selectedVideos.has(video.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              
              <div className={isSelectionMode ? 'pointer-events-none' : ''}>
                <VideoCard 
                  video={video} 
                  onFavoriteUpdate={handleFavoriteUpdate}
                  viewMode="grid"
                  isUserVideo={true}
                  blockModalOpen={isSelectionMode}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Bar - Selection Mode */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#181818] border border-[#272727] rounded-full px-4 py-2 shadow-xl">
          <Button
            onClick={cancelSelection}
            variant="ghost"
            size="sm"
            className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] rounded-full h-8 px-3"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <span className="text-[#888888] text-sm">
            {selectedVideos.size} selected
          </span>
          <Button
            onClick={() => setShowDeleteDialog(true)}
            disabled={selectedVideos.size === 0}
            size="sm"
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white rounded-full h-8 px-3"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#181818] border-[#272727]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Videos</AlertDialogTitle>
            <AlertDialogDescription className="text-[#aaaaaa]">
              Are you sure you want to delete {selectedVideos.size} video{selectedVideos.size > 1 ? 's' : ''}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#272727] text-white border-[#404040] hover:bg-[#333333]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
