
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Video {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  thumbnail_url: string;
  created_at: string;
}

interface EditVideoFormProps {
  video: Video;
  onVideoUpdated: () => void;
  onCancel: () => void;
}

const EditVideoForm = ({ video, onVideoUpdated, onCancel }: EditVideoFormProps) => {
  const [title, setTitle] = useState(video.title);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    if (!title.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('videos')
        .update({ title })
        .eq('id', video.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Video title updated successfully!"
      });

      onVideoUpdated();
    } catch (error) {
      console.error('Error updating video:', error);
      toast({
        title: "Error",
        description: "Failed to update video title",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center mb-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Edit Video Title</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              disabled={loading}
            />
            <div className="flex gap-2">
              <Button onClick={handleUpdate} disabled={loading} className="flex-1">
                {loading ? 'Updating...' : 'Update'}
              </Button>
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditVideoForm;
