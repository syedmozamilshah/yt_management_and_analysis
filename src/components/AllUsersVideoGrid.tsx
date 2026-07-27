import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { VideoCard } from './VideoCard';
import { FilterBar } from './FilterBar';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';
import { FilterState, defaultFilters, applyFilters, getUniqueNiches, getViewCountBounds, getSubscriberCountBounds } from '@/utils/filterUtils';
import { Grid3X3, Sparkles, Users, Trash2, X, CheckSquare, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TabType = 'usa' | 'spanish' | 'ideation';

interface AllUsersVideoGridProps {
  refreshTrigger?: number;
  tabType?: TabType;
}

export const AllUsersVideoGrid: React.FC<AllUsersVideoGridProps> = ({ refreshTrigger = 0, tabType = 'usa' }) => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasLongPressRef = useRef(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset filters when tab changes
  useEffect(() => {
    setFilters(defaultFilters);
    setSelectedVideos(new Set());
    setIsSelectionMode(false);
  }, [tabType]);

  // Fetch ALL users' videos from user_videos table (admin only) for specific tab
  const { data: videos = [], isLoading, refetch } = useQuery({
    queryKey: ['all-users-videos', tabType, refreshTrigger],
    queryFn: async () => {
      // Fetch all videos from user_videos for the specific tab
      let allVideos: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let tabTypeColumnExists = true;
      
      while (true) {
        let data, error;
        
        // Try with tab_type filter first
        if (tabTypeColumnExists) {
          const result = await (supabase as any)
            .from('user_videos')
            .select('*')
            .eq('tab_type', tabType)
            .order('upload_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);
          
          data = result.data;
          error = result.error;
          
          // If error (column doesn't exist), try without filter
          if (error && error.message?.includes('tab_type')) {
            console.warn('AllUsersVideoGrid: tab_type column not found, fetching without filter');
            tabTypeColumnExists = false;
            const fallbackResult = await (supabase as any)
              .from('user_videos')
              .select('*')
              .order('upload_date', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
              .range(from, from + pageSize - 1);
            data = fallbackResult.data;
            error = fallbackResult.error;
          }
        } else {
          const result = await (supabase as any)
            .from('user_videos')
            .select('*')
            .order('upload_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching all users videos:', error);
          toast({
            title: "Error",
            description: "Failed to load videos from all users",
            variant: "destructive"
          });
          return [];
        }

        if (!data || data.length === 0) break;
        
        allVideos = [...allVideos, ...data];
        
        // If we got less than pageSize, we've reached the end
        if (data.length < pageSize) break;
        
        from += pageSize;
      }
      
      console.log(`AllUsersVideoGrid: Fetched ${allVideos.length} total videos for tab ${tabType}`);

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
        user_id: uv.user_id, // Keep track of which user added it
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
      
      // Sort by upload_date descending (newest first) so new videos always appear at top
      deduplicatedVideos.sort((a, b) => {
        const dateA = a.upload_date ? new Date(a.upload_date).getTime() : 0;
        const dateB = b.upload_date ? new Date(b.upload_date).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        // Secondary sort by created_at descending
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdB - createdA;
      });
      
      return deduplicatedVideos;
    },
    staleTime: 30000, // Cache for 30 seconds (reduced from 60s for faster updates)
    refetchOnMount: true, // Refetch on mount to catch new videos
  });

  // Real-time subscription for new videos (when admin adds videos for all users)
  // Debounced to prevent infinite refetch loops from bulk syncs
  const adminRealtimeDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const debouncedInvalidate = () => {
      if (adminRealtimeDebounceRef.current) {
        clearTimeout(adminRealtimeDebounceRef.current);
      }
      adminRealtimeDebounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['all-users-videos', tabType] });
      }, 3000); // Wait 3s after last event before refetching
    };

    const userVideosChannel = supabase
      .channel(`all-users-videos-realtime-${tabType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_videos',
        },
        (payload: any) => {
          if (!payload.new?.tab_type || payload.new?.tab_type === tabType) {
            debouncedInvalidate();
          }
        }
      )
      .subscribe();

    // Also subscribe to tracked_videos for new channel uploads
    const trackedVideosChannel = supabase
      .channel(`admin-tracked-videos-realtime-${tabType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracked_videos',
        },
        (payload: any) => {
          console.log('Admin Real-time: New tracked video discovered', payload.new);
          debouncedInvalidate();
        }
      )
      .subscribe();

    return () => {
      if (adminRealtimeDebounceRef.current) {
        clearTimeout(adminRealtimeDebounceRef.current);
      }
      supabase.removeChannel(userVideosChannel);
      supabase.removeChannel(trackedVideosChannel);
    };
  }, [queryClient, tabType]);

  // Poll for new videos every 30 seconds while page is open (admin view)
  React.useEffect(() => {
    const pollForNewVideos = async () => {
      try {
        console.log('Admin: Polling RSS feeds for new videos...');
        // Trigger server-side RSS polling with timeout
        const pollPromise = supabase.functions.invoke('poll-rss-feeds', {
          body: {}
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('poll-rss-feeds timed out after 60s')), 60000)
        );
        
        const { data: pollData, error } = await Promise.race([pollPromise, timeoutPromise]) as any;
        
        if (error) {
          console.error('Error polling RSS feeds:', error);
        } else {
          console.log('Admin RSS poll result:', pollData);
        }
        
        // Sync missed videos for ALL users to catch any videos
        // that exist in tracked_videos but weren't synced to user_videos
        try {
          console.log('Admin: Syncing missed videos for ALL users...');
          const { data: syncCount, error: syncError } = await (supabase as any).rpc('sync_missed_videos_for_all_users');
          
          if (syncError) {
            console.error('Error syncing missed videos for all users:', syncError);
          } else if (syncCount && syncCount > 0) {
            console.log(`Admin: Synced ${syncCount} missed video-user pairs across all users`);
          }
        } catch (syncErr) {
          console.error('Failed to sync missed videos for all users:', syncErr);
        }
        
        // Invalidate and refetch to show any new videos
        queryClient.invalidateQueries({ queryKey: ['all-users-videos', tabType] });
      } catch (err) {
        console.error('Failed to poll for new videos:', err);
        // Still try to refetch even if poll failed
        queryClient.invalidateQueries({ queryKey: ['all-users-videos', tabType] });
      }
    };

    // Initial poll after 3 seconds (reduced from 5s for faster first load)
    const initialPoll = setTimeout(pollForNewVideos, 3000);
    
    // Then poll every 30 seconds
    const pollInterval = setInterval(pollForNewVideos, 30000);

    return () => {
      clearTimeout(initialPoll);
      clearInterval(pollInterval);
    };
  }, [refetch, queryClient, tabType]);

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
    return getUniqueNiches(videos);
  }, [videos]);

  const handleFavoriteUpdate = () => {
    refetch();
  };

  // Long press handlers for multi-select
  const handleLongPressStart = useCallback((videoId: string, e: React.MouseEvent | React.TouchEvent) => {
    // Only start long press on left click or touch
    if ('button' in e && e.button !== 0) return;
    
    wasLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      wasLongPressRef.current = true;
      setIsSelectionMode(true);
      setSelectedVideos(new Set([videoId]));
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cancel long press on touch move (prevents accidental selection while scrolling)
  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const toggleVideoSelection = useCallback((videoId: string) => {
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

  // Prevent click from bubbling if it was a long press
  const handleCardClick = useCallback((videoId: string, e: React.MouseEvent) => {
    if (wasLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      wasLongPressRef.current = false;
      return;
    }
    if (isSelectionMode) {
      toggleVideoSelection(videoId);
    }
  }, [isSelectionMode, toggleVideoSelection]);

  const cancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedVideos(new Set());
  }, []);

  const handleDeleteSelected = async () => {
    if (selectedVideos.size === 0) return;
    
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
      queryClient.invalidateQueries({ queryKey: ['all-users-videos'] });
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

  // Select all visible videos
  const handleSelectAll = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedVideos(new Set(filteredVideos.map(v => v.id)));
  }, [filteredVideos]);

  // Move selected videos to another tab
  const handleMoveToTab = async (targetTab: TabType) => {
    if (selectedVideos.size === 0 || targetTab === tabType) return;
    
    setIsMoving(true);
    try {
      const { error } = await (supabase as any)
        .from('user_videos')
        .update({ tab_type: targetTab })
        .in('id', Array.from(selectedVideos));

      if (error) throw error;

      const tabNames: Record<TabType, string> = {
        'usa': '🇺🇸 USA',
        'spanish': '🇪🇸 Spanish',
        'ideation': '💡 Ideation'
      };

      toast({
        title: "Videos Moved",
        description: `Moved ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''} to ${tabNames[targetTab]}`
      });

      setSelectedVideos(new Set());
      setIsSelectionMode(false);
      // Refresh both the current tab and the target tab
      queryClient.invalidateQueries({ queryKey: ['all-users-videos', tabType] });
      queryClient.invalidateQueries({ queryKey: ['all-users-videos', targetTab] });
      queryClient.invalidateQueries({ queryKey: ['user-videos'] });
    } catch (error) {
      console.error('Error moving videos:', error);
      toast({
        title: "Error",
        description: "Failed to move videos",
        variant: "destructive"
      });
    } finally {
      setIsMoving(false);
    }
  };

  // Only show loading skeleton on initial load (when we have no cached data)
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
    const tabDisplayName = tabType === 'usa' ? 'USA' : tabType === 'spanish' ? 'Spanish' : 'Ideation';
    
    return (
      <div className="bg-[#181818] rounded-2xl border border-[#272727] p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#272727] mb-6">
          <Users className="w-10 h-10 text-[#aaaaaa]" />
        </div>
        {isIdeationTab ? (
          <>
            <h3 className="text-2xl font-bold text-[#f1f1f1] mb-3">No Ideation Videos Yet</h3>
            <p className="text-[#aaaaaa] text-lg mb-4 max-w-md mx-auto">
              Users haven't added any videos to their Ideation tab yet.
            </p>
            <p className="text-[#888888] text-base max-w-md mx-auto">
              Videos added by users to their personal Ideation tab will appear here.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-[#f1f1f1] mb-3">No Videos in {tabDisplayName} Tab</h3>
            <p className="text-[#aaaaaa] text-lg mb-4 max-w-md mx-auto">
              Click the <span className="text-[#cc0000] font-semibold">"Add Channel"</span> button above to add videos for all users.
            </p>
            <p className="text-[#888888] text-base max-w-md mx-auto">
              Videos you add here will be visible to all users in the {tabDisplayName} tab.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection Mode Bar */}
      {isSelectionMode && (
        <div className="sticky top-0 z-20 bg-[#cc0000] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Button
              onClick={cancelSelection}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
            <span className="text-white font-medium">
              {selectedVideos.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Select All Button */}
            <Button
              onClick={handleSelectAll}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              Select All ({filteredVideos.length})
            </Button>
            
            {/* Move to Tab Dropdown - Admin can only move TO country tabs, not TO ideation */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={selectedVideos.size === 0 || isMoving}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {isMoving ? 'Moving...' : 'Move to Country Tab'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#181818] border-[#272727]">
                {tabType !== 'usa' && (
                  <DropdownMenuItem 
                    onClick={() => handleMoveToTab('usa')}
                    className="text-white hover:bg-[#272727] cursor-pointer"
                  >
                    <span className="mr-2">🇺🇸</span>
                    USA
                  </DropdownMenuItem>
                )}
                {tabType !== 'spanish' && (
                  <DropdownMenuItem 
                    onClick={() => handleMoveToTab('spanish')}
                    className="text-white hover:bg-[#272727] cursor-pointer"
                  >
                    <span className="mr-2">🇪🇸</span>
                    Spanish
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Delete Button */}
            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={selectedVideos.size === 0}
              className="bg-white text-[#cc0000] hover:bg-gray-100"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Header showing this is all users' data */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1a2e1a] border border-green-800/50 rounded-lg">
        <Users className="w-5 h-5 text-green-400" />
        <span className="text-green-400 font-medium">
          Viewing all users' videos ({videos.length} total)
        </span>
      </div>

      {/* Filter Section */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        availableNiches={availableNiches}
        filteredCount={filteredVideos.length}
        totalCount={videos.length}
        videos={videos}
      />
      
      {/* Results Section */}
      {filteredVideos.length === 0 ? (
        <div className="bg-[#181818] rounded-xl border border-[#272727] p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#272727] mb-4">
            <Grid3X3 className="w-8 h-8 text-[#aaaaaa]" />
          </div>
          <h3 className="text-xl font-bold text-[#f1f1f1] mb-2">No matches found</h3>
          <p className="text-[#aaaaaa] max-w-md mx-auto">
            Try adjusting your filters or search terms to find more videos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="relative"
              onMouseDown={(e) => isSelectionMode ? undefined : handleLongPressStart(video.id, e)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={(e) => isSelectionMode ? undefined : handleLongPressStart(video.id, e)}
              onTouchEnd={handleLongPressEnd}
              onTouchMove={handleTouchMove}
              onClick={(e) => isSelectionMode ? toggleVideoSelection(video.id) : handleCardClick(video.id, e)}
            >
              {/* Selection Overlay */}
              {isSelectionMode && (
                <div 
                  className={`absolute inset-0 z-10 rounded-xl border-2 transition-all duration-200 pointer-events-none ${
                    selectedVideos.has(video.id) 
                      ? 'border-[#cc0000] bg-[#cc0000]/20' 
                      : 'border-transparent'
                  }`}
                >
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedVideos.has(video.id)
                      ? 'bg-[#cc0000] border-[#cc0000]'
                      : 'bg-black/50 border-white/50'
                  }`}>
                    {selectedVideos.has(video.id) && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                />
              </div>
            </div>
          ))}
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
