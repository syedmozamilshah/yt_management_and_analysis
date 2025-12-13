
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Users, Video, Calendar } from 'lucide-react';
import { formatNumber } from '@/utils/formatNumbers';
import { useAuth } from '@/contexts/AuthContext';

interface CompetitorChannel {
  id: string;
  channel_name: string;
  channel_id: string;
  channel_subscribers: number | null;
  total_videos: number | null;
  created_at: string;
}

interface CompetitorChannelsListProps {
  channels: CompetitorChannel[];
  loading: boolean;
  onChannelDeleted: () => void;
  isUserSpecific?: boolean;
}

export const CompetitorChannelsList: React.FC<CompetitorChannelsListProps> = ({
  channels,
  loading,
  onChannelDeleted,
  isUserSpecific = false
}) => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const handleDelete = async (channelId: string, channelName: string) => {
    try {
      const tableName = isUserSpecific || !isAdmin ? 'user_competitor_channels' : 'competitor_channels';
      
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq('id', channelId);

      if (error) throw error;

      toast({
        title: "Channel Removed",
        description: `${channelName} removed from competitors list`
      });

      onChannelDeleted();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: "Error",
        description: "Failed to remove channel",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#f1f1f1]">Competitor Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-[#212121] border-[#272727] animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-[#272727] rounded mb-3"></div>
                <div className="h-3 bg-[#272727] rounded mb-2 w-3/4"></div>
                <div className="h-3 bg-[#272727] rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="bg-[#212121] rounded-2xl p-8 max-w-md mx-auto border border-[#272727]">
          <Users className="w-12 h-12 text-[#aaaaaa] mx-auto mb-4" />
          <p className="text-[#f1f1f1] text-lg font-medium mb-2">No competitors added yet</p>
          <p className="text-[#aaaaaa]">Add your first competitor channel above to start tracking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#f1f1f1]">Competitor Channels</h3>
        <span className="text-sm text-[#aaaaaa]">{channels.length} channels tracked</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <Card key={channel.id} className="bg-[#212121] border-[#272727] hover:border-[#404040] transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-[#f1f1f1] line-clamp-2 leading-tight">
                  {channel.channel_name}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(channel.id, channel.channel_name)}
                  className="text-[#aaaaaa] hover:text-red-400 hover:bg-red-400/10 p-1 h-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2 text-sm text-[#aaaaaa]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{formatNumber(channel.channel_subscribers || 0)} subscribers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  <span>{formatNumber(channel.total_videos || 0)} videos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Added {new Date(channel.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
