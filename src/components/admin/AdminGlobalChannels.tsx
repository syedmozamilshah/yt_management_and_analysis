import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Youtube, 
  Users, 
  Video, 
  Loader2,
  Calendar,
  Tag
} from 'lucide-react';
import { formatNumber } from '@/utils/formatNumbers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GlobalChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string | null;
  channel_subscribers: number | null;
  niche: string;
  video_range_start: string | null;
  video_range_end: string | null;
  is_active: boolean;
  created_at: string;
}

interface GlobalNiche {
  id: string;
  niche: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const AdminGlobalChannels = () => {
  const { toast } = useToast();
  const [channels, setChannels] = useState<GlobalChannel[]>([]);
  const [niches, setNiches] = useState<GlobalNiche[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add channel dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [channelNiche, setChannelNiche] = useState('');
  const [videoRangeStart, setVideoRangeStart] = useState('');
  const [videoRangeEnd, setVideoRangeEnd] = useState('');
  
  // Add niche dialog state
  const [showAddNicheDialog, setShowAddNicheDialog] = useState(false);
  const [addingNiche, setAddingNiche] = useState(false);
  const [newNicheName, setNewNicheName] = useState('');
  const [newNicheDescription, setNewNicheDescription] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch global channels - cast to any for new tables
      const { data: channelData, error: channelError } = await (supabase as any)
        .from('admin_global_channels')
        .select('*')
        .order('created_at', { ascending: false });

      if (channelError) throw channelError;
      setChannels(channelData || []);

      // Fetch global niches - cast to any for new tables
      const { data: nicheData, error: nicheError } = await (supabase as any)
        .from('admin_global_niches')
        .select('*')
        .order('created_at', { ascending: false });

      if (nicheError) throw nicheError;
      setNiches(nicheData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load global channels and niches",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const extractChannelId = async (url: string): Promise<{ channelId: string; channelName: string; thumbnail: string; subscribers: number } | null> => {
    try {
      // Call edge function to get channel info
      const { data, error } = await supabase.functions.invoke('get-channel-videos', {
        body: { 
          channelUrl: url,
          maxVideos: 1 // Just need channel info
        }
      });

      if (error) throw error;
      
      return {
        channelId: data.channelId,
        channelName: data.channelName,
        thumbnail: data.channelThumbnail,
        subscribers: data.channelSubscribers || 0
      };
    } catch (error) {
      console.error('Error extracting channel info:', error);
      return null;
    }
  };

  const handleAddGlobalChannel = async () => {
    if (!channelUrl.trim() || !channelNiche.trim()) {
      toast({
        title: "Error",
        description: "Please provide channel URL and niche",
        variant: "destructive"
      });
      return;
    }

    setAddingChannel(true);
    try {
      // Extract channel info
      const channelInfo = await extractChannelId(channelUrl);
      if (!channelInfo) {
        throw new Error('Could not fetch channel information');
      }

      // Add to admin_global_channels
      const { error } = await (supabase as any)
        .from('admin_global_channels')
        .insert({
          channel_id: channelInfo.channelId,
          channel_name: channelInfo.channelName,
          channel_thumbnail: channelInfo.thumbnail,
          channel_subscribers: channelInfo.subscribers,
          niche: channelNiche,
          video_range_start: videoRangeStart || null,
          video_range_end: videoRangeEnd || null,
          is_active: true
        });

      if (error) throw error;

      // Also fetch and track the channel's videos
      const { data: videosData, error: videosError } = await supabase.functions.invoke('fetch-channel-videos', {
        body: { 
          channelId: channelInfo.channelId,
          channelName: channelInfo.channelName,
          maxVideos: 50 // Fetch recent videos
        }
      });

      if (videosError) {
        console.warn('Warning: Could not fetch channel videos:', videosError);
      }

      toast({
        title: "Success",
        description: `Global channel "${channelInfo.channelName}" added. Videos will sync to all users.`
      });

      // Reset and refresh
      setShowAddDialog(false);
      setChannelUrl('');
      setChannelNiche('');
      setVideoRangeStart('');
      setVideoRangeEnd('');
      fetchData();
    } catch (error) {
      console.error('Error adding global channel:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add global channel",
        variant: "destructive"
      });
    } finally {
      setAddingChannel(false);
    }
  };

  const handleAddGlobalNiche = async () => {
    if (!newNicheName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a niche name",
        variant: "destructive"
      });
      return;
    }

    setAddingNiche(true);
    try {
      const { error } = await (supabase as any)
        .from('admin_global_niches')
        .insert({
          niche: newNicheName.trim(),
          description: newNicheDescription.trim() || null,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Global niche "${newNicheName}" added. It will appear in all users' filters.`
      });

      setShowAddNicheDialog(false);
      setNewNicheName('');
      setNewNicheDescription('');
      fetchData();
    } catch (error) {
      console.error('Error adding global niche:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add global niche",
        variant: "destructive"
      });
    } finally {
      setAddingNiche(false);
    }
  };

  const handleToggleChannelActive = async (channel: GlobalChannel) => {
    try {
      const { error } = await (supabase as any)
        .from('admin_global_channels')
        .update({ is_active: !channel.is_active })
        .eq('id', channel.id);

      if (error) throw error;

      setChannels(prev => prev.map(c => 
        c.id === channel.id ? { ...c, is_active: !c.is_active } : c
      ));

      toast({
        title: channel.is_active ? "Channel Disabled" : "Channel Enabled",
        description: `${channel.channel_name} has been ${channel.is_active ? 'disabled' : 'enabled'}.`
      });
    } catch (error) {
      console.error('Error toggling channel:', error);
      toast({
        title: "Error",
        description: "Failed to update channel status",
        variant: "destructive"
      });
    }
  };

  const handleDeleteChannel = async (channel: GlobalChannel) => {
    if (!confirm(`Are you sure you want to delete "${channel.channel_name}" as a global channel?`)) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('admin_global_channels')
        .delete()
        .eq('id', channel.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `${channel.channel_name} removed from global channels.`
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: "Error",
        description: "Failed to delete channel",
        variant: "destructive"
      });
    }
  };

  const handleDeleteNiche = async (niche: GlobalNiche) => {
    if (!confirm(`Are you sure you want to delete "${niche.niche}" as a global niche?`)) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('admin_global_niches')
        .delete()
        .eq('id', niche.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `${niche.niche} removed from global niches.`
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting niche:', error);
      toast({
        title: "Error",
        description: "Failed to delete niche",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#aaaaaa]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#f1f1f1] flex items-center gap-2">
            <Globe className="w-6 h-6" />
            Global Channels & Niches
          </h2>
          <p className="text-[#aaaaaa] text-sm mt-1">
            Channels and niches added here will appear for ALL users automatically
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAddNicheDialog(true)}
            variant="outline"
            className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1] hover:bg-[#3a3a3a]"
          >
            <Tag className="w-4 h-4 mr-2" />
            Add Global Niche
          </Button>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Global Channel
          </Button>
        </div>
      </div>

      {/* Global Niches */}
      <Card className="bg-[#181818] border-[#272727]">
        <CardHeader>
          <CardTitle className="text-[#f1f1f1] flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Global Niches ({niches.length})
          </CardTitle>
          <CardDescription className="text-[#888888]">
            These niches appear in every user's filter dropdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {niches.length === 0 ? (
            <p className="text-[#888888] text-center py-4">No global niches yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {niches.map((niche) => (
                <Badge 
                  key={niche.id} 
                  variant="secondary"
                  className="bg-[#272727] text-[#f1f1f1] hover:bg-[#3a3a3a] px-3 py-1.5 flex items-center gap-2"
                >
                  <Globe className="w-3 h-3 text-[#cc0000]" />
                  {niche.niche}
                  <button
                    onClick={() => handleDeleteNiche(niche)}
                    className="ml-1 text-[#888888] hover:text-[#cc0000]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Channels */}
      <Card className="bg-[#181818] border-[#272727]">
        <CardHeader>
          <CardTitle className="text-[#f1f1f1] flex items-center gap-2">
            <Youtube className="w-5 h-5 text-[#cc0000]" />
            Global Channels ({channels.length})
          </CardTitle>
          <CardDescription className="text-[#888888]">
            Videos from these channels are automatically synced to all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-[#888888] text-center py-8">
              No global channels yet. Add a channel to sync videos to all users.
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => (
                <div 
                  key={channel.id}
                  className="flex items-center justify-between p-4 bg-[#272727] rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {channel.channel_thumbnail ? (
                      <img 
                        src={channel.channel_thumbnail} 
                        alt={channel.channel_name}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#3a3a3a] flex items-center justify-center">
                        <Youtube className="w-6 h-6 text-[#888888]" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-[#f1f1f1] font-medium flex items-center gap-2">
                        {channel.channel_name}
                        <Badge variant="secondary" className="bg-[#cc0000]/20 text-[#cc0000]">
                          {channel.niche}
                        </Badge>
                        {!channel.is_active && (
                          <Badge variant="secondary" className="bg-[#666666]/20 text-[#888888]">
                            Disabled
                          </Badge>
                        )}
                      </h4>
                      <div className="flex items-center gap-4 text-[#888888] text-sm mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {formatNumber(channel.channel_subscribers || 0)}
                        </span>
                        {channel.video_range_start && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {channel.video_range_start} - {channel.video_range_end || 'Now'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={channel.is_active}
                      onCheckedChange={() => handleToggleChannelActive(channel)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteChannel(channel)}
                      className="text-[#888888] hover:text-[#cc0000] hover:bg-[#3a3a3a]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Channel Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#181818] border-[#272727] text-[#f1f1f1]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#cc0000]" />
              Add Global Channel
            </DialogTitle>
            <DialogDescription className="text-[#888888]">
              This channel's videos will be synced to ALL users automatically
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channelUrl">Channel URL</Label>
              <Input
                id="channelUrl"
                placeholder="https://www.youtube.com/@channelname"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="niche">Niche</Label>
              <Input
                id="niche"
                placeholder="e.g., Tech, Finance, Gaming"
                value={channelNiche}
                onChange={(e) => setChannelNiche(e.target.value)}
                className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rangeStart">Video Range Start (Optional)</Label>
                <Input
                  id="rangeStart"
                  type="date"
                  value={videoRangeStart}
                  onChange={(e) => setVideoRangeStart(e.target.value)}
                  className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rangeEnd">Video Range End (Optional)</Label>
                <Input
                  id="rangeEnd"
                  type="date"
                  value={videoRangeEnd}
                  onChange={(e) => setVideoRangeEnd(e.target.value)}
                  className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1] hover:bg-[#3a3a3a]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddGlobalChannel}
              disabled={addingChannel}
              className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              {addingChannel ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Global Channel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Niche Dialog */}
      <Dialog open={showAddNicheDialog} onOpenChange={setShowAddNicheDialog}>
        <DialogContent className="bg-[#181818] border-[#272727] text-[#f1f1f1]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#cc0000]" />
              Add Global Niche
            </DialogTitle>
            <DialogDescription className="text-[#888888]">
              This niche will appear in ALL users' filter dropdown
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nicheName">Niche Name</Label>
              <Input
                id="nicheName"
                placeholder="e.g., Tech Reviews, Finance Tips"
                value={newNicheName}
                onChange={(e) => setNewNicheName(e.target.value)}
                className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nicheDesc">Description (Optional)</Label>
              <Input
                id="nicheDesc"
                placeholder="Brief description of this niche"
                value={newNicheDescription}
                onChange={(e) => setNewNicheDescription(e.target.value)}
                className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddNicheDialog(false)}
              className="bg-[#272727] border-[#3a3a3a] text-[#f1f1f1] hover:bg-[#3a3a3a]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddGlobalNiche}
              disabled={addingNiche}
              className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              {addingNiche ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Global Niche
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGlobalChannels;
