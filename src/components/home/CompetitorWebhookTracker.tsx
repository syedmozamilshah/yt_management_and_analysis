import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Youtube, Loader2, Calendar, Eye, ExternalLink, Trash2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import {
  resolveChannelId,
  subscribeToYouTubeWebhook,
  getLatestCompetitorVideos,
  getSubscribedChannels,
  subscribeToCompetitorVideos,
} from '@/services/competitorWebhookService';
import { supabase } from '@/integrations/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface CompetitorChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  rss_feed_url: string;
  webhook_subscribed: boolean;
  subscription_expires_at: string | null;
  last_webhook_delivery: string | null;
  subscription_status: 'inactive' | 'pending' | 'active' | 'failed';
}

interface CompetitorVideo {
  id: string;
  channel_id: string;
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string | null;
  source: 'websub' | 'rss_polling' | 'manual';
  created_at: string;
}

const CompetitorWebhookTracker = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [channelInput, setChannelInput] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch subscribed channels
  const { data: channels = [], isLoading: loadingChannels, refetch: refetchChannels } = useQuery({
    queryKey: ['competitor-channels', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await getSubscribedChannels();
    },
    enabled: !!user?.id,
  });

  // Fetch latest videos
  const { data: videos = [], isLoading: loadingVideos, refetch: refetchVideos } = useQuery({
    queryKey: ['competitor-videos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await getLatestCompetitorVideos(50);
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Auto-refetch every 30 seconds
  });

  // Delete channel mutation
  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await supabase
        .from('user_competitor_channels')
        .delete()
        .eq('channel_id', channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Channel Removed',
        description: 'Competitor channel has been removed',
      });
      refetchChannels();
      refetchVideos();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Subscribe to WebSub
  const handleSubscribeChannel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelInput.trim() || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please enter a channel URL or handle',
        variant: 'destructive',
      });
      return;
    }

    setSubscribing(true);

    try {
      // Step 1: Resolve channel ID from URL
      const { channel_id, rss_feed_url } = await resolveChannelId(channelInput);

      // Step 2: Save channel to database
      const { error: channelError } = await supabase
        .from('user_competitor_channels')
        .upsert(
          {
            user_id: user.id,
            channel_id,
            channel_name: channelInput,
            rss_feed_url,
          },
          { onConflict: 'user_id,channel_id' }
        );

      if (channelError) throw channelError;

      // Step 3: Subscribe to WebSub
      await subscribeToYouTubeWebhook(channel_id, user.id);

      toast({
        title: 'Success',
        description: `Subscribed to channel. Waiting for webhook verification...`,
      });

      setChannelInput('');
      setAddDialogOpen(false);
      refetchChannels();
    } catch (error) {
      console.error('Error subscribing to channel:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to subscribe to channel',
        variant: 'destructive',
      });
    } finally {
      setSubscribing(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = subscribeToCompetitorVideos((payload) => {
      console.log('New video received:', payload);
      refetchVideos();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, refetchVideos]);

  // Update user activity timestamp
  useEffect(() => {
    if (!user?.id) return;

    const updateActivity = async () => {
      // This can be done via a trigger on the database
      // Or we can call a function to update the timestamp
      console.log('User activity updated');
    };

    updateActivity();
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getThumbnailUrl = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  };

  return (
    <div className="space-y-6">
      {/* Add Channel Section */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#cc0000]/20 to-[#cc0000]/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative bg-[#181818] rounded-2xl p-6 border border-[#272727] hover:border-[#cc0000]/30 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000]/20 to-[#cc0000]/10 border border-[#cc0000]/30 flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#cc0000]" />
            </div>
            <div>
              <h4 className="text-[#f1f1f1] font-semibold">Add Competitor Channel</h4>
              <p className="text-[#666666] text-sm">Real-time video notifications via WebSub</p>
            </div>
          </div>
          <form onSubmit={handleSubscribeChannel} className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]">
                <Youtube className="w-5 h-5" />
              </div>
              <Input
                placeholder="@channelname or youtube.com/@channel"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                disabled={subscribing}
                className="h-11 pl-10 pr-4 bg-[#0f0f0f] border-[#333333] text-[#f1f1f1] placeholder:text-[#555555] focus:border-[#cc0000] focus:ring-2 focus:ring-[#cc0000]/20 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={subscribing || !channelInput.trim()}
              className="bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white h-11 px-6 rounded-xl font-semibold"
            >
              {subscribing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Subscribe
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Subscribed Channels */}
      <div className="space-y-3">
        <h4 className="text-[#f1f1f1] font-semibold flex items-center gap-2">
          <Youtube className="w-5 h-5 text-[#cc0000]" />
          Subscribed Channels ({channels.length})
        </h4>

        {loadingChannels ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#cc0000]" />
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-8 bg-[#0f0f0f]/50 rounded-xl border border-[#272727]">
            <Youtube className="w-12 h-12 text-[#333333] mx-auto mb-3" />
            <p className="text-[#666666]">No subscribed channels yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {channels.map((channel: CompetitorChannel) => (
              <div
                key={channel.id}
                className="p-4 bg-[#181818] border border-[#272727] rounded-xl hover:border-[#333333] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h5 className="text-[#f1f1f1] font-semibold text-sm">{channel.channel_name}</h5>
                    <div className={`flex items-center gap-1.5 text-xs mt-1 ${getStatusColor(channel.subscription_status)}`}>
                      {getStatusIcon(channel.subscription_status)}
                      <span className="capitalize">{channel.subscription_status}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChannelMutation.mutate(channel.channel_id)}
                    disabled={deleteChannelMutation.isPending}
                    className="text-[#666666] hover:text-red-500 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {channel.subscription_expires_at && (
                  <div className="flex items-center gap-2 text-[10px] text-[#666666] bg-[#0f0f0f]/50 px-2 py-1 rounded">
                    <Clock className="w-3 h-3" />
                    <span>
                      Expires: {formatDate(new Date(channel.subscription_expires_at).toISOString())}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest Videos */}
      <div className="space-y-3">
        <h4 className="text-[#f1f1f1] font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#cc0000]" />
          Latest Videos ({videos.length})
        </h4>

        {loadingVideos ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#cc0000]" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-8 bg-[#0f0f0f]/50 rounded-xl border border-[#272727]">
            <Calendar className="w-12 h-12 text-[#333333] mx-auto mb-3" />
            <p className="text-[#666666]">No videos yet. Subscribe to channels to see their videos.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {videos.map((video: any) => (
              <div
                key={video.id}
                className="group relative flex gap-4 p-4 bg-[#181818]/80 backdrop-blur-sm rounded-xl hover:bg-[#1f1f1f] transition-all duration-300 border border-[#272727] hover:border-[#333333]"
              >
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 overflow-hidden rounded-lg">
                  <img
                    src={getThumbnailUrl(video.video_id)}
                    alt={video.title}
                    className="w-32 h-20 object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/320x180?text=No+Image';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[#f1f1f1] text-sm font-medium line-clamp-2 group-hover:text-white transition-colors">
                      {video.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[#666666] text-xs bg-[#0f0f0f] px-2 py-1 rounded">
                        {video.user_competitor_channels?.[0]?.channel_name || 'Unknown Channel'}
                      </span>
                      <span className="text-[#666666] text-xs bg-[#0f0f0f] px-2 py-1 rounded capitalize">
                        {video.source}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#888888]">
                    <span>{formatDate(video.published_at)}</span>
                  </div>
                </div>

                {/* Open in YouTube */}
                <a
                  href={`https://www.youtube.com/watch?v=${video.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[#272727] hover:bg-[#cc0000] rounded-lg transition-colors duration-300 opacity-70 group-hover:opacity-100"
                  title="Open in YouTube"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 bg-[#0f0f0f]/50 border border-[#272727] rounded-xl text-sm text-[#666666]">
        <p className="mb-2">
          <span className="text-[#cc0000] font-semibold">Real-time updates:</span> Videos are delivered via WebSub webhooks
        </p>
        <p className="mb-2">
          <span className="text-[#cc0000] font-semibold">Fallback polling:</span> RSS feeds are checked every 12 hours
        </p>
        <p>
          <span className="text-[#cc0000] font-semibold">Auto-refresh:</span> This page updates every 30 seconds
        </p>
      </div>
    </div>
  );
};

export default CompetitorWebhookTracker;
