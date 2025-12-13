
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Plus } from 'lucide-react';
import { NicheInput } from './NicheInput';

interface AddToFavoritesFormProps {
  onVideoAdded: () => void;
}

export const AddToFavoritesForm: React.FC<AddToFavoritesFormProps> = ({ onVideoAdded }) => {
  const [url, setUrl] = useState('');
  const [niche, setNiche] = useState('');
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

      // Insert into database with niche and set as favorite
      const insertData = {
        title: data.title,
        youtube_url: url,
        video_id: videoId,
        thumbnail_url: data.thumbnailUrl,
        channel_name: data.channelName,
        channel_subscribers: data.channelSubscribers,
        upload_date: data.uploadDate,
        view_count: viewCount,
        niche: niche.trim(),
        is_favorite: true // Set as favorite directly
      };

      console.log('Data being inserted into database:', insertData);

      const { error: insertError } = await supabase
        .from('videos')
        .insert(insertData);

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      // Update proven_niches table if needed
      const { error: nicheUpdateError } = await supabase
        .from('proven_niches')
        .upsert({
          name: niche.trim(),
          image_url: data.thumbnailUrl || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=500&h=500&fit=crop'
        }, {
          onConflict: 'name'
        });

      if (nicheUpdateError) {
        console.warn('Failed to update niche:', nicheUpdateError);
        // Don't throw error here as the video was added successfully
      }

      toast({
        title: "Success! ❤️",
        description: "Video added to your favorites!"
      });

      setUrl('');
      setNiche('');
      onVideoAdded();
    } catch (error) {
      console.error('Error adding video to favorites:', error);
      toast({
        title: "Error",
        description: "Failed to add video to favorites. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-[#212121] border-[#272727]">
      <CardHeader>
        <CardTitle className="text-[#f1f1f1] flex items-center gap-2">
          <Heart className="w-5 h-5 text-[#cc0000]" />
          Add to Favorites
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="url"
              placeholder="Paste YouTube URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="bg-[#181818] border-[#404040] text-[#f1f1f1] placeholder:text-[#aaaaaa] focus:border-[#cc0000]/50"
            />
          </div>
          <NicheInput
            value={niche}
            onChange={setNiche}
            disabled={loading}
          />
          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
          >
            {loading ? (
              'Adding...'
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add to Favorites
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
