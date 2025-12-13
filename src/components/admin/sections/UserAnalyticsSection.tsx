import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserPlus, Activity, Clock, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/utils/formatNumbers';

interface UserStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  activeUsersToday: number;
}

const UserAnalyticsSection: React.FC = () => {
  // Fetch user statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: async (): Promise<UserStats> => {
      // Get total users count from auth.users via RPC or admin API
      // Since we can't directly query auth.users from client, we'll need to 
      // use metadata from user_videos table or create an edge function
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get unique users from user_videos table (users who have added videos)
      const { data: allUserVideos, error: videosError } = await (supabase as any)
        .from('user_videos')
        .select('user_id, created_at');

      if (videosError) {
        console.error('Error fetching user stats:', videosError);
        return { totalUsers: 0, newUsersToday: 0, newUsersThisWeek: 0, activeUsersToday: 0 };
      }

      // Calculate unique users
      const uniqueUsers = new Set<string>();
      const newUsersToday = new Set<string>();
      const newUsersWeek = new Set<string>();
      const activeToday = new Set<string>();

      (allUserVideos || []).forEach((video: any) => {
        uniqueUsers.add(video.user_id);
        
        const createdAt = new Date(video.created_at);
        if (createdAt >= new Date(todayStart)) {
          activeToday.add(video.user_id);
        }
      });

      // Try to get user count from auth metadata via edge function
      try {
        const { data: authData, error: authError } = await supabase.functions.invoke('get-user-stats');
        
        if (!authError && authData) {
          return {
            totalUsers: authData.totalUsers || uniqueUsers.size,
            newUsersToday: authData.newUsersToday || 0,
            newUsersThisWeek: authData.newUsersThisWeek || 0,
            activeUsersToday: activeToday.size
          };
        }
      } catch (e) {
        console.log('Edge function not available, using local data');
      }

      return {
        totalUsers: uniqueUsers.size,
        newUsersToday: 0,
        newUsersThisWeek: 0,
        activeUsersToday: activeToday.size
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch recent user activity
  const { data: recentActivity } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('user_id, title, channel_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent activity:', error);
        return [];
      }

      return data || [];
    },
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-[#181818] border-[#272727] animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-[#272727] rounded mb-2"></div>
                <div className="h-4 bg-[#272727] rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-[#cc0000]',
      bgColor: 'bg-[#cc0000]/10'
    },
    {
      title: 'Active Today',
      value: stats?.activeUsersToday || 0,
      icon: Activity,
      color: 'text-[#cc0000]',
      bgColor: 'bg-[#cc0000]/10'
    },
    {
      title: 'New This Week',
      value: stats?.newUsersThisWeek || 0,
      icon: UserPlus,
      color: 'text-[#cc0000]',
      bgColor: 'bg-[#cc0000]/10'
    },
    {
      title: 'New Today',
      value: stats?.newUsersToday || 0,
      icon: UserCheck,
      color: 'text-[#cc0000]',
      bgColor: 'bg-[#cc0000]/10'
    }
  ];

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-[#cc0000]">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#f1f1f1]">User Analytics</h2>
          <p className="text-[#aaaaaa]">Monitor user activity and growth</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-[#181818] border-[#272727]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-[#666666]" />
              </div>
              <div className="text-3xl font-bold text-[#f1f1f1] mb-1">
                {formatNumber(stat.value)}
              </div>
              <div className="text-sm text-[#aaaaaa]">{stat.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="bg-[#181818] border-[#272727]">
        <CardHeader>
          <CardTitle className="text-[#f1f1f1] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#cc0000]" />
            Recent User Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity: any, index: number) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#212121] border border-[#272727]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[#f1f1f1] text-sm font-medium truncate">
                      {activity.title}
                    </p>
                    <p className="text-[#aaaaaa] text-xs">
                      Channel: {activity.channel_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-xs text-[#666666]">
                      {formatTimeAgo(activity.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-[#666666] mx-auto mb-4" />
              <p className="text-[#aaaaaa]">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Stats Summary */}
      <Card className="bg-[#181818] border-[#272727]">
        <CardHeader>
          <CardTitle className="text-[#f1f1f1]">Platform Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[#212121] border border-[#272727] text-center">
              <div className="text-2xl font-bold text-[#cc0000] mb-1">
                {stats?.totalUsers || 0}
              </div>
              <div className="text-sm text-[#aaaaaa]">Registered Users</div>
            </div>
            <div className="p-4 rounded-lg bg-[#212121] border border-[#272727] text-center">
              <div className="text-2xl font-bold text-[#cc0000] mb-1">
                {stats?.activeUsersToday || 0}
              </div>
              <div className="text-sm text-[#aaaaaa]">Active Today</div>
            </div>
            <div className="p-4 rounded-lg bg-[#212121] border border-[#272727] text-center">
              <div className="text-2xl font-bold text-[#cc0000] mb-1">
                {recentActivity?.length || 0}
              </div>
              <div className="text-sm text-[#aaaaaa]">Recent Actions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserAnalyticsSection;
