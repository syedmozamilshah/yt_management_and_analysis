
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Users, Video, Eye, AlertTriangle } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Channel {
  id: string;
  channel_name: string;
  channel_id?: string | null;
  total_videos: number;
  channel_subscribers?: number | null;
  total_views?: number | null;
  last_updated?: string | null;
  created_at: string;
}

const ManageChannelsSection = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('channel_name', { ascending: true });

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

  const deleteChannel = async (channelId: string, channelName: string) => {
    setDeleteLoading(channelId);
    
    try {
      // First delete all videos for this channel
      const { error: videosError } = await supabase
        .from('videos')
        .delete()
        .eq('channel_name', channelName);

      if (videosError) throw videosError;

      // Then delete the channel itself
      const { error: channelError } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId);

      if (channelError) throw channelError;

      toast({
        title: "Success",
        description: `Channel "${channelName}" and all its videos have been deleted`
      });

      await fetchChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: "Error",
        description: `Failed to delete channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[#272727] rounded mb-4 w-1/3"></div>
          <div className="h-64 bg-[#272727] rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Manage Channels 🗂️</h2>
        <p className="text-[#aaaaaa] text-lg">
          View and manage all channels in your database
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              <Eye className="w-5 h-5 text-[#cc0000]" />
              <div>
                <p className="text-sm text-[#aaaaaa]">Total Views</p>
                <p className="text-2xl font-bold text-white">
                  {formatNumber(channels.reduce((sum, ch) => sum + (ch.total_views || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {channels.length === 0 ? (
        <Card className="bg-[#181818] border-[#272727] max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">🗂️</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Channels Found!</h3>
            <p className="text-[#aaaaaa] mb-4">
              No channels are currently in your database
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#181818] border-[#272727]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              All Channels ({channels.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#272727]">
                    <TableHead className="text-[#aaaaaa]">Channel Name</TableHead>
                    <TableHead className="text-[#aaaaaa]">Videos</TableHead>
                    <TableHead className="text-[#aaaaaa]">Subscribers</TableHead>
                    <TableHead className="text-[#aaaaaa]">Total Views</TableHead>
                    <TableHead className="text-[#aaaaaa]">Last Updated</TableHead>
                    <TableHead className="text-[#aaaaaa]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((channel) => (
                    <TableRow key={channel.id} className="border-[#272727] hover:bg-[#212121]">
                      <TableCell className="text-white font-medium">
                        {channel.channel_name}
                      </TableCell>
                      <TableCell className="text-[#aaaaaa]">
                        <div className="flex items-center gap-1">
                          <Video className="w-4 h-4" />
                          {channel.total_videos}
                        </div>
                      </TableCell>
                      <TableCell className="text-[#aaaaaa]">
                        {channel.channel_subscribers ? formatNumber(channel.channel_subscribers) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-[#aaaaaa]">
                        {channel.total_views ? formatNumber(channel.total_views) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-[#aaaaaa] text-sm">
                        {channel.last_updated ? formatDate(channel.last_updated) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deleteLoading === channel.id}
                              className="border-[#272727] text-[#cc0000] hover:bg-[#272727]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#181818] border-[#272727]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-[#cc0000]" />
                                Delete Channel
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-[#aaaaaa]">
                                Are you sure you want to delete the channel "<span className="font-semibold text-white">{channel.channel_name}</span>"?
                                <br />
                                <br />
                                <span className="text-[#cc0000] font-semibold">
                                  This will also delete all {channel.total_videos} video{channel.total_videos !== 1 ? 's' : ''} from this channel.
                                </span>
                                <br />
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-[#272727] text-[#aaaaaa] hover:bg-[#272727]">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteChannel(channel.id, channel.channel_name)}
                                className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
                              >
                                {deleteLoading === channel.id ? 'Deleting...' : 'Delete Channel'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManageChannelsSection;
