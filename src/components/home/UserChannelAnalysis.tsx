import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Users, Download, Search, Sparkles, Target, TrendingUp, Zap, ArrowRight, Youtube, ChevronRight } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { NicheInput } from '@/components/NicheInput';

interface ChannelVideo {
  id: string;
  title: string;
  viewCount: number;
  uploadDate: string;
  thumbnailUrl: string;
  youtubeUrl: string;
}

interface AnalysisResult {
  channelName: string;
  subscriberCount: number;
  totalVideosFound: number;
  videos: ChannelVideo[];
  daysPeriod: number;
}

const UserChannelAnalysis = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [channelUrl, setChannelUrl] = useState('');
  const [daysPeriod, setDaysPeriod] = useState('7');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | null>(null);
  const [niche, setNiche] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);
  const [bulkNiche, setBulkNiche] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Auto-trigger analysis from URL params (e.g., from sidebar Add Competitor)
  useEffect(() => {
    const urlChannelUrl = searchParams.get('channelUrl');
    const urlDays = searchParams.get('days');
    
    if (urlChannelUrl && !autoTriggered) {
      setChannelUrl(decodeURIComponent(urlChannelUrl));
      if (urlDays) {
        setDaysPeriod(urlDays);
      }
      setAutoTriggered(true);
      
      // Clear URL params after reading them
      setSearchParams({}, { replace: true });
      
      // Trigger analysis after state is set
      setTimeout(() => {
        triggerAnalysis(decodeURIComponent(urlChannelUrl), urlDays || '90');
      }, 100);
    }
  }, [searchParams, autoTriggered]);

  const triggerAnalysis = async (url: string, days: string) => {
    if (!url.trim()) return;

    setLoading(true);
    setResults(null);

    try {
      const daysValue = days === 'all' ? 3650 : parseInt(days); // Use 10 years for "all time"
      
      const { data, error } = await supabase.functions.invoke('get-channel-videos', {
        body: { 
          channelUrl: url,
          daysPeriod: daysValue
        }
      });

      if (error) throw error;

      setResults({ ...data, daysPeriod: daysValue });
      
      toast({
        title: "🎉 Videos Retrieved!",
        description: `Found ${data.videos.length} video${data.videos.length > 1 ? 's' : ''} from ${data.channelName}`
      });
    } catch (error) {
      console.error('Error fetching channel videos:', error);
      toast({
        title: "Error",
        description: "Failed to fetch channel videos. Please check the URL and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!channelUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube channel URL",
        variant: "destructive"
      });
      return;
    }

    await triggerAnalysis(channelUrl, daysPeriod);
  };

  const handleAddVideo = async (videoToAdd?: ChannelVideo) => {
    const videoData = videoToAdd || selectedVideo;
    if (!videoData || !niche.trim() || !user?.id) {
      toast({
        title: "Error",
        description: "Please enter a niche for this video",
        variant: "destructive"
      });
      return;
    }

    setAddingVideo(true);

    try {
      const { error } = await (supabase as any)
        .from('user_videos')
        .insert({
          user_id: user.id,
          title: videoData.title,
          youtube_url: videoData.youtubeUrl,
          video_id: videoData.id,
          thumbnail_url: videoData.thumbnailUrl,
          channel_name: results?.channelName,
          channel_subscribers: results?.subscriberCount,
          upload_date: videoData.uploadDate,
          view_count: videoData.viewCount,
          niche: niche.trim()
        });

      if (error) throw error;

      toast({
        title: "✅ Video Added!",
        description: "Video has been added to your collection"
      });

      setSelectedVideo(null);
      setNiche('');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
    } catch (error) {
      console.error('Error adding video:', error);
      toast({
        title: "Error",
        description: "Failed to add video",
        variant: "destructive"
      });
    } finally {
      setAddingVideo(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!results || !bulkNiche.trim() || !user?.id) {
      toast({
        title: "Error",
        description: "Please enter a niche for the videos",
        variant: "destructive"
      });
      return;
    }

    setBulkAdding(true);

    try {
      const videosToInsert = results.videos.map(video => ({
        user_id: user.id,
        title: video.title,
        youtube_url: video.youtubeUrl,
        video_id: video.id,
        thumbnail_url: video.thumbnailUrl,
        channel_name: results.channelName,
        channel_subscribers: results.subscriberCount,
        upload_date: video.uploadDate,
        view_count: video.viewCount,
        niche: bulkNiche.trim()
      }));

      const { error } = await (supabase as any)
        .from('user_videos')
        .insert(videosToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Added ${results.videos.length} videos to your collection!"`
      });

      setBulkNiche('');
      queryClient.invalidateQueries({ queryKey: ['user-videos', user.id] });
    } catch (error) {
      console.error('Error bulk adding videos:', error);
      toast({
        title: "Error",
        description: "Failed to add videos",
        variant: "destructive"
      });
    } finally {
      setBulkAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Show form only when loading (from URL params) or as a minimal inline search */}
      {!results && !loading && (
        <div className="relative">
          {/* Background Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#cc0000]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#cc0000]/3 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#cc0000]/3 to-transparent rounded-full" />
          </div>
          
          <div className="relative flex flex-col items-center justify-center py-12 text-center">
            {/* Animated Hero Icon */}
            <div className="relative mb-8 group">
              {/* Pulsing rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border border-[#cc0000]/20 animate-ping opacity-20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full border border-[#cc0000]/30 animate-pulse" />
              </div>
              
              {/* Main icon container */}
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#cc0000] via-[#ff3333] to-[#cc0000] flex items-center justify-center shadow-2xl shadow-[#cc0000]/40 group-hover:shadow-[#cc0000]/60 transition-all duration-500 group-hover:scale-105">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent" />
                <Youtube className="w-12 h-12 text-white relative z-10" />
                
                {/* Sparkle accents */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#cc0000] rounded-full animate-pulse delay-150" />
              </div>
            </div>
            
            {/* Hero Text */}
            <div className="space-y-4 mb-10">
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-white to-[#aaaaaa] bg-clip-text text-transparent">
                Spy on Competitors
              </h2>
              <p className="text-xl text-[#888888] max-w-xl mx-auto leading-relaxed">
                Discover what's <span className="text-[#cc0000] font-semibold">actually working</span> in your niche
              </p>
            </div>
            
            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#181818] border border-[#272727] rounded-full text-sm text-[#aaaaaa] hover:border-[#cc0000]/50 hover:text-white transition-all duration-300">
                <Target className="w-4 h-4 text-[#cc0000]" />
                Find viral videos
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#181818] border border-[#272727] rounded-full text-sm text-[#aaaaaa] hover:border-[#cc0000]/50 hover:text-white transition-all duration-300">
                <TrendingUp className="w-4 h-4 text-[#cc0000]" />
                Track performance
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#181818] border border-[#272727] rounded-full text-sm text-[#aaaaaa] hover:border-[#cc0000]/50 hover:text-white transition-all duration-300">
                <Zap className="w-4 h-4 text-[#cc0000]" />
                Save to ideation
              </div>
            </div>
            
            {/* Main Search Card */}
            <div className="w-full max-w-2xl">
              <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#cc0000]/20 via-[#cc0000]/10 to-[#cc0000]/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative bg-[#181818]/80 backdrop-blur-xl border border-[#272727] rounded-2xl p-8 shadow-2xl">
                  {/* Card header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center">
                      <Search className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-[#f1f1f1] font-semibold">Channel Analyzer</h3>
                      <p className="text-[#666666] text-sm">Enter any YouTube channel</p>
                    </div>
                    <div className="ml-auto">
                      <span className="px-3 py-1 bg-[#cc0000]/10 border border-[#cc0000]/30 rounded-full text-xs text-[#cc0000] font-medium">
                        Free
                      </span>
                    </div>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* URL Input */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]">
                        <Youtube className="w-5 h-5" />
                      </div>
                      <Input
                        placeholder="@channelname or youtube.com/@channel"
                        value={channelUrl}
                        onChange={(e) => setChannelUrl(e.target.value)}
                        disabled={loading}
                        className="h-14 pl-12 pr-4 bg-[#0f0f0f] border-[#333333] text-[#f1f1f1] placeholder:text-[#555555] focus:border-[#cc0000] focus:ring-2 focus:ring-[#cc0000]/20 text-base rounded-xl transition-all duration-300"
                      />
                    </div>
                    
                    {/* Time Period Selection */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: '7', label: '7 Days', desc: 'Recent' },
                        { value: '28', label: '28 Days', desc: 'Monthly' },
                        { value: '90', label: '90 Days', desc: 'Quarterly' }
                      ].map((period) => (
                        <button
                          key={period.value}
                          type="button"
                          onClick={() => setDaysPeriod(period.value)}
                          className={`relative p-4 rounded-xl border transition-all duration-300 text-left ${
                            daysPeriod === period.value
                              ? 'bg-[#cc0000]/10 border-[#cc0000] shadow-lg shadow-[#cc0000]/10'
                              : 'bg-[#0f0f0f] border-[#333333] hover:border-[#444444]'
                          }`}
                        >
                          <div className={`font-semibold ${daysPeriod === period.value ? 'text-[#cc0000]' : 'text-[#f1f1f1]'}`}>
                            {period.label}
                          </div>
                          <div className="text-xs text-[#666666]">{period.desc}</div>
                          {daysPeriod === period.value && (
                            <div className="absolute top-2 right-2 w-2 h-2 bg-[#cc0000] rounded-full animate-pulse" />
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      disabled={loading || !channelUrl.trim()} 
                      className="w-full h-14 bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white font-semibold text-lg rounded-xl shadow-xl shadow-[#cc0000]/30 hover:shadow-[#cc0000]/50 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5" />
                        Analyze Channel
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Button>
                  </form>
                  
                  {/* Trust indicators */}
                  <div className="mt-6 pt-6 border-t border-[#272727]">
                    <div className="flex items-center justify-center gap-6 text-xs text-[#666666]">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#cc0000]" />
                        Instant results
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-[#cc0000]" />
                        Find viral hits
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#cc0000]" />
                        Track trends
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* How it works section */}
            <div className="w-full max-w-3xl mt-16">
              <h4 className="text-sm font-medium text-[#666666] uppercase tracking-wider mb-6">How it works</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: '1', title: 'Enter Channel', desc: 'Paste any YouTube channel URL or handle', icon: Youtube },
                  { step: '2', title: 'Analyze Videos', desc: 'We fetch their recent videos and stats', icon: Search },
                  { step: '3', title: 'Save Ideas', desc: 'Add winning videos to your collection', icon: Download }
                ].map((item, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#cc0000]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-5 bg-[#181818]/50 border border-[#272727] rounded-xl hover:border-[#333333] transition-all duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-[#cc0000]/10 border border-[#cc0000]/20 flex items-center justify-center text-[#cc0000] text-sm font-bold">
                          {item.step}
                        </div>
                        <item.icon className="w-5 h-5 text-[#666666]" />
                      </div>
                      <h5 className="text-[#f1f1f1] font-medium mb-1">{item.title}</h5>
                      <p className="text-[#666666] text-sm">{item.desc}</p>
                    </div>
                    {idx < 2 && (
                      <div className="hidden md:block absolute top-1/2 -right-2 text-[#333333]">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative mb-6">
            {/* Outer ring */}
            <div className="w-20 h-20 rounded-full border-4 border-[#272727]" />
            {/* Animated ring */}
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-[#cc0000] animate-spin" />
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Youtube className="w-8 h-8 text-[#cc0000] animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-[#f1f1f1] mb-2">Analyzing Channel</h3>
          <p className="text-[#666666]">Fetching videos and stats...</p>
          
          {/* Progress dots */}
          <div className="flex gap-1.5 mt-4">
            <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Channel Stats Card */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#cc0000]/10 via-transparent to-[#cc0000]/5" />
            <div className="relative bg-[#181818]/80 backdrop-blur-sm border border-[#272727] rounded-2xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/30">
                    <Youtube className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#f1f1f1]">{results.channelName}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1.5 text-[#888888] text-sm">
                        <Users className="w-4 h-4" />
                        {formatNumber(results.subscriberCount)} subscribers
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-[#0f0f0f] border border-[#272727] rounded-xl text-center">
                    <div className="text-2xl font-bold text-[#cc0000]">{results.videos.length}</div>
                    <div className="text-xs text-[#666666]">Videos Found</div>
                  </div>
                  <div className="px-4 py-2 bg-[#0f0f0f] border border-[#272727] rounded-xl text-center">
                    <div className="text-2xl font-bold text-[#f1f1f1]">{results.daysPeriod}</div>
                    <div className="text-xs text-[#666666]">Days Period</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Add Section */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#cc0000]/20 to-[#cc0000]/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative bg-[#181818] rounded-2xl p-6 border border-[#272727] hover:border-[#cc0000]/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000]/20 to-[#cc0000]/10 border border-[#cc0000]/30 flex items-center justify-center">
                  <Download className="w-5 h-5 text-[#cc0000]" />
                </div>
                <div>
                  <h4 className="text-[#f1f1f1] font-semibold">Quick Add All Videos</h4>
                  <p className="text-[#666666] text-sm">Add all {results.videos.length} videos to your ideation board</p>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <NicheInput
                    value={bulkNiche}
                    onChange={setBulkNiche}
                    disabled={bulkAdding}
                  />
                </div>
                <Button
                  onClick={handleBulkAdd}
                  disabled={bulkAdding || !bulkNiche.trim()}
                  className="bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white h-11 px-6 flex-shrink-0 shadow-lg shadow-[#cc0000]/20 rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {bulkAdding ? 'Adding...' : `Add All ${results.videos.length} Videos`}
                </Button>
              </div>
            </div>
          </div>

          {/* Video Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[#f1f1f1] font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#cc0000]" />
                Videos from {results.channelName}
              </h4>
              <span className="text-sm text-[#666666]">Click to add individually</span>
            </div>
            
            <div className="grid gap-3">
              {results.videos.map((video, index) => (
                <div 
                  key={video.id} 
                  className="group relative flex gap-4 p-4 bg-[#181818]/80 backdrop-blur-sm rounded-xl hover:bg-[#1f1f1f] transition-all duration-300 border border-[#272727] hover:border-[#333333] hover:shadow-lg hover:shadow-black/20"
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-36 h-20 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                      #{index + 1}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-[#f1f1f1] text-sm font-medium line-clamp-2 group-hover:text-white transition-colors">
                      {video.title}
                    </h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-[#888888] text-xs">
                        <Eye className="w-3.5 h-3.5 text-[#cc0000]" />
                        <span className="font-medium text-[#f1f1f1]">{formatNumber(video.viewCount)}</span> views
                      </span>
                      <span className="text-[#666666] text-xs">
                        {formatDate(video.uploadDate)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Add Button */}
                  <Dialog open={dialogOpen && selectedVideo?.id === video.id} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                      setNiche('');
                      setSelectedVideo(null);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedVideo(video);
                          setDialogOpen(true);
                        }}
                        className="flex-shrink-0 text-[#888888] hover:text-white bg-[#272727] hover:bg-[#cc0000] h-10 px-4 text-xs rounded-lg transition-all duration-300 opacity-70 group-hover:opacity-100"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Add to Ideas
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#181818] border-[#272727] max-w-md rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-[#f1f1f1] text-lg font-semibold flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-[#cc0000]" />
                          Add to Ideation
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-5 pt-2">
                        <div className="relative overflow-hidden rounded-xl">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-40 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="text-white text-sm font-medium line-clamp-2">{video.title}</p>
                            <p className="text-white/70 text-xs mt-1">{formatNumber(video.viewCount)} views</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-[#888888] mb-2 font-medium">
                            Select Niche
                          </label>
                          <NicheInput
                            value={niche}
                            onChange={setNiche}
                            disabled={addingVideo}
                          />
                        </div>
                        <Button
                          onClick={() => handleAddVideo(video)}
                          disabled={addingVideo || !niche.trim()}
                          className="w-full bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white h-12 rounded-xl font-semibold shadow-lg shadow-[#cc0000]/30"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {addingVideo ? 'Adding...' : 'Add to Ideation Board'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserChannelAnalysis;
