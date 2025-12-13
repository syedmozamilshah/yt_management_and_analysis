
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import VideoManagementSection from './sections/VideoManagementSection';
import { Video } from '@/types/video';
import { useAuth } from '@/contexts/AuthContext';

const AdminVideoManagement = () => {
  console.log('AdminVideoManagement rendered');
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, shouldQueryAllData } = useAuth();

  const { data: videos = [], refetch } = useQuery({
    queryKey: ['admin-videos', shouldQueryAllData()],
    queryFn: async () => {
      console.log('Fetching admin videos, shouldQueryAllData:', shouldQueryAllData());
      
      if (shouldQueryAllData()) {
        // Admin in "all-data" mode: fetch ALL videos from user_videos
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        console.log('Fetched all user videos:', data?.length);
        return (data || []) as Video[];
      } else {
        // Admin in "my-data" mode: fetch only admin's own videos from user_videos
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        console.log('Fetched admin own videos:', data?.length);
        return (data || []) as Video[];
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete from user_videos table
      const { error } = await (supabase as any)
        .from('user_videos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Video deleted successfully!"
      });
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
    },
    onError: (error) => {
      console.error('Error deleting video:', error);
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive"
      });
    }
  });

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleVideoUpdated = () => {
    setEditingVideo(null);
    refetch();
  };

  const handleCancelEdit = () => {
    setEditingVideo(null);
  };

  return (
    <VideoManagementSection
      videos={videos}
      onEdit={handleEdit}
      onDelete={handleDelete}
      deleteLoading={deleteLoading}
      onFavoriteUpdate={refetch}
      editingVideo={editingVideo}
      onVideoUpdated={handleVideoUpdated}
      onCancelEdit={handleCancelEdit}
    />
  );
};

export default AdminVideoManagement;
