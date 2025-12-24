import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, AlertCircle, Target } from "lucide-react";
import { isValidChannelInput } from "@/services/channelAnalyzer";

interface ChannelInputProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
}

export function ChannelInput({ onAnalyze, isLoading }: ChannelInputProps) {
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && isValidChannelInput(url)) {
      onAnalyze(url.trim());
    }
  };

  const isValid = isValidChannelInput(url);
  const showError = touched && url.trim() && !isValid;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#cc0000]/10 border border-[#cc0000]/20 mb-4">
          <Target className="w-7 h-7 text-[#cc0000]" />
        </div>
        <h1 className="text-3xl font-bold text-[#f1f1f1] mb-2">
          Find Similar Channels
        </h1>
        <p className="text-[#aaaaaa] text-base">
          Discover competitors creating similar content in your niche
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-[#181818] rounded-xl border border-[#272727] p-6">
          <label className="block text-sm font-medium text-[#aaaaaa] mb-3">
            YouTube Channel
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
              <Input
                type="text"
                placeholder="Enter @handle, channel URL, or name..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched(true)}
                className="pl-10 h-12 bg-[#0f0f0f] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]"
              />
            </div>
            <Button
              type="submit"
              disabled={!url.trim() || !isValid || isLoading}
              className="h-12 px-6 bg-[#cc0000] hover:bg-[#aa0000] text-white font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Find Competitors
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </div>

          {showError && (
            <div className="flex items-center gap-2 text-yellow-500 text-sm mt-3">
              <AlertCircle className="w-4 h-4" />
              <span>Please enter a valid YouTube channel URL or @handle</span>
            </div>
          )}

          {!showError && url && isValid && (
            <p className="text-green-500 text-sm mt-3">✓ Valid input</p>
          )}

          {/* Quick Examples */}
          <div className="mt-4 pt-4 border-t border-[#272727]">
            <span className="text-xs text-[#666666] mr-2">Quick try:</span>
            {["@mkbhd", "@veritasium", "@LinusTechTips"].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setUrl(example)}
                className="px-2 py-1 text-xs bg-[#0f0f0f] hover:bg-[#272727] rounded text-[#aaaaaa] transition-colors mr-2"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-[#181818] rounded-xl border border-[#272727] hover:border-[#cc0000]/30 transition-all">
          <div className="w-8 h-8 rounded-lg bg-[#cc0000]/10 flex items-center justify-center mb-3">
            <span className="text-[#cc0000] text-lg">🎯</span>
          </div>
          <p className="text-sm font-medium text-[#f1f1f1] mb-1">Discover Competitors</p>
          <p className="text-xs text-[#666666]">Find channels in your niche</p>
        </div>
        <div className="p-4 bg-[#181818] rounded-xl border border-[#272727] hover:border-[#cc0000]/30 transition-all">
          <div className="w-8 h-8 rounded-lg bg-[#cc0000]/10 flex items-center justify-center mb-3">
            <span className="text-[#cc0000] text-lg">📊</span>
          </div>
          <p className="text-sm font-medium text-[#f1f1f1] mb-1">Similarity Scores</p>
          <p className="text-xs text-[#666666]">See how closely they match</p>
        </div>
        <div className="p-4 bg-[#181818] rounded-xl border border-[#272727] hover:border-[#cc0000]/30 transition-all">
          <div className="w-8 h-8 rounded-lg bg-[#cc0000]/10 flex items-center justify-center mb-3">
            <span className="text-[#cc0000] text-lg">📥</span>
          </div>
          <p className="text-sm font-medium text-[#f1f1f1] mb-1">Export Results</p>
          <p className="text-xs text-[#666666]">Download as CSV file</p>
        </div>
      </div>
    </div>
  );
}
