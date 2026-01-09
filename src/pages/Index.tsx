
import React, { useState, useEffect } from 'react';
import { VideoGrid } from '@/components/VideoGrid';
import { UserVideoGrid } from '@/components/UserVideoGrid';
import { AllUsersVideoGrid } from '@/components/AllUsersVideoGrid';
import { TitleGeneratorSection } from '@/components/TitleGeneratorSection';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { AIPromptsSettingsDrawer } from '@/components/AIPromptsSettingsDrawer';
import { Globe, User, RefreshCw, Youtube, Loader2, Rss, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getTrackedChannels, TrackedChannel } from '@/services/channelTrackerService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'videos' | 'title-generator'>('videos');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, shouldQueryAllData, adminDataMode, user } = useAuth();
  const { toast } = useToast();
  
  // Channel refresh popup state
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [trackedChannels, setTrackedChannels] = useState<TrackedChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [refreshingChannels, setRefreshingChannels] = useState(false);

  // Check URL params for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'title-generator') {
      setActiveTab('title-generator');
    } else {
      // Reset to videos if no tab param or different tab
      setActiveTab('videos');
    }
  }, [location.search]);

  const handleVideoAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Load tracked channels when dialog opens
  const handleOpenRefreshDialog = async () => {
    setRefreshDialogOpen(true);
    setLoadingChannels(true);
    try {
      const channels = await getTrackedChannels();
      setTrackedChannels(channels);
    } catch (error) {
      console.error('Error loading channels:', error);
      toast({
        title: "Error",
        description: "Failed to load tracked channels",
        variant: "destructive"
      });
    } finally {
      setLoadingChannels(false);
    }
  };
  
  // Refresh all channels to fetch new videos
  const handleRefreshAllChannels = async () => {
    setRefreshingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke('poll-rss-feeds');
      
      if (error) {
        throw error;
      }
      
      const inserted = data?.total_videos_inserted || 0;
      toast({
        title: "Channels Refreshed!",
        description: inserted > 0 
          ? `Found ${inserted} new video${inserted === 1 ? '' : 's'}.`
          : "No new videos found."
      });
      
      // Reload channels list
      const channels = await getTrackedChannels();
      setTrackedChannels(channels);
    } catch (err) {
      console.error('Error refreshing channels:', err);
      toast({
        title: "Error",
        description: "Failed to refresh channels",
        variant: "destructive"
      });
    } finally {
      setRefreshingChannels(false);
    }
  };
  
  // Navigate to channel analysis page
  const handleViewChannel = (channel: TrackedChannel) => {
    setRefreshDialogOpen(false);
    navigate(`/competitors?channelId=${encodeURIComponent(channel.channel_id)}&channelName=${encodeURIComponent(channel.channel_name || '')}`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            
            {/* Header - only show for title generator */}
            {activeTab === 'title-generator' && (
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
                <div className="px-4 sm:px-8 py-6">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                    <h1 className="text-xl sm:text-2xl font-semibold text-white">Title Generator</h1>
                  </div>
                </div>
              </div>
            )}

            {/* Minimal header for videos tab */}
            {activeTab === 'videos' && (
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
                <div className="px-4 sm:px-8 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                      {isAdmin && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#212121] border border-[#272727]">
                          {shouldQueryAllData() ? (
                            <>
                              <Globe className="w-4 h-4 text-[#cc0000]" />
                              <span className="text-sm text-[#cc0000] font-medium">Viewing All Users Data</span>
                            </>
                          ) : (
                            <>
                              <User className="w-4 h-4 text-[#aaaaaa]" />
                              <span className="text-sm text-[#aaaaaa] font-medium">Viewing My Data</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Refresh Channels Button */}
                      {!isAdmin && (
                        <Dialog open={refreshDialogOpen} onOpenChange={setRefreshDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleOpenRefreshDialog}
                              className="text-[#888888] hover:text-white hover:bg-[#272727]"
                            >
                              <Rss className="w-4 h-4 mr-2" />
                              Tracked Channels
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#181818] border border-[#272727] text-white sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-white flex items-center gap-2">
                                <Rss className="w-5 h-5 text-[#cc0000]" />
                                Tracked Channels
                              </DialogTitle>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                              {/* Refresh All Button */}
                              <Button
                                onClick={handleRefreshAllChannels}
                                disabled={refreshingChannels || loadingChannels}
                                className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
                              >
                                {refreshingChannels ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Checking for new videos...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Refresh All Channels
                                  </>
                                )}
                              </Button>
                              
                              {/* Channels List */}
                              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {loadingChannels ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 text-[#cc0000] animate-spin" />
                                  </div>
                                ) : trackedChannels.length === 0 ? (
                                  <div className="text-center py-8 text-[#666666]">
                                    <Rss className="w-10 h-10 mx-auto mb-3 text-[#333333]" />
                                    <p>No channels tracked yet.</p>
                                    <p className="text-sm mt-1">Click "Add Channel" in the sidebar to start.</p>
                                  </div>
                                ) : (
                                  trackedChannels.map((channel) => (
                                    <div
                                      key={channel.id}
                                      onClick={() => handleViewChannel(channel)}
                                      className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#272727] rounded-lg hover:border-[#cc0000]/50 cursor-pointer transition-all group"
                                    >
                                      {channel.channel_thumbnail ? (
                                        <img
                                          src={channel.channel_thumbnail}
                                          alt={channel.channel_name || ''}
                                          className="w-10 h-10 rounded-full"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-[#272727] flex items-center justify-center">
                                          <Youtube className="w-5 h-5 text-[#666666]" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">{channel.channel_name}</p>
                                        <p className="text-sm text-[#666666] truncate">{channel.channel_handle || channel.channel_id}</p>
                                      </div>
                                      <ChevronRight className="w-4 h-4 text-[#666666] group-hover:text-[#cc0000] transition-colors" />
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <AIPromptsSettingsDrawer />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="px-4 sm:px-8 py-8">
              {activeTab === 'videos' ? (
                shouldQueryAllData() ? (
                  <AllUsersVideoGrid refreshTrigger={refreshTrigger} />
                ) : (
                  <UserVideoGrid refreshTrigger={refreshTrigger} />
                )
              ) : (
                <TitleGeneratorSection />
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Index;
