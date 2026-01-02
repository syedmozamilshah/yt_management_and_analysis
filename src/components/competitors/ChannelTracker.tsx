import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Loader2, 
  Youtube, 
  Bell, 
  BellOff, 
  Trash2, 
  ExternalLink,
  RefreshCw,
  Clock,
  Eye,
  Rss,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  TrackedChannel,
  TrackedVideo,
  addTrackedChannel,
  getTrackedChannels,
  getTrackedVideos,
  removeTrackedChannel,
  updateUserActivity,
  formatRelativeTime
} from '@/services/channelTrackerService';

const ChannelTracker: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [channelUrl, setChannelUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [channels, setChannels] = useState<TrackedChannel[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Fetch channels and videos on mount
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      const [channelsData, videosData] = await Promise.all([
        getTrackedChannels(),
        getTrackedVideos(50)
      ]);
      
      setChannels(channelsData);
      setVideos(videosData);
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tracked channels',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Update user activity and fetch data on mount
  useEffect(() => {
    if (user) {
      updateUserActivity();
      fetchData();
    }
  }, [user, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !refreshing) {
        fetchData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, isLoading, refreshing]);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!channelUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a YouTube channel URL',
        variant: 'destructive'
      });
      return;
    }

    setIsAdding(true);

    try {
      const result = await addTrackedChannel(channelUrl);
      
      toast({
        title: '✅ Channel Added!',
        description: `Now tracking ${result.channel_name}. You'll be notified of new uploads.`
      });

      setChannelUrl('');
      fetchData();
    } catch (error: any) {
      console.error('Error adding channel:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add channel',
        variant: 'destructive'
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveChannel = async (channel: TrackedChannel) => {
    try {
      await removeTrackedChannel(channel.channel_id);
      
      toast({
        title: 'Channel Removed',
        description: `Stopped tracking ${channel.channel_name}`
      });

      fetchData();
    } catch (error: any) {
      console.error('Error removing channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove channel',
        variant: 'destructive'
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const openYouTubeVideo = (url: string | null, videoId: string) => {
    const finalUrl = url || `https://www.youtube.com/watch?v=${videoId}`;
    window.open(finalUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#cc0000] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Add Channel Form */}
      <div className="bg-[#181818] border border-[#272727] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Track a Channel</h3>
            <p className="text-sm text-[#888888]">Get instant notifications when they upload</p>
          </div>
        </div>

        <form onSubmit={handleAddChannel} className="flex gap-3">
          <Input
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            placeholder="@channelname or youtube.com/channel/..."
            className="flex-1 bg-[#0f0f0f] border-[#272727] text-white placeholder:text-[#666666]"
            disabled={isAdding}
          />
          <Button
            type="submit"
            disabled={isAdding || !channelUrl.trim()}
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Rss className="w-4 h-4 mr-2" />
                Track
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Tracked Channels */}
      {channels.length > 0 && (
        <div className="bg-[#181818] border border-[#272727] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#cc0000]" />
              Tracked Channels ({channels.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="bg-[#0f0f0f] border border-[#272727] rounded-lg p-4 flex items-center gap-3 group hover:border-[#cc0000]/30 transition-all"
              >
                {channel.channel_thumbnail ? (
                  <img
                    src={channel.channel_thumbnail}
                    alt={channel.channel_name || ''}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#272727] flex items-center justify-center">
                    <Youtube className="w-6 h-6 text-[#666666]" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{channel.channel_name}</p>
                  <p className="text-sm text-[#888888]">
                    {channel.channel_handle || channel.channel_id}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {channel.webhook_subscribed ? (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveChannel(channel)}
                  className="opacity-0 group-hover:opacity-100 text-[#888888] hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest Videos */}
      <div className="bg-[#181818] border border-[#272727] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Youtube className="w-5 h-5 text-[#cc0000]" />
            Latest Videos
          </h3>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-[#666666]">
                Updated {formatRelativeTime(lastRefresh.toISOString())}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[#888888] hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12">
            <Youtube className="w-12 h-12 text-[#272727] mx-auto mb-4" />
            <p className="text-[#888888]">No videos yet</p>
            <p className="text-sm text-[#666666]">
              Track some channels and new videos will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-[#0f0f0f] border border-[#272727] rounded-lg overflow-hidden group hover:border-[#cc0000]/30 transition-all cursor-pointer"
                onClick={() => openYouTubeVideo(video.youtube_url, video.video_id)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-[#272727]">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Youtube className="w-12 h-12 text-[#666666]" />
                    </div>
                  )}
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="w-8 h-8 text-white" />
                  </div>

                  {/* Source badge */}
                  <div className="absolute top-2 right-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      video.source === 'websub' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {video.source === 'websub' ? 'Live' : 'RSS'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h4 className="text-white font-medium line-clamp-2 mb-2 group-hover:text-[#cc0000] transition-colors">
                    {video.title}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-[#888888]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(video.published_at)}
                    </span>
                    {video.view_count && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {video.view_count.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty state when no channels */}
      {channels.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#cc0000]/20 to-[#aa0000]/20 flex items-center justify-center mx-auto mb-6">
            <Rss className="w-10 h-10 text-[#cc0000]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Start Tracking Competitors
          </h3>
          <p className="text-[#888888] max-w-md mx-auto">
            Add YouTube channels above to automatically track their new uploads.
            You'll get real-time notifications when they post new videos.
          </p>
        </div>
      )}
    </div>
  );
};

export default ChannelTracker;
