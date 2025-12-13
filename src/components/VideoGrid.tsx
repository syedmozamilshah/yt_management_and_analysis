
import React, { useEffect, useState, useMemo } from 'react';
import { VideoCard } from './VideoCard';
import { FilterBar } from './FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';
import { FilterState, defaultFilters, applyFilters, getUniqueNiches, getViewCountBounds, getSubscriberCountBounds } from '@/utils/filterUtils';
import { Grid3X3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoGridProps {
  refreshTrigger: number;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ refreshTrigger }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const { toast } = useToast();

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('upload_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
      
      // Initialize ranges filter based on actual data
      if (data && data.length > 0) {
        const viewBounds = getViewCountBounds(data);
        const subscriberBounds = getSubscriberCountBounds(data);
        setFilters(prev => ({
          ...prev,
          viewRange: [viewBounds.min, viewBounds.max],
          subscriberRange: [subscriberBounds.min, subscriberBounds.max]
        }));
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast({
        title: "Error",
        description: "Failed to load videos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [refreshTrigger]);

  // Memoized filtered videos and unique niches
  const filteredVideos = useMemo(() => {
    return applyFilters(videos, filters);
  }, [videos, filters]);

  const availableNiches = useMemo(() => {
    return getUniqueNiches(videos);
  }, [videos]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading Filter Bar */}
        <div className="animate-pulse">
          <div className="h-16 bg-[#272727] rounded-lg"></div>
        </div>
        
        {/* Loading Grid - 4 videos per row, responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(20)].map((_, i) => (
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
          <Sparkles className="w-10 h-10 text-[#aaaaaa]" />
        </div>
        <h3 className="text-2xl font-bold text-[#f1f1f1] mb-3">No Videos Yet</h3>
        <p className="text-[#aaaaaa] text-lg mb-6 max-w-md mx-auto">
          Your video collection is empty. Start by adding your first YouTube video to build your database!
        </p>
        <Button 
          onClick={() => window.location.href = '/admin'}
          className="bg-[#cc0000] hover:bg-[#aa0000] text-white text-lg px-8 py-3"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Add Your First Video
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            Try adjusting your filters or search terms to find more videos in your collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <VideoCard 
              key={video.id} 
              video={video} 
              onFavoriteUpdate={fetchVideos}
              viewMode="grid"
            />
          ))}
        </div>
      )}
    </div>
  );
};
