import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Trash2, Youtube, Loader2, Sparkles, Save, RotateCcw, Pencil, X } from 'lucide-react';
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

interface TrackedChannel {
  id: string;
  channel_id: string;
  channel_name: string | null;
  channel_thumbnail: string | null;
}

interface TrackedChannelsDrawerProps {
  trigger?: React.ReactNode;
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

export const TrackedChannelsDrawer: React.FC<TrackedChannelsDrawerProps> = ({ trigger }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<TrackedChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<TrackedChannel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(30);
  
  // AI Prompts state
  const [prompts, setPrompts] = useState(DEFAULT_AI_PROMPTS);
  const [editingTool, setEditingTool] = useState<ToolType | null>(null);

  const fetchChannels = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracked_channels')
        .select('id, channel_id, channel_name, channel_thumbnail')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tracked channels',
        variant: 'destructive'
      });
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
  }, [open, user?.id]);

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

      // Delete all tracked videos for this channel
      const { error: videosError } = await supabase
        .from('tracked_videos')
        .delete()
        .eq('channel_id', deletingChannel.channel_id);

      if (videosError) {
        console.warn('Error deleting tracked videos:', videosError);
      }

      // Delete videos from user_videos table (by channel name)
      if (deletingChannel.channel_name) {
        const { error: userVideosError } = await (supabase as any)
          .from('user_videos')
          .delete()
          .eq('user_id', user?.id)
          .eq('channel_name', deletingChannel.channel_name);

        if (userVideosError) {
          console.warn('Error deleting user videos:', userVideosError);
        }
      }

      // Then delete the channel
      const { error: channelError } = await supabase
        .from('tracked_channels')
        .delete()
        .eq('id', deletingChannel.id);

      if (channelError) throw channelError;

      toast({
        title: 'Channel Deleted',
        description: `${deletingChannel.channel_name || 'Channel'} and all its videos have been removed.`
      });

      // Refresh the list and invalidate video queries for instant UI update
      setChannels(prev => prev.filter(c => c.id !== deletingChannel.id));
      queryClient.invalidateQueries({ queryKey: ['user-videos'] });
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

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger || (
            <Button
              variant="ghost"
              size="icon"
              className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] transition-all duration-200"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </SheetTrigger>
        <SheetContent side="right" className="bg-[#181818] border-l border-[#272727] text-white w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/30">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold">Settings</span>
                <p className="text-sm font-normal text-[#888888]">Manage channels & AI prompts</p>
              </div>
            </SheetTitle>
          </SheetHeader>
          
          {/* Tracked Channels Section */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Youtube className="w-5 h-5 text-[#cc0000]" />
              <h3 className="text-white font-medium">Tracked Channels</h3>
            </div>
            
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#cc0000] animate-spin" />
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-6 bg-[#0f0f0f] rounded-lg border border-[#272727]">
                  <Youtube className="w-8 h-8 text-[#272727] mx-auto mb-2" />
                  <p className="text-[#888888] text-sm">No tracked channels yet</p>
                  <p className="text-xs text-[#666666] mt-1">
                    Add channels from the sidebar
                  </p>
                </div>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#272727] rounded-lg group hover:border-[#404040] transition-all"
                  >
                    {channel.channel_thumbnail ? (
                      <img
                        src={channel.channel_thumbnail}
                        alt={channel.channel_name || ''}
                        className="w-9 h-9 rounded-full"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#272727] flex items-center justify-center">
                        <Youtube className="w-4 h-4 text-[#666666]" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {channel.channel_name || 'Unknown Channel'}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingChannel(channel)}
                      className="opacity-0 group-hover:opacity-100 text-[#888888] hover:text-red-500 hover:bg-red-500/10 transition-all h-8 w-8"
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
    </>
  );
};
