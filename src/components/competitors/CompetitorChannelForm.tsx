
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CompetitorChannelFormProps {
  onChannelAdded: () => void;
  isUserSpecific?: boolean;
}

export const CompetitorChannelForm: React.FC<CompetitorChannelFormProps> = ({ 
  onChannelAdded,
  isUserSpecific = false 
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube channel URL",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Adding competitor channel:', url);
      
      // Call edge function to analyze channel
      const { data, error } = await supabase.functions.invoke('analyze-competitor-channel', {
        body: { 
          channelUrl: url,
          isUserSpecific: isUserSpecific,
          userId: user?.id
        }
      });

      if (error) throw error;

      // If user-specific, insert into user_competitor_channels directly
      if (isUserSpecific && user?.id && data) {
        const { error: insertError } = await (supabase as any)
          .from('user_competitor_channels')
          .insert({
            user_id: user.id,
            channel_name: data.channelName,
            channel_id: data.channelId,
            channel_subscribers: data.subscriberCount,
            total_videos: data.videoCount
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Success! 🎯",
        description: `Added ${data.channelName} to competitors list`
      });

      setUrl('');
      onChannelAdded();
    } catch (error) {
      console.error('Error adding competitor channel:', error);
      toast({
        title: "Error",
        description: "Failed to add competitor channel. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-[#212121] border-[#272727]">
      <CardHeader>
        <CardTitle className="text-[#f1f1f1] flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#cc0000]" />
          Add Competitor Channel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <Input
            type="url"
            placeholder="Paste YouTube channel URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="flex-1 bg-[#181818] border-[#404040] text-[#f1f1f1] placeholder:text-[#aaaaaa] focus:border-[#cc0000]/50"
          />
          <Button 
            type="submit" 
            disabled={loading} 
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white px-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Channel
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
