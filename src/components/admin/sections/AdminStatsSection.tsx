import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, Video, Heart, Wand2, BarChart3, Activity, UserPlus, FileText, Tags, Type } from 'lucide-react';

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

interface ToolStats {
  tool_name: string;
  total_uses: number;
  uses_today: number;
  uses_this_week: number;
  uses_this_month: number;
  unique_users: number;
  total_words?: number;
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

  // Fetch Script Generator usage statistics
  const { data: scriptStats, isLoading: scriptStatsLoading } = useQuery({
    queryKey: ['admin-script-stats'],
    queryFn: async () => {
      try {
        const { data: allScripts, error } = await (supabase as any)
          .from('user_scripts')
          .select('id, user_id, word_count, created_at');
        
        if (error) throw error;

        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const totalUses = allScripts?.length || 0;
        const usesToday = allScripts?.filter((s: any) => new Date(s.created_at) > dayAgo).length || 0;
        const usesThisWeek = allScripts?.filter((s: any) => new Date(s.created_at) > weekAgo).length || 0;
        const usesThisMonth = allScripts?.filter((s: any) => new Date(s.created_at) > monthAgo).length || 0;
        const uniqueUsers = new Set(allScripts?.map((s: any) => s.user_id) || []).size;
        const totalWords = allScripts?.reduce((sum: number, s: any) => sum + (s.word_count || 0), 0) || 0;

        return {
          tool_name: 'Script Generator',
          total_uses: totalUses,
          uses_today: usesToday,
          uses_this_week: usesThisWeek,
          uses_this_month: usesThisMonth,
          unique_users: uniqueUsers,
          total_words: totalWords
        } as ToolStats;
      } catch {
        return {
          tool_name: 'Script Generator',
          total_uses: 0,
          uses_today: 0,
          uses_this_week: 0,
          uses_this_month: 0,
          unique_users: 0,
          total_words: 0
        } as ToolStats;
      }
    }
  });

  // Fetch SEO Generator usage statistics
  const { data: seoStats, isLoading: seoStatsLoading } = useQuery({
    queryKey: ['admin-seo-stats'],
    queryFn: async () => {
      try {
        const { data: allSeo, error } = await (supabase as any)
          .from('user_seo_descriptions')
          .select('id, user_id, created_at');
        
        if (error) throw error;

        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const totalUses = allSeo?.length || 0;
        const usesToday = allSeo?.filter((s: any) => new Date(s.created_at) > dayAgo).length || 0;
        const usesThisWeek = allSeo?.filter((s: any) => new Date(s.created_at) > weekAgo).length || 0;
        const usesThisMonth = allSeo?.filter((s: any) => new Date(s.created_at) > monthAgo).length || 0;
        const uniqueUsers = new Set(allSeo?.map((s: any) => s.user_id) || []).size;

        return {
          tool_name: 'SEO Generator',
          total_uses: totalUses,
          uses_today: usesToday,
          uses_this_week: usesThisWeek,
          uses_this_month: usesThisMonth,
          unique_users: uniqueUsers
        } as ToolStats;
      } catch {
        return {
          tool_name: 'SEO Generator',
          total_uses: 0,
          uses_today: 0,
          uses_this_week: 0,
          uses_this_month: 0,
          unique_users: 0
        } as ToolStats;
      }
    }
  });

  // Fetch Title Generator usage statistics
  const { data: titleStats, isLoading: titleStatsLoading } = useQuery({
    queryKey: ['admin-title-stats'],
    queryFn: async () => {
      try {
        const { data: allTitles, error } = await (supabase as any)
          .from('title_generations')
          .select('id, user_id, created_at');
        
        if (error) throw error;

        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const totalUses = allTitles?.length || 0;
        const usesToday = allTitles?.filter((s: any) => new Date(s.created_at) > dayAgo).length || 0;
        const usesThisWeek = allTitles?.filter((s: any) => new Date(s.created_at) > weekAgo).length || 0;
        const usesThisMonth = allTitles?.filter((s: any) => new Date(s.created_at) > monthAgo).length || 0;
        const uniqueUsers = new Set(allTitles?.map((s: any) => s.user_id) || []).size;

        return {
          tool_name: 'Title Generator',
          total_uses: totalUses,
          uses_today: usesToday,
          uses_this_week: usesThisWeek,
          uses_this_month: usesThisMonth,
          unique_users: uniqueUsers
        } as ToolStats;
      } catch {
        return {
          tool_name: 'Title Generator',
          total_uses: 0,
          uses_today: 0,
          uses_this_week: 0,
          uses_this_month: 0,
          unique_users: 0
        } as ToolStats;
      }
    }
  });

  // Fetch Word Usage statistics across all users
  const { data: wordUsageStats, isLoading: wordUsageLoading } = useQuery({
    queryKey: ['admin-word-usage-stats'],
    queryFn: async () => {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        const { data: usageData, error } = await (supabase as any)
          .from('user_tool_usage')
          .select('user_id, word_usage, max_words, month')
          .eq('month', currentMonth);
        
        if (error) throw error;

        const totalWordsUsed = usageData?.reduce((sum: number, u: any) => sum + (u.word_usage || 0), 0) || 0;
        const totalWordsAllowed = usageData?.reduce((sum: number, u: any) => sum + (u.max_words || 40000), 0) || 0;
        const usersWithUsage = usageData?.length || 0;
        const avgUsagePerUser = usersWithUsage > 0 ? Math.round(totalWordsUsed / usersWithUsage) : 0;

        return {
          total_words_used: totalWordsUsed,
          total_words_allowed: totalWordsAllowed,
          users_with_usage: usersWithUsage,
          avg_usage_per_user: avgUsagePerUser,
          current_month: currentMonth
        };
      } catch {
        return {
          total_words_used: 0,
          total_words_allowed: 0,
          users_with_usage: 0,
          avg_usage_per_user: 0,
          current_month: new Date().toISOString().slice(0, 7)
        };
      }
    }
  });

  const isLoading = userStatsLoading || aiStatsLoading || videoStatsLoading || scriptStatsLoading || seoStatsLoading || titleStatsLoading || wordUsageLoading;

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

      {/* Script Generator & SEO Generator Usage */}
      <div>
        <h3 className="text-lg font-semibold text-[#f1f1f1] mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#cc0000]" />
          Content Generation Tools
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Script Generator Stats */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-400" />
                <span className="text-[#f1f1f1]">Script Generator</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Total Scripts</span>
                  <span className="text-[#f1f1f1] font-bold">{scriptStats?.total_uses || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Today</span>
                  <span className="text-green-400 font-medium">{scriptStats?.uses_today || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">This Week</span>
                  <span className="text-blue-400 font-medium">{scriptStats?.uses_this_week || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">This Month</span>
                  <span className="text-purple-400 font-medium">{scriptStats?.uses_this_month || 0}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#272727] pt-2 mt-2">
                  <span className="text-[#aaaaaa] text-sm">Unique Users</span>
                  <span className="text-[#cc0000] font-medium">{scriptStats?.unique_users || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Total Words Generated</span>
                  <span className="text-yellow-400 font-medium">{(scriptStats?.total_words || 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEO Generator Stats */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Tags className="w-5 h-5 text-cyan-400" />
                <span className="text-[#f1f1f1]">SEO Generator</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Total SEO Generated</span>
                  <span className="text-[#f1f1f1] font-bold">{seoStats?.total_uses || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Today</span>
                  <span className="text-green-400 font-medium">{seoStats?.uses_today || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">This Week</span>
                  <span className="text-blue-400 font-medium">{seoStats?.uses_this_week || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">This Month</span>
                  <span className="text-purple-400 font-medium">{seoStats?.uses_this_month || 0}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#272727] pt-2 mt-2">
                  <span className="text-[#aaaaaa] text-sm">Unique Users</span>
                  <span className="text-[#cc0000] font-medium">{seoStats?.unique_users || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Title Generator Stats */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Type className="w-5 h-5 text-purple-400" />
                <span className="text-[#f1f1f1]">Title Generator</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Total Titles Generated</span>
                  <span className="text-[#f1f1f1] font-bold">{titleStats?.total_uses || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Today</span>
                  <span className="text-green-400 font-medium">{titleStats?.uses_today || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">This Week</span>
                  <span className="text-blue-400 font-medium">{titleStats?.uses_this_week || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">This Month</span>
                  <span className="text-purple-400 font-medium">{titleStats?.uses_this_month || 0}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#272727] pt-2 mt-2">
                  <span className="text-[#aaaaaa] text-sm">Unique Users</span>
                  <span className="text-[#cc0000] font-medium">{titleStats?.unique_users || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Word Usage Stats */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-pink-400" />
                <span className="text-[#f1f1f1]">Monthly Word Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Current Month</span>
                  <span className="text-[#f1f1f1] font-medium">{wordUsageStats?.current_month || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Total Words Used</span>
                  <span className="text-[#f1f1f1] font-bold">{(wordUsageStats?.total_words_used || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Users with Usage</span>
                  <span className="text-blue-400 font-medium">{wordUsageStats?.users_with_usage || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#aaaaaa] text-sm">Avg per User</span>
                  <span className="text-purple-400 font-medium">{(wordUsageStats?.avg_usage_per_user || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#272727] pt-2 mt-2">
                  <span className="text-[#aaaaaa] text-sm">Total Limit Across Users</span>
                  <span className="text-green-400 font-medium">{(wordUsageStats?.total_words_allowed || 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminStatsSection;
