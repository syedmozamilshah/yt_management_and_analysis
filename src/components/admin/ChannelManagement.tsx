import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Users, Video, TrendingUp, Clock, Search, Plus } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';

interface Channel {
  id: string;
  channel_name: string;
  channel_id?: string | null;
  total_videos: number;
  channel_subscribers?: number | null;
  total_views?: number | null;
  last_updated?: string | null;
  update_status?: string | null;
  created_at: string;
}

interface UpdateLog {
  id: string;
  update_type: string;
  status: string;
  error_message?: string | null;
  api_calls_used?: number | null;
  created_at: string;
}

const ChannelManagement = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [updateLogs, setUpdateLogs] = useState<UpdateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingChannels, setUpdatingChannels] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchChannels();
    fetchUpdateLogs();
  }, []);

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast({
        title: "Error",
        description: "Failed to load channels",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUpdateLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('channel_update_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setUpdateLogs(data || []);
    } catch (error) {
      console.error('Error fetching update logs:', error);
    }
  };

  const updateSingleChannel = async (channelId: string, channelName: string) => {
    setUpdatingChannels(prev => new Set(prev).add(channelId));
    
    try {
      console.log(`Updating channel: ${channelName}`);
      
      const { data, error } = await supabase.functions.invoke('get-fresh-channel-stats', {
        body: { channelName }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Channel "${channelName}" updated successfully!`
      });

      await fetchChannels();
      await fetchUpdateLogs();
    } catch (error) {
      console.error('Error updating channel:', error);
      toast({
        title: "Error",
        description: `Failed to update channel "${channelName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setUpdatingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  const updateAllChannels = async () => {
    setBulkUpdating(true);
    
    try {
      console.log('Starting bulk channel update...');
      
      const { data, error } = await supabase.functions.invoke('update-all-channels', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "All channels update initiated successfully!"
      });

      await fetchChannels();
      await fetchUpdateLogs();
    } catch (error) {
      console.error('Error updating all channels:', error);
      toast({
        title: "Error",
        description: `Failed to update all channels: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const autoDiscoverVideos = async () => {
    setAutoDiscovering(true);
    
    try {
      console.log('Starting auto-discovery of new videos...');
      
      const { data, error } = await supabase.functions.invoke('auto-discover-videos', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Auto-discovery completed! ${data.totalNewVideos || 0} new videos found and added.`
      });

      await fetchChannels();
      await fetchUpdateLogs();
    } catch (error) {
      console.error('Error in auto-discovery:', error);
      toast({
        title: "Error",
        description: `Auto-discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setAutoDiscovering(false);
    }
  };

  const refreshChannelsFromVideos = async () => {
    try {
      const { data, error } = await supabase.rpc('populate_channels_from_videos');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: "Channels refreshed from video database!"
      });

      await fetchChannels();
    } catch (error) {
      console.error('Error refreshing channels:', error);
      toast({
        title: "Error",
        description: "Failed to refresh channels from videos",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-[#cc0000]">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'updating':
        return <Badge variant="secondary">Updating</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[#272727] rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-[#272727] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Channel Management</h2>
          <p className="text-[#aaaaaa]">
            Manage and update channel statistics from your video database
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={refreshChannelsFromVideos}
            variant="outline"
            className="border-[#272727] text-[#aaaaaa] hover:bg-[#272727]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh from Videos
          </Button>
          <Button
            onClick={autoDiscoverVideos}
            disabled={autoDiscovering}
            variant="outline"
            className="border-[#272727] text-[#aaaaaa] hover:bg-[#272727]"
          >
            {autoDiscovering ? (
              <Search className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Auto-Discover Videos
          </Button>
          <Button
            onClick={updateAllChannels}
            disabled={bulkUpdating}
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
          >
            {bulkUpdating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4 mr-2" />
            )}
            Update All Channels
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#cc0000]" />
              <div>
                <p className="text-sm text-[#aaaaaa]">Total Channels</p>
                <p className="text-2xl font-bold text-white">{channels.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Video className="w-5 h-5 text-[#cc0000]" />
              <div>
                <p className="text-sm text-[#aaaaaa]">Total Videos</p>
                <p className="text-2xl font-bold text-white">
                  {channels.reduce((sum, ch) => sum + ch.total_videos, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-[#cc0000]" />
              <div>
                <p className="text-sm text-[#aaaaaa]">Total Subscribers</p>
                <p className="text-2xl font-bold text-white">
                  {formatNumber(channels.reduce((sum, ch) => sum + (ch.channel_subscribers || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#cc0000]" />
              <div>
                <p className="text-sm text-[#aaaaaa]">Recently Updated</p>
                <p className="text-2xl font-bold text-white">
                  {channels.filter(ch => ch.update_status === 'success').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((channel) => (
          <Card key={channel.id} className="bg-[#181818] border-[#272727] hover:border-[#404040] transition-all">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-white text-lg truncate">
                  {channel.channel_name}
                </CardTitle>
                {getStatusBadge(channel.update_status)}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#aaaaaa]">Videos:</span>
                  <div className="text-white font-semibold">{channel.total_videos}</div>
                </div>
                <div>
                  <span className="text-[#aaaaaa]">Subscribers:</span>
                  <div className="text-white font-semibold">
                    {channel.channel_subscribers ? formatNumber(channel.channel_subscribers) : 'N/A'}
                  </div>
                </div>
              </div>
              
              {channel.total_views && (
                <div className="text-sm">
                  <span className="text-[#aaaaaa]">Total Views:</span>
                  <div className="text-white font-semibold">{formatNumber(channel.total_views)}</div>
                </div>
              )}

              <div className="text-xs text-[#666666]">
                Last updated: {channel.last_updated ? formatDate(channel.last_updated) : 'Never'}
              </div>

              <Button
                onClick={() => updateSingleChannel(channel.id, channel.channel_name)}
                disabled={updatingChannels.has(channel.id)}
                className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
                size="sm"
              >
                {updatingChannels.has(channel.id) ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Update Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Update Logs */}
      {updateLogs.length > 0 && (
        <Card className="bg-[#181818] border-[#272727]">
          <CardHeader>
            <CardTitle className="text-white">Recent Update Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {updateLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-[#212121] rounded">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(log.status)}
                    <span className="text-[#aaaaaa]">{log.update_type}</span>
                    {log.api_calls_used && (
                      <span className="text-xs text-[#666666]">({log.api_calls_used} API calls)</span>
                    )}
                  </div>
                  <div className="text-xs text-[#666666]">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ChannelManagement;
