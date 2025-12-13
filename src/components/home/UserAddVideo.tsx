
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Link as LinkIcon, Tag, Image } from 'lucide-react';
import { NicheInput } from '@/components/NicheInput';

const UserAddVideo = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [niche, setNiche] = useState('');
  const [nicheImageUrl, setNicheImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Please sign in to add videos",
        variant: "destructive"
      });
      return;
    }

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
      // Call the edge function to get video details
      const { data, error } = await supabase.functions.invoke('get-youtube-video', {
        body: { videoId }
      });

      if (error) throw error;

      // Insert into user_videos table with user_id
      const { error: insertError } = await (supabase as any)
        .from('user_videos')
        .insert({
          user_id: user.id,
          title: data.title,
          youtube_url: url,
          video_id: videoId,
          thumbnail_url: data.thumbnailUrl,
          channel_name: data.channelName,
          channel_subscribers: data.channelSubscribers,
          upload_date: data.uploadDate,
          view_count: data.viewCount,
          niche: niche.trim()
        });

      if (insertError) throw insertError;

      // If a custom niche image URL is provided, save to user_niches
      if (nicheImageUrl.trim()) {
        await (supabase as any)
          .from('user_niches')
          .upsert({
            user_id: user.id,
            name: niche.trim(),
            image_url: nicheImageUrl.trim()
          }, {
            onConflict: 'user_id,name'
          });
      }

      toast({
        title: "Success",
        description: "Video added successfully!"
      });

      setUrl('');
      setNiche('');
      setNicheImageUrl('');
      queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
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
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Plus className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">Add a New Video 📹</h2>
        <p className="text-[#aaaaaa] text-lg">
          Paste any YouTube video URL and we'll save it to your collection
        </p>
      </div>

      <Card className="bg-[#181818] border-[#272727] max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-[#f1f1f1] text-xl">Add YouTube Video</CardTitle>
          <p className="text-[#aaaaaa] text-sm">
            Just paste a YouTube link and we'll do the rest! ✨
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                <LinkIcon className="w-4 h-4 inline mr-2" />
                YouTube URL
              </label>
              <Input
                type="url"
                placeholder="Paste YouTube URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                <Tag className="w-4 h-4 inline mr-2" />
                Niche / Category
              </label>
              <NicheInput
                value={niche}
                onChange={setNiche}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                <Image className="w-4 h-4 inline mr-2" />
                Custom Niche Image URL (optional)
              </label>
              <Input
                type="url"
                placeholder="Paste image URL for this niche..."
                value={nicheImageUrl}
                onChange={(e) => setNicheImageUrl(e.target.value)}
                disabled={loading}
                className="bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
              />
              <p className="text-xs text-[#666666] mt-1">
                This will save a custom image for your niche
              </p>
            </div>

            {nicheImageUrl && (
              <div>
                <label className="block text-sm font-medium text-[#aaaaaa] mb-2">Preview</label>
                <img
                  src={nicheImageUrl}
                  alt="Niche preview"
                  className="w-full h-24 object-cover rounded border border-[#272727]"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold"
            >
              {loading ? 'Adding...' : 'Add Video'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="max-w-2xl mx-auto">
        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-4">
            <h3 className="text-[#f1f1f1] font-semibold mb-2">💡 How it works:</h3>
            <ul className="text-[#aaaaaa] text-sm space-y-1">
              <li>• Copy any YouTube video URL</li>
              <li>• Paste it in the form above</li>
              <li>• Choose a category for your video</li>
              <li>• Click "Add Video" and you're done!</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserAddVideo;
