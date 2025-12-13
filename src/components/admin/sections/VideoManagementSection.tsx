
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VideoTable from '../VideoTable';
import EditVideoForm from '../EditVideoForm';
import { Video } from '@/types/video';

interface VideoManagementSectionProps {
  videos: Video[];
  onEdit: (video: Video) => void;
  onDelete: (id: string) => void;
  deleteLoading: string | null;
  onFavoriteUpdate: () => void;
  editingVideo: Video | null;
  onVideoUpdated: () => void;
  onCancelEdit: () => void;
}

const VideoManagementSection: React.FC<VideoManagementSectionProps> = ({
  videos,
  onEdit,
  onDelete,
  deleteLoading,
  onFavoriteUpdate,
  editingVideo,
  onVideoUpdated,
  onCancelEdit,
}) => {
  const safeVideos = videos || [];

  return (
    <div className="space-y-6">
      {safeVideos.length === 0 ? (
        <Card className="bg-[#181818] border-[#272727] max-w-2xl mx-auto">
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
          {editingVideo && (
            <div className="max-w-2xl mx-auto mb-8">
              <Card className="bg-[#181818] border-[#cc0000]/30">
                <CardHeader>
                  <CardTitle className="text-[#f1f1f1]">✏️ Edit Video</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditVideoForm
                    video={editingVideo}
                    onVideoUpdated={onVideoUpdated}
                    onCancel={onCancelEdit}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          <div className="max-w-6xl mx-auto">
            <VideoTable
              videos={safeVideos}
              onEdit={onEdit}
              onDelete={onDelete}
              deleteLoading={deleteLoading}
              onFavoriteUpdate={onFavoriteUpdate}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default VideoManagementSection;
