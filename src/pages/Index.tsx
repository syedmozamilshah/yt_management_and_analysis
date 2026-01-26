
import React, { useState, useEffect } from 'react';
import { UserVideoGrid } from '@/components/UserVideoGrid';
import { AllUsersVideoGrid } from '@/components/AllUsersVideoGrid';
import { TitleGeneratorSection } from '@/components/TitleGeneratorSection';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TrackedChannelsDrawer } from '@/components/TrackedChannelsDrawer';
import { ChannelAnalysisDialog } from '@/components/ChannelAnalysisDialog';
import { Globe, User, Plus, Search, Loader2, Users, Lightbulb } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addTrackedChannel } from '@/services/channelTrackerService';

interface ChannelData {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  videos_fetched?: number;
  videos?: Array<{
    id: string;
    video_id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string;
    youtube_url: string | null;
    view_count: number | null;
  }>;
  rss_feed_url?: string;
}

export type TabType = 'usa' | 'spanish' | 'ideation';

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'usa' | 'spanish' | 'ideation' | 'title-generator'>('ideation');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, shouldQueryAllData, adminDataMode, user } = useAuth();
  const { toast } = useToast();

  // Add channel state
  const [addChannelModalOpen, setAddChannelModalOpen] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [daysPeriod, setDaysPeriod] = useState('7');
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analyzedChannelData, setAnalyzedChannelData] = useState<ChannelData | null>(null);

  // Get the display name for the current tab
  const getTabDisplayName = (tab: TabType) => {
    if (tab === 'usa') return 'USA';
    if (tab === 'spanish') return 'Spanish';
    if (tab === 'ideation') return 'Ideation';
    return tab;
  };

  // Track user activity when opening page
  useEffect(() => {
    const updateUserActivity = async () => {
      if (!user?.id) return;
      
      try {
        await (supabase as any)
          .from('user_activity')
          .upsert({
            user_id: user.id,
            last_ideation_opened_at: new Date().toISOString(),
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      } catch (error) {
        console.error('Error updating user activity:', error);
      }
    };

    updateUserActivity();
  }, [user?.id]);

  // Check URL params for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'title-generator') {
      setActiveTab('title-generator');
    } else if (tab === 'spanish') {
      setActiveTab('spanish');
    } else if (tab === 'usa') {
      setActiveTab('usa');
    } else if (tab === 'ideation') {
      // Admin can view Ideation in both modes (All Data shows all users, My Data shows own)
      setActiveTab('ideation');
    } else {
      // Default to Ideation
      setActiveTab('ideation');
    }
  }, [location.search]);

  const handleVideoAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAnalyzeChannel = async () => {
    if (!channelUrl.trim()) return;
    
    setIsAddingChannel(true);
    
    try {
      // Use RSS-based analyze-channel (free, no API quota) with time period filtering
      const result = await addTrackedChannel(channelUrl, parseInt(daysPeriod));
      
      // Store channel data and close the first dialog
      setAnalyzedChannelData({
        channel_id: result.channel_id,
        channel_name: result.channel_name,
        channel_handle: result.channel_handle || null,
        channel_thumbnail: result.channel_thumbnail || null,
        channel_subscribers: result.channel_subscribers,
        videos_fetched: result.videos_fetched,
        videos: result.videos,
        rss_feed_url: result.rss_feed_url
      });
      
      setAddChannelModalOpen(false);
      // Open the analysis dialog instead of navigating
      setAnalysisDialogOpen(true);
    } catch (error: any) {
      console.error('Error adding channel:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add channel. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingChannel(false);
    }
  };

  const handleAnalysisComplete = () => {
    // Reset form state
    setChannelUrl('');
    setDaysPeriod('7');
    setAnalyzedChannelData(null);
    // Trigger refresh
    handleVideoAdded();
  };

  const isVideoTab = activeTab === 'usa' || activeTab === 'spanish' || activeTab === 'ideation';
  const isCountryTab = activeTab === 'usa' || activeTab === 'spanish';
  
  // Users can only add channels in Ideation tab
  // Admin in "All Data" mode can add to country tabs (USA, Spanish) - these will be global for all users
  // Admin in "All Data" mode on Ideation tab: NO add button (viewing all users' data)
  // Admin in "My Data" mode can add to Ideation for personal videos
  const canAddChannel = (isAdmin && isCountryTab && adminDataMode === 'all-data') || 
                        (isAdmin && adminDataMode === 'my-data' && (activeTab === 'ideation' || isCountryTab)) || 
                        (!isAdmin && activeTab === 'ideation');
  
  // Determine if this is a global add (for all users) or personal add
  const isGlobalAdd = isAdmin && isCountryTab;

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

            {/* Header for Video tabs (Ideation, USA, Spanish) */}
            {isVideoTab && (
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
                <div className="px-4 sm:px-8 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                      <div className="flex items-center gap-2">
                        {activeTab === 'ideation' && <Lightbulb className="w-5 h-5 text-[#cc0000]" />}
                        <h1 className="text-xl font-semibold text-white">{getTabDisplayName(activeTab as TabType)}</h1>
                      </div>
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
                    <TrackedChannelsDrawer showAllUsers={shouldQueryAllData()} tabType={activeTab as TabType} />
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="px-4 sm:px-8 py-8">
              {isVideoTab && (
                <>
                  {/* Add Channel Button - Only show for users on Ideation tab, or for admins on any tab */}
                  {canAddChannel && (
                    <div className="mb-6">
                      <Dialog open={addChannelModalOpen} onOpenChange={setAddChannelModalOpen}>
                        <DialogTrigger asChild>
                          <Button
                            className="w-full h-12 bg-[#cc0000] hover:bg-[#aa0000] text-white flex items-center justify-center gap-2 text-lg font-semibold rounded-xl"
                          >
                            <Plus className="w-5 h-5" />
                            {isAdmin && isCountryTab 
                              ? `Add Channel for All Users (${getTabDisplayName(activeTab as TabType)})` 
                              : `Add Channel for ${getTabDisplayName(activeTab as TabType)}`}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#181818] border border-[#272727] text-white sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-2">
                              {activeTab === 'ideation' ? (
                                <Lightbulb className="w-5 h-5 text-[#cc0000]" />
                              ) : (
                                <Users className="w-5 h-5 text-[#cc0000]" />
                              )}
                              {isAdmin && isCountryTab 
                                ? `Add Channel for All Users (${getTabDisplayName(activeTab as TabType)})` 
                                : `Add Channel for ${getTabDisplayName(activeTab as TabType)}`}
                            </DialogTitle>
                            {isAdmin && isCountryTab && (
                              <p className="text-sm text-[#888888] mt-1">
                                This channel will be added to ALL users in the {getTabDisplayName(activeTab as TabType)} tab.
                              </p>
                            )}
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label className="text-[#aaaaaa]">Channel URL or Handle</Label>
                              <Input
                                value={channelUrl}
                                onChange={(e) => setChannelUrl(e.target.value)}
                                placeholder="@channelname or youtube.com/..."
                                className="bg-[#0f0f0f] border-[#272727] text-white placeholder:text-[#666666]"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[#aaaaaa]">Time Period</Label>
                              <Select value={daysPeriod} onValueChange={setDaysPeriod}>
                                <SelectTrigger className="bg-[#0f0f0f] border-[#cc0000] text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#181818] border-[#272727]">
                                  <SelectItem value="7">Last 7 days</SelectItem>
                                  <SelectItem value="28">Last 28 days</SelectItem>
                                  <SelectItem value="90">Last 90 days</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              onClick={handleAnalyzeChannel}
                              disabled={!channelUrl.trim() || isAddingChannel}
                              className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
                            >
                              {isAddingChannel ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Adding Channel...
                                </>
                              ) : (
                                <>
                                  <Search className="w-4 h-4 mr-2" />
                                  Analyze Channel
                                </>
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {/* Video Grid */}
                  {shouldQueryAllData() ? (
                    <AllUsersVideoGrid refreshTrigger={refreshTrigger} tabType={activeTab as TabType} />
                  ) : (
                    <UserVideoGrid refreshTrigger={refreshTrigger} tabType={activeTab as TabType} />
                  )}
                </>
              )}
              
              {activeTab === 'title-generator' && (
                <TitleGeneratorSection />
              )}
            </div>
          </div>
        </SidebarInset>
      </div>

      {/* Channel Analysis Dialog */}
      <ChannelAnalysisDialog
        open={analysisDialogOpen}
        onOpenChange={setAnalysisDialogOpen}
        channelData={analyzedChannelData}
        daysPeriod={parseInt(daysPeriod)}
        onComplete={handleAnalysisComplete}
        tabType={activeTab as TabType}
      />
    </SidebarProvider>
  );
};

export default Index;
