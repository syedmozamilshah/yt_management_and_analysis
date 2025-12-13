import React, { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings, Trophy, TrendingUp, Eye, ExternalLink, User, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/utils/formatNumbers';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

interface ChannelStats {
  channel_name: string;
  channel_id: string;
  total_views: number;
  video_count: number;
  channel_subscribers: number;
  niche: string | null;
}

const Viewboard = () => {
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, user, shouldQueryAllData, adminDataMode } = useAuth();

  const fetchFreshChannelData = async () => {
    try {
      console.log('Fetching channel data...');
      
      if (shouldQueryAllData()) {
        // Admin in "all-data" mode: fetch from user_videos table (all users combined)
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('channel_name, channel_subscribers, view_count, niche, video_id');

        if (error) throw error;

        // Aggregate by channel
        const channelMap = new Map<string, ChannelStats>();
        let total = 0;

        (data || []).forEach((video: any) => {
          const channelName = video.channel_name || 'Unknown';
          const existing = channelMap.get(channelName);
          const views = video.view_count || 0;
          total += views;

          if (existing) {
            existing.total_views += views;
            existing.video_count += 1;
          } else {
            channelMap.set(channelName, {
              channel_name: channelName,
              channel_id: '',
              total_views: views,
              video_count: 1,
              channel_subscribers: video.channel_subscribers || 0,
              niche: video.niche
            });
          }
        });

        // Sort by total views
        const sorted = Array.from(channelMap.values()).sort((a, b) => b.total_views - a.total_views);
        setChannelStats(sorted);
        setTotalViews(total);
      } else if (user?.id) {
        // Regular users OR admin in "my-data" mode: fetch from their own user_videos
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('channel_name, channel_subscribers, view_count, niche, video_id')
          .eq('user_id', user.id);

        if (error) throw error;

        // Aggregate by channel
        const channelMap = new Map<string, ChannelStats>();
        let total = 0;

        (data || []).forEach((video: any) => {
          const channelName = video.channel_name || 'Unknown';
          const existing = channelMap.get(channelName);
          const views = video.view_count || 0;
          total += views;

          if (existing) {
            existing.total_views += views;
            existing.video_count += 1;
          } else {
            channelMap.set(channelName, {
              channel_name: channelName,
              channel_id: '',
              total_views: views,
              video_count: 1,
              channel_subscribers: video.channel_subscribers || 0,
              niche: video.niche
            });
          }
        });

        // Sort by total views
        const sorted = Array.from(channelMap.values()).sort((a, b) => b.total_views - a.total_views);
        setChannelStats(sorted);
        setTotalViews(total);
      }
    } catch (error) {
      console.error('Error loading channel data:', error);
      toast({
        title: "Error",
        description: "Failed to load viewboard data.",
        variant: "destructive"
      });
      setChannelStats([]);
      setTotalViews(0);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFreshChannelData();
      setLoading(false);
    };

    loadData();
  }, [isAdmin, user?.id, adminDataMode]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (index === 1) return <Trophy className="w-6 h-6 text-gray-300" />;
    if (index === 2) return <Trophy className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const getRankBorder = (index: number) => {
    if (index === 0) return 'border-l-4 border-l-yellow-400 bg-yellow-400/5';
    if (index === 1) return 'border-l-4 border-l-gray-300 bg-gray-300/5';
    if (index === 2) return 'border-l-4 border-l-amber-600 bg-amber-600/5';
    return '';
  };

  const getChannelLogoUrl = (channelName: string) => {
    const channelLogos: { [key: string]: string } = {
      'ChipCrunch': 'https://yt3.ggpht.com/ytc/AIdro_mJGKzm8XbV8z1kJ9qfG5P1hGqF8E8m-LzQH8VN=s88-c-k-c0x00ffffff-no-rj',
      'NASCAR TODAY': 'https://yt3.ggpht.com/ZC-DZ6hOEQ7ND4NqCgzGQzKgPQDaLmW8yQ7V7hqhA7nWqA=s88-c-k-c0x00ffffff-no-rj',
      'NASCAR OFFTRACK': 'https://yt3.ggpht.com/ytc/AIdro_n4xGhTQGpjL7ynLjxT3Fj8cEMWwBnOKcO-Z7A=s88-c-k-c0x00ffffff-no-rj'
    };
    
    return channelLogos[channelName] || `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=1e40af&color=fff&size=128`;
  };

  const getYouTubeChannelUrl = (channelId: string) => {
    return `https://www.youtube.com/channel/${channelId}`;
  };

  const formatActualNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#0f0f0f]">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen p-6">
              <div className="animate-pulse space-y-6">
                <div className="h-32 bg-[#272727] rounded-xl"></div>
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-[#272727] rounded-lg"></div>
                  ))}
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#181818] border-b border-[#272727] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg transition-all duration-200" />
                  <div>
                    <h1 className="text-xl font-semibold text-[#f1f1f1]">
                      {shouldQueryAllData() ? 'YouTube Analytics Dashboard' : 'My Channel Analytics'}
                    </h1>
                    {!shouldQueryAllData() && user?.email && (
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-3 h-3 text-[#666666]" />
                        <span className="text-xs text-[#666666]">{user.email}</span>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#212121] border border-[#272727]">
                      {shouldQueryAllData() ? (
                        <>
                          <Globe className="w-4 h-4 text-[#cc0000]" />
                          <span className="text-sm text-[#cc0000] font-medium">All Users</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-[#aaaaaa]" />
                          <span className="text-sm text-[#aaaaaa] font-medium">My Data</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => navigate(isAdmin ? '/admin' : '/home')}
                    className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {isAdmin ? 'Admin Panel' : 'Dashboard'}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Total Views Stat */}
              <div className="bg-[#181818] rounded-2xl border border-[#272727] p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-4 rounded-full bg-[#cc0000]/20 border border-[#cc0000]/30">
                    <Eye className="w-12 h-12 text-[#cc0000]" />
                  </div>
                </div>
                <h2 className="text-6xl font-bold text-[#f1f1f1] mb-2">
                  {formatActualNumber(totalViews)}
                </h2>
                <p className="text-[#aaaaaa] text-xl font-medium">
                  {isAdmin ? 'Total Views (Last 28 Days)' : 'Total Views from Your Videos'}
                </p>
                <div className="flex items-center justify-center mt-4 text-[#cc0000]">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  <span className="font-medium">{channelStats.length} channels tracked</span>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-[#181818] rounded-xl border border-[#272727] overflow-hidden">
                <div className="px-6 py-5 bg-[#212121] border-b border-[#272727]">
                  <h2 className="text-2xl font-bold text-[#f1f1f1] flex items-center">
                    <Trophy className="w-6 h-6 mr-3 text-yellow-400" />
                    Channel Rankings
                  </h2>
                  <p className="text-[#aaaaaa] mt-1">
                    {isAdmin ? 'Live data from YouTube API based on your video database' : 'Based on your saved videos'}
                  </p>
                </div>

                {channelStats.length === 0 ? (
                  <div className="text-center py-12 bg-[#181818]">
                    <Eye className="w-16 h-16 text-[#666666] mx-auto mb-4" />
                    <p className="text-[#aaaaaa] text-lg">No channel data available.</p>
                    <p className="text-[#666666] mt-2">Add videos to see channel analytics.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#272727]">
                    {channelStats.map((channel, index) => (
                      <div
                        key={channel.channel_name}
                        className={`p-6 hover:bg-[#212121] transition-all duration-200 ${getRankBorder(index)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getRankIcon(index) && (
                              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#272727] border border-[#404040]">
                                {getRankIcon(index)}
                              </div>
                            )}
                            {!getRankIcon(index) && (
                              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#272727] border border-[#404040]">
                                <span className="text-lg font-bold text-[#aaaaaa]">#{index + 1}</span>
                              </div>
                            )}
                            <Avatar className="w-12 h-12 border-2 border-[#404040]">
                              <AvatarImage 
                                src={getChannelLogoUrl(channel.channel_name)} 
                                alt={channel.channel_name}
                              />
                              <AvatarFallback className="bg-[#cc0000]/20 text-[#cc0000] font-semibold">
                                {channel.channel_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-[#f1f1f1]">{channel.channel_name}</h3>
                                {channel.channel_id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#272727]"
                                    onClick={() => window.open(getYouTubeChannelUrl(channel.channel_id), '_blank')}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-[#aaaaaa]">
                                <span>{formatNumber(channel.channel_subscribers)} subscribers</span>
                                <span>•</span>
                                <span>{channel.video_count} video{channel.video_count !== 1 ? 's' : ''}</span>
                                {channel.niche && (
                                  <>
                                    <span>•</span>
                                    <span className="px-2 py-1 bg-[#cc0000]/20 rounded-md text-[#cc0000] font-medium">
                                      {channel.niche}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-[#f1f1f1]">
                              {formatActualNumber(channel.total_views)}
                            </div>
                            <div className="text-sm text-[#aaaaaa]">views</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Viewboard;
