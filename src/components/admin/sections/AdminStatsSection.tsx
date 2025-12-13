import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, Video, Heart, Wand2, BarChart3, Activity, UserPlus } from 'lucide-react';

interface UserStats {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_7d: number;
  new_users_30d: number;
}

interface AIUsageStats {
  tool_type: string;
  total_uses: number;
  uses_today: number;
  uses_this_week: number;
  uses_this_month: number;
  unique_users: number;
}

interface VideoStats {
  total_videos: number;
  total_favorites: number;
  total_outliers: number;
  videos_this_week: number;
}

const AdminStatsSection = () => {
  // Fetch user statistics
  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_count');
        if (error) {
          console.error('Error fetching user stats:', error);
          // Return default values if function doesn't exist yet
          return {
            total_users: 0,
            active_users_7d: 0,
            active_users_30d: 0,
            new_users_7d: 0,
            new_users_30d: 0
          } as UserStats;
        }
        return (data?.[0] || {
          total_users: 0,
          active_users_7d: 0,
          active_users_30d: 0,
          new_users_7d: 0,
          new_users_30d: 0
        }) as UserStats;
      } catch {
        return {
          total_users: 0,
          active_users_7d: 0,
          active_users_30d: 0,
          new_users_7d: 0,
          new_users_30d: 0
        } as UserStats;
      }
    }
  });

  // Fetch AI usage statistics
  const { data: aiUsageStats = [], isLoading: aiStatsLoading } = useQuery({
    queryKey: ['admin-ai-usage-stats'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_ai_usage_stats');
        if (error) {
          console.error('Error fetching AI usage stats:', error);
          return [];
        }
        return (data || []) as AIUsageStats[];
      } catch {
        return [];
      }
    }
  });

  // Fetch video statistics from user_videos
  const { data: videoStats, isLoading: videoStatsLoading } = useQuery({
    queryKey: ['admin-video-stats'],
    queryFn: async () => {
      try {
        // Get all videos
        const { data: allVideos, error } = await (supabase as any)
          .from('user_videos')
          .select('view_count, channel_subscribers, is_favorite, created_at');
        
        if (error) throw error;

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const totalVideos = allVideos?.length || 0;
        const totalFavorites = allVideos?.filter((v: any) => v.is_favorite).length || 0;
        const totalOutliers = allVideos?.filter((v: any) => 
          v.view_count && v.channel_subscribers && v.view_count > v.channel_subscribers
        ).length || 0;
        const videosThisWeek = allVideos?.filter((v: any) => 
          new Date(v.created_at) > weekAgo
        ).length || 0;

        return {
          total_videos: totalVideos,
          total_favorites: totalFavorites,
          total_outliers: totalOutliers,
          videos_this_week: videosThisWeek
        } as VideoStats;
      } catch {
        return {
          total_videos: 0,
          total_favorites: 0,
          total_outliers: 0,
          videos_this_week: 0
        } as VideoStats;
      }
    }
  });

  const isLoading = userStatsLoading || aiStatsLoading || videoStatsLoading;

  const getToolDisplayName = (toolType: string) => {
    switch (toolType) {
      case 'title_generation': return 'Title Generation';
      case 'script_analysis': return 'Script Analysis';
      case 'channel_analysis': return 'Channel Analysis';
      default: return toolType;
    }
  };

  const getToolIcon = (toolType: string) => {
    switch (toolType) {
      case 'title_generation': return <Wand2 className="w-5 h-5 text-purple-400" />;
      case 'script_analysis': return <BarChart3 className="w-5 h-5 text-blue-400" />;
      case 'channel_analysis': return <TrendingUp className="w-5 h-5 text-green-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#f1f1f1]">Admin Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="bg-[#181818] border-[#272727] animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-[#272727] rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[#f1f1f1] mb-2">Admin Statistics</h2>
        <p className="text-[#aaaaaa]">Overview of platform usage and analytics</p>
      </div>

      {/* User Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-[#f1f1f1] mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#cc0000]" />
          User Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Total Members</p>
                  <p className="text-3xl font-bold text-[#f1f1f1]">{userStats?.total_users || 0}</p>
                </div>
                <Users className="w-10 h-10 text-[#cc0000] opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Active (7 days)</p>
                  <p className="text-3xl font-bold text-green-400">{userStats?.active_users_7d || 0}</p>
                </div>
                <Activity className="w-10 h-10 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Active (30 days)</p>
                  <p className="text-3xl font-bold text-blue-400">{userStats?.active_users_30d || 0}</p>
                </div>
                <Activity className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">New (7 days)</p>
                  <p className="text-3xl font-bold text-purple-400">{userStats?.new_users_7d || 0}</p>
                </div>
                <UserPlus className="w-10 h-10 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Video Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-[#f1f1f1] mb-4 flex items-center gap-2">
          <Video className="w-5 h-5 text-[#cc0000]" />
          Video Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Total Videos</p>
                  <p className="text-3xl font-bold text-[#f1f1f1]">{videoStats?.total_videos || 0}</p>
                </div>
                <Video className="w-10 h-10 text-[#cc0000] opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Total Outliers</p>
                  <p className="text-3xl font-bold text-yellow-400">{videoStats?.total_outliers || 0}</p>
                  <p className="text-xs text-[#666666] mt-1">Views &gt; Subscribers</p>
                </div>
                <TrendingUp className="w-10 h-10 text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Total Favorites</p>
                  <p className="text-3xl font-bold text-red-400">{videoStats?.total_favorites || 0}</p>
                </div>
                <Heart className="w-10 h-10 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#aaaaaa] text-sm">Added This Week</p>
                  <p className="text-3xl font-bold text-green-400">{videoStats?.videos_this_week || 0}</p>
                </div>
                <Activity className="w-10 h-10 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Tool Usage Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-[#f1f1f1] mb-4 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-[#cc0000]" />
          AI Tool Usage
        </h3>
        {aiUsageStats.length === 0 ? (
          <Card className="bg-[#181818] border-[#272727]">
            <CardContent className="p-8 text-center">
              <Wand2 className="w-12 h-12 text-[#aaaaaa] mx-auto mb-4 opacity-50" />
              <p className="text-[#aaaaaa]">No AI tool usage data yet</p>
              <p className="text-[#666666] text-sm mt-2">
                Usage statistics will appear here once users start using AI features
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiUsageStats.map((stat) => (
              <Card key={stat.tool_type} className="bg-[#181818] border-[#272727]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getToolIcon(stat.tool_type)}
                    <span className="text-[#f1f1f1]">{getToolDisplayName(stat.tool_type)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[#aaaaaa] text-sm">Total Uses</span>
                      <span className="text-[#f1f1f1] font-bold">{stat.total_uses}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#aaaaaa] text-sm">Today</span>
                      <span className="text-green-400 font-medium">{stat.uses_today}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#aaaaaa] text-sm">This Week</span>
                      <span className="text-blue-400 font-medium">{stat.uses_this_week}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#aaaaaa] text-sm">This Month</span>
                      <span className="text-purple-400 font-medium">{stat.uses_this_month}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#272727] pt-2 mt-2">
                      <span className="text-[#aaaaaa] text-sm">Unique Users</span>
                      <span className="text-[#cc0000] font-medium">{stat.unique_users}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStatsSection;
