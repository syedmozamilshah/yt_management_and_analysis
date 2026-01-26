import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Trash2, Youtube, Loader2, Sparkles, Save, RotateCcw, Pencil, X, Globe, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { getAIPrompts, saveAIPrompts, DEFAULT_AI_PROMPTS } from '@/services/transcriptService';
import { unsubscribeFromWebhook } from '@/services/channelTrackerService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type TabType = 'usa' | 'spanish' | 'ideation';

interface TrackedChannel {
  id: string;
  channel_id: string;
  channel_name: string | null;
  channel_thumbnail: string | null;
  is_global?: boolean;
  user_id?: string;
  tab_type?: string;
}

interface TrackedChannelsDrawerProps {
  trigger?: React.ReactNode;
  showAllUsers?: boolean;
  tabType?: TabType;
}

type ToolType = 'claude' | 'gemini' | 'gpt';

interface Tool {
  id: ToolType;
  name: string;
  icon: string;
}

const tools: Tool[] = [
  { id: 'claude', name: 'Claude', icon: '/logo/claude.png' },
  { id: 'gemini', name: 'Gemini', icon: '/logo/gemini.png' },
  { id: 'gpt', name: 'ChatGPT', icon: '/logo/gpt.png' },
];

export const TrackedChannelsDrawer: React.FC<TrackedChannelsDrawerProps> = ({ trigger, showAllUsers = false, tabType = 'usa' }) => {
  const { toast } = useToast();
  const { user, isAdmin, adminDataMode } = useAuth();
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<TrackedChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<TrackedChannel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(30);
  const [showAdminChannelWarning, setShowAdminChannelWarning] = useState<TrackedChannel | null>(null);
  
  // AI Prompts state
  const [prompts, setPrompts] = useState(DEFAULT_AI_PROMPTS);
  const [editingTool, setEditingTool] = useState<ToolType | null>(null);

  const fetchChannels = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Build query based on context:
      // - Admin in "All Data" mode on Ideation: fetch ALL users' ideation channels
      // - Admin in "My Data" mode or regular user: fetch only their channels
      let query = supabase
        .from('tracked_channels')
        .select('id, channel_id, channel_name, channel_thumbnail, is_global, user_id, tab_type');
      
      // Admin in "All Data" mode on Ideation tab - fetch all users' channels
      const isAdminAllDataIdeation = isAdmin && adminDataMode === 'all-data' && tabType === 'ideation';
      
      if (!isAdminAllDataIdeation) {
        // Regular user or admin in "My Data" mode - only their channels
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching channels:', error);
        throw error;
      }
      
      // Filter by tabType if tab_type column exists
      let filteredData = data?.filter(channel => !channel.tab_type || channel.tab_type === tabType) || [];
      
      // Additional filtering based on tab type:
      // - Country tabs (USA, Spanish): show only global/admin-added channels
      // - Ideation tab: show only user-added (non-global) channels
      if (tabType === 'ideation') {
        // Ideation: only show user's personal channels (not global)
        filteredData = filteredData.filter(channel => !channel.is_global);
      } else {
        // Country tabs: only show global/admin-added channels
        filteredData = filteredData.filter(channel => channel.is_global);
      }
      
      // Deduplicate by channel_id, keeping the first entry (most recent due to ordering)
      const channelMap = new Map<string, TrackedChannel>();
      for (const channel of filteredData) {
        if (!channelMap.has(channel.channel_id)) {
          channelMap.set(channel.channel_id, channel);
        }
      }
      const deduplicatedChannels = Array.from(channelMap.values());
      
      setChannels(deduplicatedChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tracked channels',
        variant: 'destructive'
      });
      setChannels([]); // Clear channels on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchChannels();
      setPrompts(getAIPrompts());
      setEditingTool(null);
    }
  }, [open, user?.id, showAllUsers, tabType, adminDataMode]);

  // Real-time subscription for tracked_channels updates (when admin adds channels for all users)
  useEffect(() => {
    if (!user?.id) return;

    const trackedChannelsSubscription = supabase
      .channel(`tracked-channels-realtime-${tabType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracked_channels',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          // Only refresh if channel belongs to current tab
          if (payload.new?.tab_type === tabType) {
            console.log('Real-time: New tracked channel added for tab', tabType, payload.new);
            if (open) {
              fetchChannels();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tracked_channels',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: Tracked channel deleted', payload.old);
          if (open) {
            fetchChannels();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(trackedChannelsSubscription);
    };
  }, [user?.id, open, tabType]);

  // Timer effect for deletion countdown
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isDeleting && deleteTimer > 0) {
      interval = setInterval(() => {
        setDeleteTimer(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDeleting, deleteTimer]);

  const handleDeleteChannel = async () => {
    if (!deletingChannel) return;
    
    setIsDeleting(true);
    setDeleteTimer(30);
    try {
      // First unsubscribe from WebSub to stop receiving new videos
      try {
        await unsubscribeFromWebhook(deletingChannel.channel_id);
      } catch (e) {
        console.warn('Failed to unsubscribe from WebSub:', e);
      }

      // If admin is deleting a global channel, use the delete_global_channel function
      if (deletingChannel.is_global && isAdmin) {
        const { data: deleteResult, error: deleteError } = await supabase
          .rpc('delete_global_channel', { p_channel_id: deletingChannel.channel_id });
        
        if (deleteError) {
          console.error('Error deleting global channel:', deleteError);
          throw deleteError;
        }
        
        console.log('Global channel delete result:', deleteResult);
        
        toast({
          title: 'Global Channel Deleted',
          description: `${deletingChannel.channel_name || 'Channel'} has been removed from all users.`
        });
      } else {
        // Regular user deleting their own (non-global) channel
        
        // Delete all tracked videos for this channel
        const { error: videosError } = await supabase
          .from('tracked_videos')
          .delete()
          .eq('channel_id', deletingChannel.channel_id);

        if (videosError) {
          console.warn('Error deleting tracked videos:', videosError);
        }

        // Delete videos from user_videos table (by channel_id and tab_type for accuracy)
        const { error: userVideosError } = await (supabase as any)
          .from('user_videos')
          .delete()
          .eq('user_id', user?.id)
          .eq('channel_id', deletingChannel.channel_id)
          .eq('tab_type', tabType);

        if (userVideosError) {
          console.warn('Error deleting user videos:', userVideosError);
        }

        // Delete user channel subscription for this tab
        await (supabase as any)
          .from('user_channel_subscriptions')
          .delete()
          .eq('user_id', user?.id)
          .eq('channel_id', deletingChannel.channel_id)
          .eq('tab_type', tabType);

        // Then delete the channel
        const { error: channelError } = await supabase
          .from('tracked_channels')
          .delete()
          .eq('id', deletingChannel.id);

        if (channelError) throw channelError;

        toast({
          title: 'Channel Deleted',
          description: `${deletingChannel.channel_name || 'Channel'} and all its videos have been removed from ${tabType.toUpperCase()} tab.`
        });
      }

      // Refresh the list and invalidate video queries for instant UI update
      setChannels(prev => prev.filter(c => c.id !== deletingChannel.id));
      queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id, tabType] });
      queryClient.invalidateQueries({ queryKey: ['all-users-videos', tabType] });
      setDeletingChannel(null);
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete channel',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // AI Prompts handlers
  const handleSavePrompt = (tool: ToolType) => {
    saveAIPrompts(prompts);
    toast({
      title: "Prompt Saved",
      description: `Your ${tool === 'gpt' ? 'ChatGPT' : tool.charAt(0).toUpperCase() + tool.slice(1)} prompt has been updated.`
    });
    setEditingTool(null);
  };

  const handleResetPrompt = (tool: ToolType) => {
    setPrompts(prev => ({
      ...prev,
      [tool]: DEFAULT_AI_PROMPTS[tool]
    }));
  };

  const handleCancelEdit = () => {
    setPrompts(getAIPrompts());
    setEditingTool(null);
  };

  const getTabDisplayName = (tab: TabType) => {
    if (tab === 'usa') return 'USA';
    if (tab === 'spanish') return 'Spanish';
    if (tab === 'ideation') return 'Ideation';
    return tab;
  };
  
  const tabDisplayName = getTabDisplayName(tabType);
  const isIdeationTab = tabType === 'ideation';

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger || (
            <Button
              variant="ghost"
              size="icon"
              className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] transition-all duration-200"
              title={`${tabDisplayName} Settings`}
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </SheetTrigger>
        <SheetContent side="right" className="bg-[#181818] border-l border-[#272727] text-white w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/30">
                {isIdeationTab ? <Lightbulb className="w-5 h-5 text-white" /> : <Settings className="w-5 h-5 text-white" />}
              </div>
              <div>
                <span className="text-lg font-semibold">{tabDisplayName} Settings</span>
                <p className="text-sm font-normal text-[#888888]">
                  {isIdeationTab 
                    ? 'Manage your personal channels & AI prompts' 
                    : `Manage channels & AI prompts for ${tabDisplayName}`}
                </p>
              </div>
            </SheetTitle>
          </SheetHeader>
          
          {/* Tracked Channels Section */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              {isIdeationTab ? <Lightbulb className="w-5 h-5 text-[#cc0000]" /> : <Youtube className="w-5 h-5 text-[#cc0000]" />}
              <h3 className="text-white font-medium">
                {isIdeationTab ? 'Your Channels (Ideation)' : `Tracked Channels (${tabDisplayName})`}
              </h3>
            </div>
            
            {/* Info banner for country tabs */}
            {!isIdeationTab && (
              <div className="mb-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  These channels are managed by admin and sync for all users.
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#cc0000] animate-spin" />
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-6 bg-[#0f0f0f] rounded-lg border border-[#272727]">
                  {isIdeationTab ? <Lightbulb className="w-8 h-8 text-[#272727] mx-auto mb-2" /> : <Youtube className="w-8 h-8 text-[#272727] mx-auto mb-2" />}
                  <p className="text-[#888888] text-sm">No tracked channels for {tabDisplayName} yet</p>
                  <p className="text-xs text-[#666666] mt-1">
                    {isIdeationTab 
                      ? 'Add channels using the button above to start tracking' 
                      : 'Channels are added by admin for all users'}
                  </p>
                </div>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#272727] rounded-lg group hover:border-[#404040] transition-all"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#272727] flex items-center justify-center flex-shrink-0">
                      {channel.channel_thumbnail ? (
                        <img
                          src={channel.channel_thumbnail}
                          alt={channel.channel_name || ''}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            img.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`fallback-icon ${channel.channel_thumbnail ? 'hidden' : ''}`}>
                        <Youtube className="w-4 h-4 text-[#666666]" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">
                          {channel.channel_name || 'Unknown Channel'}
                        </p>
                        {channel.is_global && (
                          <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" title="Global channel" />
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // If it's an admin-added channel and user is not admin, show warning
                        if (channel.is_global && !isAdmin) {
                          setShowAdminChannelWarning(channel);
                        } else {
                          setDeletingChannel(channel);
                        }
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition-all h-8 w-8 ${
                        channel.is_global && !isAdmin 
                          ? 'text-[#444444] cursor-not-allowed' 
                          : 'text-[#888888] hover:text-red-500 hover:bg-red-500/10'
                      }`}
                      title={channel.is_global && !isAdmin ? 'Only admins can delete global channels' : 'Delete channel'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-[#272727]" />

          {/* AI Prompts Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#cc0000]" />
              <h3 className="text-white font-medium">AI Prompt Templates</h3>
            </div>
            
            <div className="space-y-2">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="bg-[#0f0f0f] rounded-lg border border-[#272727] overflow-hidden transition-all"
                >
                  {/* Tool Header */}
                  <div 
                    className={`flex items-center justify-between p-3 ${
                      editingTool !== tool.id ? 'cursor-pointer hover:bg-[#181818]' : ''
                    } transition-colors`}
                    onClick={() => editingTool !== tool.id && setEditingTool(tool.id)}
                  >
                    <div className="flex items-center gap-3">
                      <img src={tool.icon} alt={tool.name} className="w-8 h-8 rounded-lg shadow-sm" />
                      <span className="text-[#f1f1f1] font-medium">{tool.name}</span>
                    </div>
                    {editingTool !== tool.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTool(tool.id);
                        }}
                        className="text-[#888888] hover:text-[#cc0000] hover:bg-[#cc0000]/10 gap-1 h-7 text-xs"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelEdit()}
                        className="text-[#888888] hover:text-white hover:bg-[#272727] h-7 w-7"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* Edit Area */}
                  {editingTool === tool.id && (
                    <div className="p-3 pt-0 space-y-3 border-t border-[#272727]">
                      <Textarea
                        value={prompts[tool.id]}
                        onChange={(e) => setPrompts(prev => ({ ...prev, [tool.id]: e.target.value }))}
                        className="bg-[#181818] border-[#272727] text-[#f1f1f1] min-h-[120px] resize-y text-sm focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]/20"
                        placeholder={`Enter your ${tool.name} prompt...`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPrompt(tool.id)}
                          className="text-[#666666] hover:text-[#cc0000] hover:bg-[#cc0000]/10 text-xs h-7 gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </Button>
                        <Button
                          onClick={() => handleSavePrompt(tool.id)}
                          size="sm"
                          className="bg-[#cc0000] hover:bg-[#aa0000] text-white h-7 gap-1 text-xs"
                        >
                          <Save className="w-3 h-3" />
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingChannel} onOpenChange={(open) => {
        // Prevent closing while deleting
        if (isDeleting) return;
        if (!open) setDeletingChannel(null);
      }}>
        <AlertDialogContent className="bg-[#181818] border-[#272727]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Channel</AlertDialogTitle>
            <AlertDialogDescription className="text-[#aaaaaa]">
              {isDeleting ? (
                <span>
                  Deleting <span className="text-white font-medium">{deletingChannel?.channel_name || 'channel'}</span> and all its videos...
                  <span className="block mt-2 text-[#cc0000] font-medium">Time remaining: {deleteTimer}s</span>
                </span>
              ) : (
                <span>
                  Are you sure you want to delete <span className="text-white font-medium">{deletingChannel?.channel_name || 'this channel'}</span>? 
                  All videos from this channel will also be deleted. This action cannot be undone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isDeleting && (
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-[#272727] text-white border-[#404040] hover:bg-[#333333]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteChannel();
                }}
                className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
          {isDeleting && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-6 h-6 text-[#cc0000] animate-spin" />
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Channel Warning Dialog */}
      <AlertDialog open={!!showAdminChannelWarning} onOpenChange={(open) => {
        if (!open) setShowAdminChannelWarning(null);
      }}>
        <AlertDialogContent className="bg-[#181818] border-[#272727]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#cc0000]" />
              Cannot Delete Admin Channel
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#aaaaaa]">
              <span className="text-white font-medium">{showAdminChannelWarning?.channel_name || 'This channel'}</span> was added by an administrator and cannot be deleted by users.
              <br /><br />
              If you need this channel removed, please contact an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowAdminChannelWarning(null)}
              className="bg-[#272727] hover:bg-[#333333] text-white border-[#404040]"
            >
              Understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
