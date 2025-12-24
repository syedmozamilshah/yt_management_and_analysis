
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NicheInput } from './NicheInput';

interface VideoFormProps {
  onVideoAdded: () => void;
}

export const VideoForm: React.FC<VideoFormProps> = ({ onVideoAdded }) => {
  const [url, setUrl] = useState('');
  const [niche, setNiche] = useState('');
  const [nicheImageUrl, setNicheImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive"
      });
      return;
    }

    if (!niche.trim()) {
      toast({
        title: "Error",
        description: "Please enter a niche for this video",
        variant: "destructive"
      });
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      toast({
        title: "Error", 
        description: "Invalid YouTube URL",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Fetching video data for videoId:', videoId);
      
      // Call the edge function to get video details
      const { data, error } = await supabase.functions.invoke('get-youtube-video', {
        body: { videoId }
      });

      if (error) throw error;

      console.log('Raw video data from API:', data);

      // Parse viewCount as number
      const viewCount = typeof data.viewCount === 'number' ? data.viewCount : parseInt(data.viewCount) || 0;
      console.log('Parsed view count:', viewCount, 'Type:', typeof viewCount);

      // Insert into database with niche
      const insertData = {
        title: data.title,
        youtube_url: url,
        video_id: videoId,
        thumbnail_url: data.thumbnailUrl,
        channel_name: data.channelName,
        channel_subscribers: data.channelSubscribers,
        upload_date: data.uploadDate,
        view_count: viewCount,
        niche: niche.trim()
      };

      console.log('Data being inserted into database:', insertData);

      const { error: insertError } = await supabase
        .from('videos')
        .insert(insertData);

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      // If a custom niche image URL is provided, update the proven_niches table
      if (nicheImageUrl.trim()) {
        const { error: nicheUpdateError } = await supabase
          .from('proven_niches')
          .upsert({
            name: niche.trim(),
            image_url: nicheImageUrl.trim()
          }, {
            onConflict: 'name'
          });

        if (nicheUpdateError) {
          console.warn('Failed to update niche image:', nicheUpdateError);
          // Don't throw error here as the video was added successfully
        }
      }

      toast({
        title: "Success",
        description: "Video added successfully!"
      });

      setUrl('');
      setNiche('');
      setNicheImageUrl('');
      onVideoAdded();
    } catch (error) {
      console.error('Error adding video:', error);
      toast({
        title: "Error",
        description: "Failed to add video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Add YouTube Video</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="url"
            placeholder="Paste YouTube URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <NicheInput
            value={niche}
            onChange={setNiche}
            disabled={loading}
          />
          <div>
            <label className="block text-sm font-medium mb-2">
              Custom Niche Image URL (optional)
            </label>
            <Input
              type="url"
              placeholder="Paste image URL for this niche..."
              value={nicheImageUrl}
              onChange={(e) => setNicheImageUrl(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              This will update the proven niche card image
            </p>
          </div>
          {nicheImageUrl && (
            <div>
              <label className="block text-sm font-medium mb-2">Preview</label>
              <img
                src={nicheImageUrl}
                alt="Niche preview"
                className="w-full h-24 object-cover rounded border"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Adding...' : 'Add Competitor Video'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
