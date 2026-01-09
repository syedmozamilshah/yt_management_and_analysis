
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video } from '@/types/video';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { 
  ExternalLink, 
  Eye, 
  Users, 
  Calendar, 
  Zap, 
  Hash,
  Youtube,
  Copy,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getVideoTranscript, openAIWithTranscript } from '@/services/transcriptService';

// AI tool icons as SVG components - Official style icons
const ClaudeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128-2.252-.166-3.156-.462c-.293.848-.462 1.751-.497 2.677l1.186.956zm.08 1.058l-.985-.796a9.063 9.063 0 0 0 .337 1.95l.648.317V15.96v1.054zm.304 2.396l.064.122.017.009a9.103 9.103 0 0 0 1.469 1.931l.095-.51-.095-.544-1.307-.798-.243-.21zm2.096 2.584c.235.184.479.357.732.518l.631-.397-.15-.556-.57-.413-.643.848zm1.594.995c.311.155.63.295.958.417l.353-.466-.23-.513-.637-.159-.444.72zm2.006.667l.038.008a9.129 9.129 0 0 0 1.032.175l.118-.523-.332-.436-.596.07-.26.706zm2.195.23a9.054 9.054 0 0 0 1.093-.063l-.149-.56-.467-.295-.547.287.07.631zm2.095-.301c.323-.078.64-.174.95-.285l-.383-.443-.515-.104-.39.41.338.422zm1.86-.632a8.981 8.981 0 0 0 .855-.435l-.558-.287-.484.118-.152.437.339.167zm1.643-.915c.25-.177.49-.368.72-.57l-.672-.089-.414.261.02.42.346-.022zm1.366-1.175a9.022 9.022 0 0 0 .572-.618l-.722.119-.31.356.15.36.31-.217zm1.052-1.319c.161-.232.312-.472.451-.719l-.715.295-.181.406.28.26.165-.242zm.789-1.537c.103-.266.194-.538.271-.814l-.652.418-.044.412.36.13.065-.146zm.442-1.727a9.17 9.17 0 0 0 .085-.844l-.533.482.083.382.365.04v-.06zm.085-1.76a9.073 9.073 0 0 0-.102-.863l-.37.517.181.342.291.064v-.06zm-.322-1.713a9.01 9.01 0 0 0-.286-.815l-.181.53.261.27.206.015zm-.614-1.584a9.108 9.108 0 0 0-.464-.75l.042.534.311.182.111.034zm-.947-1.428a9.057 9.057 0 0 0-.625-.658l.248.5.318.075.059.083zm-1.252-1.235a9.068 9.068 0 0 0-.765-.546l.427.434.276-.015.062.127zm-1.516-1.006a9.154 9.154 0 0 0-.876-.417l.566.334.206-.064.104.147zm-1.734-.744a9.048 9.048 0 0 0-.958-.274l.656.208.129-.077.173.143zm-1.904-.455a9.144 9.144 0 0 0-1.008-.118l.698.058.052-.061.258.121zm-2.023-.142h-.078a9.15 9.15 0 0 0-1.014.05l.688-.089-.025-.041.43.08zm-2.08.14a9.128 9.128 0 0 0-.98.198l.619-.186-.078-.059.439.047z"/>
  </svg>
);

const GeminiIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zm0 1.2c-4.638 0-8.4 3.762-8.4 8.4s3.762 8.4 8.4 8.4 8.4-3.762 8.4-8.4-3.762-8.4-8.4-8.4zm-.6 2.4h1.2v3.6h3.6v1.2h-3.6v3.6h-1.2v-3.6H7.8V9.6h3.6V6z"/>
  </svg>
);

const GPTIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1685a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>
);

interface VideoDetailsModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onFavoriteUpdate?: () => void;
  isUserVideo?: boolean;
}

export const VideoDetailsModal: React.FC<VideoDetailsModalProps> = ({
  video,
  isOpen,
  onClose,
  onFavoriteUpdate,
  isUserVideo = false
}) => {
  const { toast } = useToast();
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);

  if (!video) return null;

  const openYouTube = () => {
    window.open(video.youtube_url, '_blank');
  };

  const handleCopyTranscript = async () => {
    if (transcript) {
      try {
        await navigator.clipboard.writeText(transcript);
        toast({
          title: "Copied!",
          description: "Transcript copied to clipboard"
        });
      } catch (err) {
        console.error('Clipboard write failed:', err);
        toast({
          title: "Error",
          description: "Failed to copy to clipboard",
          variant: "destructive"
        });
      }
      return;
    }

    setIsLoadingTranscript(true);
    try {
      const result = await getVideoTranscript(video.video_id);
      console.log('Transcript result:', result);
      
      if (!result.transcript || result.transcript.trim() === '') {
        toast({
          title: "No Transcript",
          description: "This video doesn't have captions available.",
          variant: "destructive"
        });
        return;
      }
      
      setTranscript(result.transcript);
      await navigator.clipboard.writeText(result.transcript);
      toast({
        title: "Copied!",
        description: "Transcript copied to clipboard"
      });
    } catch (error) {
      console.error('Error fetching transcript:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Transcript Unavailable",
        description: errorMessage.includes('No transcript') 
          ? "This video doesn't have captions/subtitles available."
          : "Failed to fetch transcript. The service may be temporarily unavailable.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const handleOpenAI = async (aiTool: 'claude' | 'gemini' | 'gpt') => {
    let currentTranscript = transcript;
    
    if (!currentTranscript) {
      setIsLoadingTranscript(true);
      try {
        const result = await getVideoTranscript(video.video_id);
        currentTranscript = result.transcript;
        setTranscript(currentTranscript);
      } catch (error) {
        console.error('Error fetching transcript:', error);
        toast({
          title: "Error",
          description: "Failed to fetch transcript. This video may not have captions available.",
          variant: "destructive"
        });
        setIsLoadingTranscript(false);
        return;
      }
      setIsLoadingTranscript(false);
    }

    await openAIWithTranscript(aiTool, currentTranscript, toast);
  };

  // Check if this is a viral video
  const isViral = video.view_count && video.channel_subscribers && video.view_count > video.channel_subscribers;
  const viralMultiplier = isViral ? (video.view_count! / video.channel_subscribers!).toFixed(1) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f0f] border border-[#272727] text-white p-0" hideCloseButton>
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

            {/* Open YouTube Button - Top Left */}
            <Button
              onClick={openYouTube}
              className="absolute top-4 left-4 bg-[#cc0000] hover:bg-[#aa0000] text-white rounded-lg px-3 py-2 shadow-lg shadow-[#cc0000]/30 transition-all duration-300 hover:scale-105"
              size="sm"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Watch on YouTube
            </Button>
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

              {/* Niche Card */}
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

            {/* Action Buttons - Transcript & AI Tools in same row */}
            <div className="flex items-center gap-3">
              {/* Copy Transcript Button - Takes remaining space */}
              <Button
                onClick={handleCopyTranscript}
                disabled={isLoadingTranscript}
                className="flex-1 h-14 bg-[#272727] hover:bg-[#404040] text-[#f1f1f1] rounded-xl px-6 shadow-lg transition-all duration-300 hover:scale-[1.01] border border-[#404040] font-medium text-base"
              >
                {isLoadingTranscript ? (
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                ) : (
                  <Copy className="w-5 h-5 mr-3" />
                )}
                {isLoadingTranscript ? 'Fetching Transcript...' : 'Copy Transcript'}
              </Button>

              {/* AI Tool Buttons - Fixed equal size */}
              <button
                onClick={() => handleOpenAI('claude')}
                disabled={isLoadingTranscript}
                className="h-14 w-14 rounded-2xl shadow-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 p-0 border-0 bg-white flex items-center justify-center"
                title="Open in Claude"
              >
                <img src="/logo/claude.png" alt="Claude" className="h-14 w-14 object-contain" />
              </button>
              
              <button
                onClick={() => handleOpenAI('gemini')}
                disabled={isLoadingTranscript}
                className="h-14 w-14 rounded-2xl shadow-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 p-0 border-0 bg-white flex items-center justify-center"
                title="Open in Gemini"
              >
                <img src="/logo/gemini.png" alt="Gemini" className="h-14 w-14 object-contain" />
              </button>
              
              <button
                onClick={() => handleOpenAI('gpt')}
                disabled={isLoadingTranscript}
                className="h-14 w-14 rounded-2xl shadow-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 p-0 border-0 bg-[#10a37f] flex items-center justify-center"
                title="Open in ChatGPT"
              >
                <img src="/logo/gpt.png" alt="ChatGPT" className="h-14 w-14 object-contain" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
