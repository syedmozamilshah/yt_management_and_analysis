
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video } from '@/types/video';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { 
  ExternalLink, 
  Heart, 
  Eye, 
  Users, 
  Calendar, 
  Zap, 
  TrendingUp,
  Hash,
  Youtube
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoDetailsModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onFavoriteUpdate?: () => void;
}

export const VideoDetailsModal: React.FC<VideoDetailsModalProps> = ({
  video,
  isOpen,
  onClose,
  onFavoriteUpdate
}) => {
  const { toast } = useToast();

  if (!video) return null;

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  const openYouTube = () => {
    window.open(video.youtube_url, '_blank');
  };

  const openChannel = () => {
    console.log('Opening channel with ID:', video.channel_id, 'Name:', video.channel_name);
    if (video.channel_id) {
      const channelUrl = `https://www.youtube.com/channel/${video.channel_id}`;
      console.log('Opening channel URL:', channelUrl);
      window.open(channelUrl, '_blank');
    } else if (video.channel_name) {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(video.channel_name)}`;
      console.log('Fallback search URL:', searchUrl);
      window.open(searchUrl, '_blank');
    }
  };

  // Check if this is a viral video
  const isViral = video.view_count && video.channel_subscribers && video.view_count > video.channel_subscribers;
  const viralMultiplier = isViral ? (video.view_count! / video.channel_subscribers!).toFixed(1) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-[#0f0f0f] border border-[#272727] text-white p-0">
        <DialogTitle className="sr-only">{video.title}</DialogTitle>
        <div className="relative">
          {/* Hero Section with Thumbnail - Fully visible and responsive */}
          <div className="relative w-full aspect-video overflow-hidden">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-contain bg-black"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f]/80 via-transparent to-transparent pointer-events-none" />

            {/* Top Corner Badges */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              {isViral && viralMultiplier && (
                <Badge className="bg-[#cc0000] text-white font-bold shadow-lg shadow-[#cc0000]/30 animate-pulse">
                  <Zap className="w-3 h-3 mr-1" />
                  {viralMultiplier}X VIRAL
                </Badge>
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="p-4 sm:p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#f1f1f1] leading-tight flex-1">
                  {video.title}
                </h1>
              </div>
              
              {video.channel_name && (
                <div className="flex items-center gap-3 text-[#aaaaaa] text-base sm:text-lg mb-4">
                  <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-pulse" />
                  <span>{video.channel_name}</span>
                  <Button
                    onClick={openChannel}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#cc0000]/20 hover:bg-[#cc0000]/40 p-0 transition-all duration-300 border border-[#cc0000]/30"
                    title="Open YouTube Channel"
                  >
                    <Youtube className="w-3 h-3 sm:w-4 sm:h-4 text-[#cc0000]" />
                  </Button>
                </div>
              )}
            </DialogHeader>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-[#181818] rounded-xl p-3 sm:p-4 border border-[#272727] hover:border-[#404040] transition-all duration-300 group">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-[#272727] group-hover:bg-[#404040] transition-all duration-300">
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-[#aaaaaa]" />
                  </div>
                  <span className="text-[#aaaaaa] text-xs sm:text-sm font-medium">Views</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-[#f1f1f1]">{formatNumber(video.view_count || 0)}</p>
              </div>

              <div className="bg-[#181818] rounded-xl p-3 sm:p-4 border border-[#272727] hover:border-[#404040] transition-all duration-300 group">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-[#272727] group-hover:bg-[#404040] transition-all duration-300">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#aaaaaa]" />
                  </div>
                  <span className="text-[#aaaaaa] text-xs sm:text-sm font-medium">Subscribers</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-[#f1f1f1]">{formatNumber(video.channel_subscribers || 0)}</p>
              </div>

              <div className="bg-[#181818] rounded-xl p-3 sm:p-4 border border-[#272727] hover:border-[#404040] transition-all duration-300 group">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-[#272727] group-hover:bg-[#404040] transition-all duration-300">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#aaaaaa]" />
                  </div>
                  <span className="text-[#aaaaaa] text-xs sm:text-sm font-medium">Published</span>
                </div>
                <p className="text-sm sm:text-lg font-semibold text-[#f1f1f1]">
                  {video.upload_date ? formatDate(video.upload_date) : 'Unknown'}
                </p>
              </div>

              {/* Niche Card replacing Viral Ratio */}
              <div className="bg-[#181818] rounded-xl p-3 sm:p-4 border border-[#272727] hover:border-[#404040] transition-all duration-300 group">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-[#272727] group-hover:bg-[#404040] transition-all duration-300">
                    <Hash className="w-4 h-4 sm:w-5 sm:h-5 text-[#aaaaaa]" />
                  </div>
                  <span className="text-[#aaaaaa] text-xs sm:text-sm font-medium">Niche</span>
                </div>
                <p className="text-sm sm:text-lg font-semibold text-[#f1f1f1]">
                  {video.niche ? video.niche.toUpperCase() : 'Unknown'}
                </p>
              </div>
            </div>

            {/* Action Buttons - Fixed positioning and improved visibility */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              <Button
                onClick={toggleFavorite}
                className={`flex-1 font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 border-2 ${
                  video.is_favorite
                    ? 'bg-[#cc0000] hover:bg-[#aa0000] text-white shadow-[#cc0000]/30 border-[#cc0000]'
                    : 'bg-[#272727] hover:bg-[#404040] text-[#f1f1f1] shadow-[#272727]/30 border-[#404040] hover:border-[#cc0000]/50'
                }`}
                size="lg"
              >
                <Heart className={`w-5 h-5 mr-3 transition-all duration-300 ${video.is_favorite ? 'fill-current' : ''}`} />
                {video.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </Button>
              
              <Button
                onClick={openYouTube}
                className="bg-[#cc0000] hover:bg-[#aa0000] text-white rounded-xl py-4 px-6 shadow-lg shadow-[#cc0000]/30 transition-all duration-300 hover:scale-105 border-2 border-[#cc0000] font-semibold"
                size="lg"
              >
                <ExternalLink className="w-5 h-5 mr-3" />
                Watch on YouTube
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
