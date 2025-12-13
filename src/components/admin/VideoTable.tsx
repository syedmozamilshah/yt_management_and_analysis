
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Heart, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import DeleteVideoDialog from './DeleteVideoDialog';
import BulkDeleteDialog from './BulkDeleteDialog';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';

interface VideoTableProps {
  videos: Video[];
  onEdit: (video: Video) => void;
  onDelete: (id: string) => void;
  deleteLoading: string | null;
  onFavoriteUpdate?: () => void;
}

const VideoTable = ({ videos, onEdit, onDelete, deleteLoading, onFavoriteUpdate }: VideoTableProps) => {
  const { toast } = useToast();
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const toggleFavorite = async (video: Video) => {
    try {
      const { error } = await supabase
        .from('videos')
        .update({ is_favorite: !video.is_favorite })
        .eq('id', video.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: video.is_favorite ? "Removed from favorites" : "Added to favorites"
      });

      if (onFavoriteUpdate) {
        onFavoriteUpdate();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive"
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVideos(videos.map(video => video.id));
    } else {
      setSelectedVideos([]);
    }
  };

  const handleSelectVideo = (videoId: string, checked: boolean) => {
    if (checked) {
      setSelectedVideos(prev => [...prev, videoId]);
    } else {
      setSelectedVideos(prev => prev.filter(id => id !== videoId));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    
    try {
      console.log('Attempting to delete videos with ids:', selectedVideos);
      
      const { error } = await supabase
        .from('videos')
        .delete()
        .in('id', selectedVideos);

      if (error) {
        console.error('Supabase bulk delete error:', error);
        throw new Error(`Bulk delete failed: ${error.message}`);
      }

      console.log('Videos deleted successfully');
      
      toast({
        title: "Success",
        description: `${selectedVideos.length} video(s) deleted successfully!`
      });

      setSelectedVideos([]);
      
      if (onFavoriteUpdate) {
        onFavoriteUpdate();
      }
    } catch (error) {
      console.error('Error deleting videos:', error);
      toast({
        title: "Error",
        description: `Failed to delete videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const isAllSelected = videos.length > 0 && selectedVideos.length === videos.length;
  const isPartiallySelected = selectedVideos.length > 0 && selectedVideos.length < videos.length;

  return (
    <div className="bg-[#181818] rounded-xl border border-[#272727] shadow-2xl overflow-hidden">
      <div className="px-6 py-5 bg-[#0f0f0f]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Videos</h2>
            <p className="text-sm text-[#aaaaaa] mt-1">Manage your video collection</p>
          </div>
          {selectedVideos.length > 0 && (
            <BulkDeleteDialog
              selectedCount={selectedVideos.length}
              onBulkDelete={handleBulkDelete}
              isDeleting={bulkDeleteLoading}
            />
          )}
        </div>
      </div>
      
      {videos.length === 0 ? (
        <div className="text-center py-12 bg-[#181818]">
          <p className="text-[#aaaaaa] text-base">No videos added yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0f0f0f] border-b border-[#272727]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className="border-[#272727]"
                    {...(isPartiallySelected && !isAllSelected ? { 'data-state': 'indeterminate' } : {})}
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  Thumbnail
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-[#aaaaaa] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272727]">
              {videos.map((video, index) => (
                <tr key={video.id} className={`hover:bg-[#212121] transition-colors ${index % 2 === 0 ? 'bg-[#181818]' : 'bg-[#0f0f0f]'}`}>
                  <td className="px-6 py-4">
                    <Checkbox
                      checked={selectedVideos.includes(video.id)}
                      onCheckedChange={(checked) => handleSelectVideo(video.id, checked as boolean)}
                      className="border-[#272727]"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <div className="text-sm font-medium text-white truncate" title={video.title}>
                        {video.title}
                      </div>
                      <div className="text-xs text-[#aaaaaa] mt-1">
                        {video.channel_name || 'Unknown Channel'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex-shrink-0">
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-20 h-12 object-cover rounded-lg border border-[#272727]"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white">
                      {video.channel_name || 'N/A'}
                    </div>
                    {video.channel_subscribers && (
                      <div className="text-xs text-[#aaaaaa]">
                        {formatNumber(video.channel_subscribers)} subscribers
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">
                      {video.view_count ? formatNumber(video.view_count) : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white">
                      {video.upload_date ? formatDate(video.upload_date) : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFavorite(video)}
                        className={`h-8 w-8 p-0 border-[#272727] transition-all duration-200 ${
                          video.is_favorite 
                            ? 'bg-[#cc0000] hover:bg-[#aa0000] border-[#cc0000] shadow-lg shadow-red-500/25' 
                            : 'bg-[#212121] hover:bg-[#272727]'
                        }`}
                      >
                        <Heart 
                          className={`h-4 w-4 ${
                            video.is_favorite ? 'fill-white text-white' : 'text-[#aaaaaa]'
                          }`}
                        />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(video)}
                        className="h-8 w-8 p-0 bg-[#212121] hover:bg-[#272727] border-[#272727] text-[#aaaaaa] hover:text-white transition-all duration-200"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DeleteVideoDialog
                        video={video}
                        onDelete={onDelete}
                        isDeleting={deleteLoading === video.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VideoTable;
