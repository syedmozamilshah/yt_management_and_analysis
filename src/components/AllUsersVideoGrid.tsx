import React, { useMemo, useState } from 'react';
import { VideoCard } from './VideoCard';
import { FilterBar } from './FilterBar';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';
import { FilterState, defaultFilters, applyFilters, getUniqueNiches, getViewCountBounds, getSubscriberCountBounds } from '@/utils/filterUtils';
import { Grid3X3, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface AllUsersVideoGridProps {
  refreshTrigger?: number;
}

export const AllUsersVideoGrid: React.FC<AllUsersVideoGridProps> = ({ refreshTrigger = 0 }) => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const { toast } = useToast();

  // Fetch ALL users' videos from user_videos table (admin only)
  const { data: videos = [], isLoading, refetch } = useQuery({
    queryKey: ['all-users-videos', refreshTrigger],
    queryFn: async () => {
      // Fetch all videos from user_videos without filtering by user_id
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all users videos:', error);
        toast({
          title: "Error",
          description: "Failed to load videos from all users",
          variant: "destructive"
        });
        return [];
      }

      // Transform user_videos to Video format
      return (data || []).map((uv: any) => ({
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
    },
  });

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

  if (isLoading) {
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
    return (
      <div className="bg-[#181818] rounded-2xl border border-[#272727] p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#272727] mb-6">
          <Users className="w-10 h-10 text-[#aaaaaa]" />
        </div>
        <h3 className="text-2xl font-bold text-[#f1f1f1] mb-3">No User Videos Yet</h3>
        <p className="text-[#aaaaaa] text-lg mb-6 max-w-md mx-auto">
          No videos have been added by any users yet. Videos added by users will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            <VideoCard 
              key={video.id} 
              video={video} 
              onFavoriteUpdate={handleFavoriteUpdate}
              viewMode="grid"
              isUserVideo={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};
