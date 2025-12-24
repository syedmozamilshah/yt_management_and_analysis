import { SimilarChannelCard, SimilarChannel } from "./SimilarChannelCard";
import { RefreshCw, Download, Users, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ResultsDisplayProps {
  sourceChannel: {
    name: string;
    handle: string;
    thumbnail: string;
  };
  similarChannels: SimilarChannel[];
  onReset: () => void;
}

function getInitials(name: string): string {
  return name.split(" ").map((word) => word[0]).join("").substring(0, 2).toUpperCase();
}

export function ResultsDisplay({ sourceChannel, similarChannels, onReset }: ResultsDisplayProps) {
  const { toast } = useToast();
  const [thumbnailError, setThumbnailError] = useState(false);

  const handleExport = () => {
    const headers = ["Rank", "Channel Name", "Handle", "Subscribers", "Similarity Score", "Matched Videos", "YouTube Link"];
    const rows = similarChannels.map((channel, index) => [
      index + 1,
      channel.name,
      channel.handle,
      channel.subscribers,
      `${channel.similarityScore}%`,
      channel.matchedVideos,
      `https://youtube.com/${channel.handle.startsWith("@") ? channel.handle : `@${channel.handle}`}`,
    ]);

    const csvContent = [
      `# Similar Channels to: ${sourceChannel.name} (${sourceChannel.handle})`,
      `# Generated on: ${new Date().toLocaleString()}`,
      "",
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `competitors-${sourceChannel.handle.replace("@", "")}-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: "Results have been downloaded as a CSV file",
    });
  };

  const topMatches = similarChannels.filter(c => c.similarityScore >= 70).length;

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-[#181818] to-[#0f0f0f] rounded-2xl border border-[#272727] p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Source Channel */}
          <div className="flex items-center gap-4 flex-1">
            {!thumbnailError && sourceChannel.thumbnail ? (
              <img
                src={sourceChannel.thumbnail}
                alt={sourceChannel.name}
                className="w-16 h-16 rounded-full border-2 border-[#cc0000]"
                onError={() => setThumbnailError(true)}
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-[#cc0000] bg-[#272727] flex items-center justify-center">
                <span className="text-xl font-bold text-[#666666]">
                  {getInitials(sourceChannel.name)}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-[#666666] mb-1">Competitors for</p>
              <h2 className="font-bold text-xl text-[#f1f1f1]">{sourceChannel.name}</h2>
              <p className="text-sm text-[#666666]">{sourceChannel.handle}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#272727] rounded-xl">
              <Users className="w-5 h-5 text-[#cc0000]" />
              <div>
                <p className="text-xl font-bold text-[#f1f1f1]">{similarChannels.length}</p>
                <p className="text-xs text-[#666666]">Found</p>
              </div>
            </div>
            {topMatches > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-[#cc0000]/10 border border-[#cc0000]/30 rounded-xl">
                <Trophy className="w-5 h-5 text-[#cc0000]" />
                <div>
                  <p className="text-xl font-bold text-[#cc0000]">{topMatches}</p>
                  <p className="text-xs text-[#cc0000]/70">Top Matches</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-5 pt-5 border-t border-[#272727]">
          <button 
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#272727] hover:bg-[#333333] rounded-xl text-sm text-[#aaaaaa] hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            New Search
          </button>
          <button 
            onClick={handleExport} 
            disabled={similarChannels.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#cc0000] hover:bg-[#aa0000] rounded-xl text-sm text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {similarChannels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {similarChannels.map((channel, index) => (
            <SimilarChannelCard
              key={channel.id}
              channel={channel}
              rank={index + 1}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#181818] rounded-2xl border border-[#272727]">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-[#aaaaaa] text-lg mb-1">No competitors found</p>
          <p className="text-[#666666] text-sm">Try analyzing a different channel</p>
        </div>
      )}
    </div>
  );
}
