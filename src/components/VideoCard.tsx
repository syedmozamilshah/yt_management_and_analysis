
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Eye, Play, Users, Calendar } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';
import { VideoDetailsModal } from './VideoDetailsModal';
import { useAuth } from '@/contexts/AuthContext';

interface VideoCardProps {
  video: Video;
  onFavoriteUpdate?: () => void;
  viewMode?: 'grid' | 'list';
  isUserVideo?: boolean; // Flag to indicate if this is from user_videos table
  blockModalOpen?: boolean; // Block modal from opening (for selection mode)
}

export const VideoCard: React.FC<VideoCardProps> = ({ 
  video, 
  onFavoriteUpdate, 
  viewMode = 'grid',
  isUserVideo = false,
  blockModalOpen = false
}) => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    // Don't open modal if blocked (selection mode)
    if (blockModalOpen) return;
    setIsModalOpen(true);
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Use appropriate table based on user type and video source
      const tableName = (isUserVideo || !isAdmin) ? 'user_videos' : 'videos';
      
      const { error } = await (supabase as any)
        .from(tableName)
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

  // Check if this is a viral video (views > subscribers)
  const isViral = video.view_count && video.channel_subscribers && video.view_count > video.channel_subscribers;
  const viralMultiplier = isViral ? (video.view_count! / video.channel_subscribers!).toFixed(1) : null;

  // Get viral badge styling based on multiplier - using exact hex colors
  const getViralBadgeStyle = (multiplier: string) => {
    const numMultiplier = parseFloat(multiplier);
    
    if (numMultiplier >= 8) {
      return { className: "text-white", style: { backgroundColor: '#FF2C47' } }; // Red for highest multipliers
    } else if (numMultiplier >= 5) {
      return { className: "text-white", style: { backgroundColor: '#B041E8' } }; // Pink for high multipliers
    } else if (numMultiplier >= 2) {
      return { className: "text-white", style: { backgroundColor: '#3A7DFF' } }; // Blue for medium multipliers
    } else {
      return { className: "text-white", style: { backgroundColor: '#4B4D61' } }; // Grey for lower multipliers
    }
  };

  if (viewMode === 'list') {
    return (
      <>
        <div
          className="hover:bg-white/5 transition-all duration-200 cursor-pointer group flex h-24 p-2"
          onClick={handleClick}
        >
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-40 h-full relative group">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover rounded-lg transition-transform duration-200"
            />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0 pl-3 flex flex-col justify-start">
            <div className="flex-1">
              <h4 className="text-sm font-medium leading-tight line-clamp-2 mb-1" style={{ color: '#f1f1f1' }}>
                {isViral && viralMultiplier && (
                  <span 
                    className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded mr-1.5 ${getViralBadgeStyle(viralMultiplier).className}`}
                    style={getViralBadgeStyle(viralMultiplier).style}
                  >
                    {viralMultiplier}x
                  </span>
                )}
                {video.title}
              </h4>
              
              <div className="text-xs mb-1" style={{ color: '#aaaaaa' }}>
                {video.channel_name}
              </div>
              
              <div className="text-xs" style={{ color: '#aaaaaa' }}>
                {formatNumber(video.view_count || 0)} views • {video.upload_date ? formatDate(video.upload_date) : 'Unknown date'}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFavorite}
              className={`h-6 w-6 p-0 transition-all duration-200 ml-auto mt-1 ${
                video.is_favorite 
                  ? 'text-red-400 hover:text-red-300' 
                  : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart 
                className={`h-3 w-3 ${video.is_favorite ? 'fill-current' : ''}`}
              />
            </Button>
          </div>
        </div>
        
        <VideoDetailsModal
          video={video}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onFavoriteUpdate={onFavoriteUpdate}
          isUserVideo={isUserVideo}
        />
      </>
    );
  }

  // Grid view - Exact YouTube styling with subtle hover animation
  return (
    <>
      <div
        className="cursor-pointer group transition-all duration-200"
        onClick={handleClick}
      >
        {/* Thumbnail - YouTube dimensions and styling */}
        <div className="relative aspect-video overflow-hidden rounded-xl mb-3 bg-black">
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
          
          {/* Favorite button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFavorite}
            className={`absolute top-2 right-2 h-8 w-8 p-0 backdrop-blur-sm bg-black/60 hover:bg-black/80 transition-all duration-200 rounded-full ${
              video.is_favorite ? 'text-red-400' : 'text-white/80 hover:text-red-400'
            }`}
          >
            <Heart 
              className={`h-4 w-4 ${video.is_favorite ? 'fill-current' : ''}`}
            />
          </Button>
        </div>

        {/* Content below thumbnail - Exact YouTube styling without avatar */}
        <div className="px-0">
          {/* Title - YouTube typography with exact white color */}
          <h3 className="text-sm font-medium leading-tight line-clamp-2 mb-1 font-roboto" style={{ color: '#f1f1f1' }}>
            {isViral && viralMultiplier && (
              <span 
                className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded mr-1.5 ${getViralBadgeStyle(viralMultiplier).className}`}
                style={getViralBadgeStyle(viralMultiplier).style}
              >
                {viralMultiplier}x
              </span>
            )}
            {video.title}
          </h3>
          
          {/* Channel name - YouTube style with exact gray color */}
          <div className="text-sm font-roboto mb-1" style={{ color: '#aaaaaa' }}>
            {video.channel_name}
          </div>
          
          {/* Views and time - YouTube style with exact gray color */}
          <div className="text-sm font-roboto" style={{ color: '#aaaaaa' }}>
            {formatNumber(video.view_count || 0)} views • {video.upload_date ? formatDate(video.upload_date) : 'Unknown date'}
          </div>
        </div>
      </div>
      
      <VideoDetailsModal
        video={video}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFavoriteUpdate={onFavoriteUpdate}
        isUserVideo={isUserVideo}
      />
    </>
  );
};
