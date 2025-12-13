
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { CompetitorChannelForm } from '@/components/competitors/CompetitorChannelForm';
import { CompetitorChannelsList } from '@/components/competitors/CompetitorChannelsList';
import { CompetitorVideosFilter } from '@/components/competitors/CompetitorVideosFilter';
import { CompetitorVideosList } from '@/components/competitors/CompetitorVideosList';
import { Users, TrendingUp, User, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CompetitorChannel {
  id: string;
  channel_name: string;
  channel_id: string;
  channel_subscribers: number | null;
  total_videos: number | null;
  created_at: string;
}

interface CompetitorVideo {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  thumbnail_url: string;
  channel_name: string;
  channel_subscribers: number;
  view_count: number;
  upload_date: string;
}

const Competitors = () => {
  const [channels, setChannels] = useState<CompetitorChannel[]>([]);
  const [videos, setVideos] = useState<CompetitorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string>('30d');
  const { toast } = useToast();
  const { isAdmin, user, shouldQueryAllData, adminDataMode } = useAuth();

  useEffect(() => {
    fetchCompetitorChannels();
  }, [isAdmin, user?.id, adminDataMode]);

  useEffect(() => {
    if (channels.length > 0) {
      fetchCompetitorVideos();
    }
  }, [channels, selectedDuration]);

  const fetchCompetitorChannels = async () => {
    try {
      if (shouldQueryAllData()) {
        // Admin in "all-data" mode: fetch ALL users' competitor channels
        const { data, error } = await (supabase as any)
          .from('user_competitor_channels')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Deduplicate by channel_name (in case multiple users added the same channel)
        const uniqueChannels = Array.from(
          new Map((data || []).map((ch: CompetitorChannel) => [ch.channel_name, ch])).values()
        );
        setChannels(uniqueChannels as CompetitorChannel[]);
      } else if (user?.id) {
        // Regular users OR admin in "my-data" mode: fetch from user_competitor_channels
        const { data, error } = await (supabase as any)
          .from('user_competitor_channels')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setChannels(data || []);
      } else {
        setChannels([]);
      }
    } catch (error) {
      console.error('Error fetching competitor channels:', error);
      toast({
        title: "Error",
        description: "Failed to load competitor channels",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitorVideos = async () => {
    if (channels.length === 0) return;
    
    setVideosLoading(true);
    try {
      const channelNames = channels.map(channel => channel.channel_name);
      
      // Calculate date filter
      const now = new Date();
      const daysAgo = parseInt(selectedDuration.replace('d', ''));
      const dateFilter = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString();

      if (shouldQueryAllData()) {
        // Admin in "all-data" mode: fetch from both tables
        const [globalResult, userResult] = await Promise.all([
          supabase
            .from('videos')
            .select('*')
            .in('channel_name', channelNames)
            .gte('upload_date', dateFilter)
            .order('view_count', { ascending: false })
            .limit(50),
          (supabase as any)
            .from('user_videos')
            .select('*')
            .in('channel_name', channelNames)
            .gte('upload_date', dateFilter)
            .order('view_count', { ascending: false })
            .limit(50)
        ]);

        if (globalResult.error) throw globalResult.error;
        if (userResult.error) throw userResult.error;

        // Combine and sort by view_count
        const allVideos = [...(globalResult.data || []), ...(userResult.data || [])];
        allVideos.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        setVideos(allVideos.slice(0, 50));
      } else if (user?.id) {
        // Regular users OR admin in "my-data" mode
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('*')
          .eq('user_id', user.id)
          .in('channel_name', channelNames)
          .gte('upload_date', dateFilter)
          .order('view_count', { ascending: false })
          .limit(50);

        if (error) throw error;
        setVideos(data || []);
      }
    } catch (error) {
      console.error('Error fetching competitor videos:', error);
      toast({
        title: "Error",
        description: "Failed to load competitor videos",
        variant: "destructive"
      });
    } finally {
      setVideosLoading(false);
    }
  };

  const handleChannelAdded = () => {
    fetchCompetitorChannels();
  };

  const handleChannelDeleted = () => {
    fetchCompetitorChannels();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            <div className="sticky top-0 z-10 bg-[#181818] border-b border-[#272727] px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg transition-all duration-200" />
                <h1 className="text-xl font-semibold text-[#f1f1f1]">
                  Competitors Tracker
                </h1>
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
            </div>
            
            <div className="p-6 space-y-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-8 h-8 text-[#cc0000]" />
                  <h1 className="text-4xl font-bold text-[#f1f1f1]">
                    Competitor Analysis
                  </h1>
                </div>
                <p className="text-[#aaaaaa] text-lg">
                  {shouldQueryAllData() 
                    ? 'Track and analyze competitors\' most popular videos (All Users Data)'
                    : 'Track and analyze your personal competitor list'
                  }
                </p>
                {!shouldQueryAllData() && user?.email && (
                  <div className="flex items-center gap-2 mt-2">
                    <User className="w-4 h-4 text-[#666666]" />
                    <span className="text-sm text-[#666666]">{user.email}</span>
                  </div>
                )}
              </div>

              {/* Add Channel Form */}
              <CompetitorChannelForm onChannelAdded={handleChannelAdded} isUserSpecific={!isAdmin} />

              {/* Channels List */}
              <CompetitorChannelsList 
                channels={channels} 
                loading={loading}
                onChannelDeleted={handleChannelDeleted}
                isUserSpecific={!isAdmin}
              />

              {/* Video Filters and Results */}
              {channels.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-[#cc0000]" />
                    <h2 className="text-2xl font-bold text-[#f1f1f1]">Top Performing Videos</h2>
                  </div>
                  
                  <CompetitorVideosFilter 
                    selectedDuration={selectedDuration}
                    onDurationChange={setSelectedDuration}
                  />
                  
                  <CompetitorVideosList 
                    videos={videos}
                    loading={videosLoading}
                  />
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Competitors;
