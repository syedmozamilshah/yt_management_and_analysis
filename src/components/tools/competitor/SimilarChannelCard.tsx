import { ExternalLink, Users, TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface SimilarChannel {
  id: string;
  name: string;
  handle: string;
  thumbnail: string;
  subscribers: string;
  similarityScore: number;
  matchedVideos: number;
  description?: string;
}

interface SimilarChannelCardProps {
  channel: SimilarChannel;
  rank: number;
}

function getChannelUrl(handle: string): string {
  if (!handle) return "https://youtube.com";
  if (handle.startsWith("http")) return handle;
  if (handle.startsWith("@")) return `https://youtube.com/${handle}`;
  if (handle.startsWith("/")) return `https://youtube.com${handle}`;
  return `https://youtube.com/@${handle}`;
}

function formatSubscribers(subscribers: string): string {
  if (!subscribers || subscribers === "N/A" || subscribers === "") return "";
  return subscribers.replace(/\s*subscribers?/i, "").trim();
}

function getInitials(name: string): string {
  return name.split(" ").map((word) => word[0]).join("").substring(0, 2).toUpperCase();
}

export function SimilarChannelCard({ channel, rank }: SimilarChannelCardProps) {
  const [imageError, setImageError] = useState(false);
  const formattedSubscribers = formatSubscribers(channel.subscribers);
  const isTopMatch = channel.similarityScore >= 70;

  return (
    <div className={cn(
      "relative bg-[#181818] rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer group",
      "hover:scale-[1.03] hover:shadow-2xl hover:z-10",
      isTopMatch 
        ? "border-[#cc0000]/30 hover:border-[#cc0000] hover:shadow-[#cc0000]/20" 
        : "border-[#272727] hover:border-[#cc0000]/50 hover:shadow-[#cc0000]/10"
    )}>
      {/* Top Match Badge */}
      {isTopMatch && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 bg-[#cc0000] rounded-full">
          <Star className="w-3 h-3 text-white fill-white" />
          <span className="text-[10px] font-bold text-white uppercase">Top Match</span>
        </div>
      )}

      {/* Rank Badge */}
      <div className={cn(
        "absolute top-3 left-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
        rank <= 3 
          ? "bg-gradient-to-br from-[#cc0000] to-[#990000] text-white shadow-lg" 
          : "bg-[#272727] text-[#aaaaaa]",
        "group-hover:scale-110"
      )}>
        {rank}
      </div>

      {/* Thumbnail Section */}
      <div className="relative h-20 bg-gradient-to-br from-[#272727] to-[#181818] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#cc0000]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Channel Avatar - Overlapping */}
      <div className="relative -mt-10 px-4">
        <div className="relative inline-block">
          {!imageError && channel.thumbnail ? (
            <img
              src={channel.thumbnail}
              alt={channel.name}
              className="w-16 h-16 rounded-full object-cover border-4 border-[#181818] group-hover:border-[#cc0000]/30 transition-all duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#cc0000]/20 to-[#272727] border-4 border-[#181818] flex items-center justify-center group-hover:border-[#cc0000]/30 transition-all">
              <span className="text-xl font-bold text-[#cc0000]">
                {getInitials(channel.name)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-3">
        {/* Channel Name & Handle */}
        <div className="mb-3">
          <h3 className="font-bold text-[#f1f1f1] truncate text-lg group-hover:text-[#cc0000] transition-colors">
            {channel.name}
          </h3>
          <p className="text-sm text-[#666666] truncate">{channel.handle}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {formattedSubscribers && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#0f0f0f] rounded-lg group-hover:bg-[#272727]/50 transition-colors">
              <Users className="w-4 h-4 text-[#cc0000]" />
              <span className="text-sm text-[#aaaaaa]">{formattedSubscribers}</span>
            </div>
          )}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 bg-[#0f0f0f] rounded-lg group-hover:bg-[#272727]/50 transition-colors",
            !formattedSubscribers && "col-span-2"
          )}>
            <TrendingUp className="w-4 h-4 text-[#cc0000]" />
            <span className="text-sm text-[#aaaaaa]">{channel.matchedVideos} matches</span>
          </div>
        </div>

        {/* Similarity Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#666666]">Similarity</span>
            <span className={cn(
              "text-sm font-bold",
              channel.similarityScore >= 70 ? "text-green-500" : 
              channel.similarityScore >= 50 ? "text-[#cc0000]" : "text-yellow-500"
            )}>
              {channel.similarityScore}%
            </span>
          </div>
          <div className="w-full h-2 bg-[#272727] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                channel.similarityScore >= 70 ? "bg-gradient-to-r from-green-600 to-green-400" : 
                channel.similarityScore >= 50 ? "bg-gradient-to-r from-[#cc0000] to-[#ff4444]" : 
                "bg-gradient-to-r from-yellow-600 to-yellow-400"
              )}
              style={{ width: `${channel.similarityScore}%` }}
            />
          </div>
        </div>

        {/* Visit Button */}
        <a
          href={getChannelUrl(channel.handle)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#272727] group-hover:bg-[#cc0000] text-[#aaaaaa] group-hover:text-white rounded-xl text-sm font-semibold transition-all duration-300"
        >
          <span>Visit Channel</span>
          <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}
