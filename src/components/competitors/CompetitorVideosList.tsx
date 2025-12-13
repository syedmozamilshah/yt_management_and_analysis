
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Calendar, Users, ExternalLink } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';

interface CompetitorVideo {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  thumbnail_url: string;
  channel_name: string;
  channel_subscribers: number;
  view_count: number;
  upload_date: string;
}

interface CompetitorVideosListProps {
  videos: CompetitorVideo[];
  loading: boolean;
}

export const CompetitorVideosList: React.FC<CompetitorVideosListProps> = ({
  videos,
  loading
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <Card key={i} className="bg-[#212121] border-[#272727] animate-pulse">
            <div className="aspect-video bg-[#272727] rounded-t-lg"></div>
            <CardContent className="p-4 space-y-3">
              <div className="h-4 bg-[#272727] rounded"></div>
              <div className="h-3 bg-[#272727] rounded w-3/4"></div>
              <div className="h-3 bg-[#272727] rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-[#212121] rounded-2xl p-8 max-w-md mx-auto border border-[#272727]">
          <Eye className="w-12 h-12 text-[#aaaaaa] mx-auto mb-4" />
          <p className="text-[#f1f1f1] text-lg font-medium mb-2">No videos found</p>
          <p className="text-[#aaaaaa]">No videos found for the selected time period. Try adjusting the duration filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#aaaaaa]">
          Showing {videos.length} top performing videos
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video, index) => {
          // Check if this is a viral video (views > subscribers)
          const isViral = video.view_count > video.channel_subscribers;
          const viralMultiplier = isViral ? (video.view_count / video.channel_subscribers).toFixed(1) : null;
          
          return (
            <Card key={video.id} className="bg-[#212121] border-[#272727] hover:border-[#404040] transition-colors group cursor-pointer">
              <div 
                className="relative"
                onClick={() => window.open(video.youtube_url, '_blank')}
              >
                {/* Ranking Badge */}
                <div className="absolute top-2 left-2 z-10 bg-[#cc0000] text-white text-xs font-bold px-2 py-1 rounded">
                  #{index + 1}
                </div>
                
                {/* Viral Badge */}
                {isViral && viralMultiplier && (
                  <div className="absolute top-2 right-2 z-10 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                    {viralMultiplier}x
                  </div>
                )}
                
                <div className="aspect-video overflow-hidden rounded-t-lg relative">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              
              <CardContent className="p-4">
                <h4 className="font-semibold text-[#f1f1f1] line-clamp-2 leading-tight mb-3 group-hover:text-[#cc0000] transition-colors">
                  {video.title}
                </h4>
                
                <div className="space-y-2 text-sm text-[#aaaaaa]">
                  <div className="font-medium text-[#f1f1f1]">
                    {video.channel_name}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{formatNumber(video.view_count)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{formatNumber(video.channel_subscribers)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(video.upload_date)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
