
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Database, Heart, TrendingUp, Users, ArrowRight, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface DataSourceSelectionProps {
  onSourceSelect: (source: 'outliers' | 'favorites') => void;
  selectedSource: 'outliers' | 'favorites' | null;
  onNext: () => void;
}

export const DataSourceSelection: React.FC<DataSourceSelectionProps> = ({
  onSourceSelect,
  selectedSource,
  onNext
}) => {
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [outliersCount, setOutliersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isAdmin, user, adminDataMode } = useAuth();
  
  // Determine if we should show all data (admin in all-data mode)
  const shouldShowAllData = isAdmin && adminDataMode === 'all-data';

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        if (shouldShowAllData) {
          // Admin in all-data mode sees ALL users' counts from user_videos
          // Favorites count
          const { count: favCount } = await (supabase as any)
            .from('user_videos')
            .select('*', { count: 'exact', head: true })
            .eq('is_favorite', true);

          // Outliers count - calculate based on channel averages
          const { data: allVideos } = await (supabase as any)
            .from('user_videos')
            .select('view_count, channel_subscribers, channel_name');
          
          // Calculate outliers: videos with views > average for their channel
          const outlierCount = calculateOutlierCount(allVideos || []);

          setFavoritesCount(favCount || 0);
          setOutliersCount(outlierCount);
        } else if (user?.id) {
          // Regular users or admin in my-data mode see their own counts
          const { count: userFavCount } = await (supabase as any)
            .from('user_videos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_favorite', true);

          // Outliers count for user's videos - calculate based on channel averages
          const { data: userVideos } = await (supabase as any)
            .from('user_videos')
            .select('view_count, channel_subscribers, channel_name')
            .eq('user_id', user.id);
          
          // Calculate outliers: videos with views > average for their channel
          const userOutlierCount = calculateOutlierCount(userVideos || []);

          setFavoritesCount(userFavCount || 0);
          setOutliersCount(userOutlierCount);
        }
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [shouldShowAllData, user?.id]);

  // Calculate outlier count: videos where view_count > channel average OR view_count > subscribers
  const calculateOutlierCount = (videos: any[]) => {
    if (!videos || videos.length === 0) return 0;

    // Group videos by channel and calculate averages
    const channelStats: { [channel: string]: { totalViews: number; count: number } } = {};
    
    for (const video of videos) {
      const channelKey = video.channel_name || 'unknown';
      if (!channelStats[channelKey]) {
        channelStats[channelKey] = { totalViews: 0, count: 0 };
      }
      channelStats[channelKey].totalViews += video.view_count || 0;
      channelStats[channelKey].count++;
    }

    // Calculate channel averages
    const channelAverages: { [channel: string]: number } = {};
    for (const [channel, stats] of Object.entries(channelStats)) {
      channelAverages[channel] = stats.count > 0 ? stats.totalViews / stats.count : 0;
    }

    // Count outliers: videos where views > channel average OR views > subscribers
    let outlierCount = 0;
    for (const video of videos) {
      const channelKey = video.channel_name || 'unknown';
      const avgViews = channelAverages[channelKey] || 0;
      
      const isOutlier = video.view_count && (
        video.view_count > avgViews || 
        (video.channel_subscribers && video.view_count > video.channel_subscribers)
      );
      
      if (isOutlier) outlierCount++;
    }

    return outlierCount;
  };

  const canUseFavorites = favoritesCount >= 5;
  const canUseOutliers = outliersCount >= 5;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="bg-[#181818] border-[#272727] shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-[#f1f1f1] flex items-center justify-center gap-3">
            <Database className="w-8 h-8 text-[#cc0000]" />
            Choose Your Data Source
          </CardTitle>
          <p className="text-[#aaaaaa] text-lg">
            Select which video database to analyze for title generation
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outliers Database Option */}
            <div
              className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                !canUseOutliers
                  ? 'border-[#3f3f3f] bg-[#272727] opacity-60 cursor-not-allowed'
                  : selectedSource === 'outliers'
                  ? 'border-[#cc0000] bg-[#cc0000]/10 cursor-pointer'
                  : 'border-[#3f3f3f] bg-[#272727] hover:border-[#cc0000]/50 cursor-pointer'
              }`}
              onClick={() => canUseOutliers && onSourceSelect('outliers')}
            >
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-[#cc0000]" />
                {canUseOutliers && (
                  <Badge className="bg-[#cc0000]/20 text-[#cc0000] border-[#cc0000]/30">
                    Recommended
                  </Badge>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#f1f1f1] mb-2">
                Outliers Database
              </h3>
              <p className="text-[#aaaaaa] mb-4">
                {shouldShowAllData 
                  ? 'Scan from our curated collection of viral videos that broke through subscriber barriers'
                  : 'Videos performing above their channel average - proven winners in your collection'
                }
              </p>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-[#cc0000]" />
                <span className="text-[#f1f1f1] font-medium">
                  {loading ? '...' : outliersCount.toLocaleString()} outlier videos
                </span>
              </div>
              {canUseOutliers ? (
                <>
                  <div className="text-[#cc0000] text-sm">
                    ✓ Proven viral patterns
                  </div>
                  <div className="text-[#cc0000] text-sm">
                    ✓ Cross-niche insights
                  </div>
                </>
              ) : (
                <div className="bg-[#cc0000]/20 rounded-lg p-3 mt-3">
                  <div className="text-[#cc0000] text-sm font-medium mb-1">
                    Need at least 5 outliers
                  </div>
                  <div className="text-[#cc0000] text-xs">
                    Add more videos to your collection to use this option
                  </div>
                </div>
              )}
            </div>

            {/* Favorites Option */}
            <div
              className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                !canUseFavorites
                  ? 'border-[#3f3f3f] bg-[#272727] opacity-60 cursor-not-allowed'
                  : selectedSource === 'favorites'
                  ? 'border-[#cc0000] bg-[#cc0000]/10 cursor-pointer'
                  : 'border-[#3f3f3f] bg-[#272727] hover:border-[#cc0000]/50 cursor-pointer'
              }`}
              onClick={() => canUseFavorites && onSourceSelect('favorites')}
            >
              <div className="flex items-center justify-between mb-4">
                <Heart className="w-8 h-8 text-[#cc0000]" />
                {canUseFavorites && (
                  <Badge className="bg-[#cc0000]/20 text-[#cc0000] border-[#cc0000]/30">
                    Personal
                  </Badge>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#f1f1f1] mb-2">
                My Favorites
              </h3>
              <p className="text-[#aaaaaa] mb-4">
                Generate titles based on your personally curated favorite videos
              </p>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-[#cc0000]" />
                <span className="text-[#f1f1f1] font-medium">
                  {loading ? '...' : favoritesCount} favorite videos
                </span>
              </div>
              {canUseFavorites ? (
                <>
                  <div className="text-[#cc0000] text-sm">
                    ✓ Your personal taste
                  </div>
                  <div className="text-[#cc0000] text-sm">
                    ✓ Targeted to your style
                  </div>
                </>
              ) : (
                <div className="bg-[#cc0000]/20 rounded-lg p-3 mt-3">
                  <div className="text-[#cc0000] text-sm font-medium mb-1">
                    Need at least 5 favorites
                  </div>
                  <div className="text-[#cc0000] text-xs">
                    Add more videos to your favorites to use this option
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Next Button */}
          <div className="flex justify-center mt-8">
            <Button
              onClick={onNext}
              disabled={!selectedSource}
              size="lg"
              className={`px-12 py-4 text-lg font-semibold rounded-xl transition-all duration-300 ${
                selectedSource
                  ? 'bg-[#cc0000] hover:bg-[#aa0000] text-white shadow-lg hover:shadow-xl'
                  : 'bg-[#3f3f3f] text-[#aaaaaa] cursor-not-allowed'
              }`}
            >
              Continue with {selectedSource === 'outliers' ? 'Outliers' : 'Favorites'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
