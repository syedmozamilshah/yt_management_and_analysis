
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Edit, ExternalLink, Heart, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface UserVideo {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  thumbnail_url: string;
  channel_name: string | null;
  channel_subscribers: number | null;
  upload_date: string | null;
  view_count: number | null;
  niche: string | null;
  is_favorite: boolean | null;
  user_id: string;
  created_at: string;
}

const UserVideoManagement = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVideo, setEditingVideo] = useState<UserVideo | null>(null);
  const [editForm, setEditForm] = useState({ title: '', niche: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['user-videos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserVideo[];
    },
    enabled: !!user?.id
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('user_videos')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Video deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id] });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete video", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; niche: string } }) => {
      const { error } = await (supabase as any)
        .from('user_videos')
        .update(data)
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Video updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id] });
      setEditingVideo(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update video", variant: "destructive" });
    }
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await (supabase as any)
        .from('user_videos')
        .update({ is_favorite: isFavorite })
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id] });
    }
  });

  const handleEdit = (video: UserVideo) => {
    setEditingVideo(video);
    setEditForm({ title: video.title, niche: video.niche || '' });
  };

  const handleSaveEdit = () => {
    if (editingVideo) {
      updateMutation.mutate({ id: editingVideo.id, data: editForm });
    }
  };

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.channel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.niche?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number | null) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#aaaaaa]">Loading your videos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#aaaaaa] w-5 h-5" />
        <Input
          placeholder="Search your videos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
        />
      </div>

      {filteredVideos.length === 0 ? (
        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">📹</div>
            <h3 className="text-2xl font-bold text-[#f1f1f1] mb-2">No Videos Yet!</h3>
            <p className="text-[#aaaaaa] mb-4">
              Start by adding some YouTube videos to your collection
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Edit Dialog */}
          {editingVideo && (
            <Card className="bg-[#181818] border-[#cc0000]/30 mb-6">
              <CardHeader>
                <CardTitle className="text-[#f1f1f1]">Edit Video</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#aaaaaa] mb-2">Title</label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="bg-[#212121] border-[#272727] text-[#f1f1f1]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#aaaaaa] mb-2">Niche</label>
                  <Input
                    value={editForm.niche}
                    onChange={(e) => setEditForm({ ...editForm, niche: e.target.value })}
                    className="bg-[#212121] border-[#272727] text-[#f1f1f1]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveEdit}
                    className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setEditingVideo(null)}
                    className="text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#272727]"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Videos Table */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader>
              <CardTitle className="text-[#f1f1f1]">
                My Videos ({filteredVideos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#272727]">
                      <TableHead className="text-[#aaaaaa]">Thumbnail</TableHead>
                      <TableHead className="text-[#aaaaaa]">Title</TableHead>
                      <TableHead className="text-[#aaaaaa]">Channel</TableHead>
                      <TableHead className="text-[#aaaaaa]">Views</TableHead>
                      <TableHead className="text-[#aaaaaa]">Niche</TableHead>
                      <TableHead className="text-[#aaaaaa]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video) => (
                      <TableRow key={video.id} className="border-[#272727]">
                        <TableCell>
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-24 h-14 object-cover rounded"
                          />
                        </TableCell>
                        <TableCell className="text-[#f1f1f1] max-w-[200px] truncate">
                          {video.title}
                        </TableCell>
                        <TableCell className="text-[#aaaaaa]">
                          {video.channel_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-[#aaaaaa]">
                          {formatNumber(video.view_count)}
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-[#cc0000]/20 text-[#cc0000] rounded text-sm">
                            {video.niche || 'Uncategorized'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavoriteMutation.mutate({ 
                                id: video.id, 
                                isFavorite: !video.is_favorite 
                              })}
                              className={video.is_favorite ? 'text-red-500' : 'text-[#aaaaaa]'}
                            >
                              <Heart className={`w-4 h-4 ${video.is_favorite ? 'fill-current' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(video.youtube_url, '_blank')}
                              className="text-[#aaaaaa] hover:text-[#f1f1f1]"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(video)}
                              className="text-[#aaaaaa] hover:text-[#f1f1f1]"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-[#181818] border-[#272727]">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-[#f1f1f1]">Delete Video</AlertDialogTitle>
                                  <AlertDialogDescription className="text-[#aaaaaa]">
                                    Are you sure you want to delete this video? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-[#272727] text-[#f1f1f1] border-[#272727] hover:bg-[#333333]">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(video.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default UserVideoManagement;
