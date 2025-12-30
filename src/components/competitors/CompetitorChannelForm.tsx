
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Loader2, Youtube, Sparkles, ArrowRight } from 'lucide-react';
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
    <Card className="relative overflow-hidden bg-gradient-to-br from-[#181818] to-[#212121] border-[#272727] shadow-2xl">
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#cc0000]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <CardHeader className="relative">
        <CardTitle className="text-[#f1f1f1] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/30">
            <Youtube className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="flex items-center gap-2">
              Add Competitor Channel
              <Sparkles className="w-4 h-4 text-[#cc0000]" />
            </span>
            <p className="text-sm font-normal text-[#666666] mt-0.5">Analyze any YouTube channel instantly</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555555]">
              <Youtube className="w-5 h-5" />
            </div>
            <Input
              type="url"
              placeholder="@channelname or youtube.com/@channel"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="h-12 pl-12 pr-4 bg-[#0f0f0f] border-[#333333] text-[#f1f1f1] placeholder:text-[#555555] focus:border-[#cc0000] focus:ring-2 focus:ring-[#cc0000]/20 rounded-xl transition-all duration-300"
            />
          </div>
          <Button 
            type="submit" 
            disabled={loading} 
            className="h-12 bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white px-6 rounded-xl shadow-lg shadow-[#cc0000]/30 hover:shadow-[#cc0000]/50 transition-all duration-300 group"
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
                <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
