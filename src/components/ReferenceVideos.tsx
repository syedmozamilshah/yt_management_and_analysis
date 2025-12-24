
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Users, TrendingUp } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { Video } from '@/types/video';

interface ReferenceVideosProps {
  videos: Video[];
}

export const ReferenceVideos: React.FC<ReferenceVideosProps> = ({ videos }) => {
  if (videos.length === 0) {
    return (
      <Card className="bg-[#181818] border-[#272727] h-full">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#cc0000]" />
            Reference Videos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-[#aaaaaa] text-center">
            Generate titles to see successful videos from your database that inspired the AI suggestions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#181818] border-[#272727] h-full">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#cc0000]" />
          Reference Videos ({videos.length})
        </CardTitle>
        <p className="text-[#aaaaaa] text-sm">
          Successful videos that inspired the AI title suggestions
        </p>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
        {videos.map((video, index) => {
          const isViral = video.view_count && video.channel_subscribers && 
                          video.view_count > video.channel_subscribers;
          const viralMultiplier = isViral ? 
            (video.view_count! / video.channel_subscribers!).toFixed(1) : null;

          return (
            <div
              key={video.id || index}
              className="p-4 bg-[#0f0f0f] rounded-lg border border-[#404040] hover:border-[#cc0000]/50 transition-colors cursor-pointer"
              onClick={() => window.open(video.youtube_url, '_blank')}
            >
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="w-24 h-16 rounded-md overflow-hidden flex-shrink-0">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm leading-tight mb-2 line-clamp-2">
                    {video.title}
                  </h4>
                  
                  {video.channel_name && (
                    <p className="text-[#aaaaaa] text-xs mb-1">{video.channel_name}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs">
                    {video.view_count && (
                      <div className="flex items-center gap-1 text-[#aaaaaa]">
                        <Eye className="w-3 h-3" />
                        <span>{formatNumber(video.view_count)}</span>
                      </div>
                    )}
                    
                    {video.channel_subscribers && (
                      <div className="flex items-center gap-1 text-[#666666]">
                        <Users className="w-3 h-3" />
                        <span>{formatNumber(video.channel_subscribers)}</span>
                      </div>
                    )}

                    {isViral && viralMultiplier && (
                      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                        {viralMultiplier}X
                      </div>
                    )}
                  </div>

                  {video.niche && (
                    <div className="mt-2">
                      <span className="inline-block bg-gradient-to-r from-[#cc0000] to-[#aa0000] text-white text-xs font-semibold px-2 py-1 rounded-full border border-[#cc0000]/30">
                        {video.niche.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
