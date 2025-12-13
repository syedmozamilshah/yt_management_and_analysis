
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Users, Video, Download, Search } from 'lucide-react';
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
  const [channelUrl, setChannelUrl] = useState('');
  const [daysPeriod, setDaysPeriod] = useState('90');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | null>(null);
  const [niche, setNiche] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);
  const [bulkNiche, setBulkNiche] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const { toast } = useToast();

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

    setLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('get-channel-videos', {
        body: { 
          channelUrl,
          daysPeriod: parseInt(daysPeriod)
        }
      });

      if (error) throw error;

      setResults({ ...data, daysPeriod: parseInt(daysPeriod) });
      
      toast({
        title: "🎉 Videos Retrieved!",
        description: `Found ${data.videos.length} video${data.videos.length > 1 ? 's' : ''} from ${data.channelName}`
      });
    } catch (error) {
      console.error('Error fetching channel videos:', error);
      toast({
        title: "Error",
        description: "Failed to fetch channel videos. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideo = async () => {
    if (!selectedVideo || !niche.trim() || !user?.id) {
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
          title: selectedVideo.title,
          youtube_url: selectedVideo.youtubeUrl,
          video_id: selectedVideo.id,
          thumbnail_url: selectedVideo.thumbnailUrl,
          channel_name: results?.channelName,
          channel_subscribers: results?.subscriberCount,
          upload_date: selectedVideo.uploadDate,
          view_count: selectedVideo.viewCount,
          niche: niche.trim()
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Video added to your collection!"
      });

      setSelectedVideo(null);
      setNiche('');
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
        description: `Added ${results.videos.length} videos to your collection!`
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
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">Channel Analysis 📺</h2>
        <p className="text-[#aaaaaa] text-lg">
          Import all videos from any YouTube channel for a selected time period
        </p>
      </div>

      {/* Search Form */}
      <Card className="bg-[#181818] border-[#272727] max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-[#f1f1f1]">Analyze Channel</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                Channel URL or Handle
              </label>
              <Input
                placeholder="https://youtube.com/@channelname or @channelname"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                disabled={loading}
                className="bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                Time Period
              </label>
              <Select value={daysPeriod} onValueChange={setDaysPeriod} disabled={loading}>
                <SelectTrigger className="bg-[#212121] border-[#272727] text-[#f1f1f1]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#212121] border-[#272727]">
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              {loading ? 'Analyzing...' : 'Analyze Channel'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Channel Stats */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader>
              <CardTitle className="text-[#f1f1f1] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#cc0000]" />
                {results.channelName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#212121] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#f1f1f1]">
                    {formatNumber(results.subscriberCount)}
                  </div>
                  <div className="text-[#aaaaaa] text-sm">Subscribers</div>
                </div>
                <div className="bg-[#212121] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#f1f1f1]">
                    {results.videos.length}
                  </div>
                  <div className="text-[#aaaaaa] text-sm">Videos Found</div>
                </div>
                <div className="bg-[#212121] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#f1f1f1]">
                    {results.daysPeriod}
                  </div>
                  <div className="text-[#aaaaaa] text-sm">Days Period</div>
                </div>
                <div className="bg-[#212121] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#f1f1f1]">
                    {formatNumber(results.videos.reduce((sum, v) => sum + v.viewCount, 0))}
                  </div>
                  <div className="text-[#aaaaaa] text-sm">Total Views</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Add */}
          <Card className="bg-[#181818] border-[#cc0000]/30">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                    Add All Videos with Niche
                  </label>
                  <NicheInput
                    value={bulkNiche}
                    onChange={setBulkNiche}
                    disabled={bulkAdding}
                  />
                </div>
                <Button
                  onClick={handleBulkAdd}
                  disabled={bulkAdding || !bulkNiche.trim()}
                  className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {bulkAdding ? 'Adding...' : `Add All ${results.videos.length} Videos`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Video List */}
          <Card className="bg-[#181818] border-[#272727]">
            <CardHeader>
              <CardTitle className="text-[#f1f1f1]">Videos Found</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {results.videos.map((video) => (
                  <div 
                    key={video.id} 
                    className="flex gap-4 p-4 bg-[#212121] rounded-lg hover:bg-[#272727] transition-colors"
                  >
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-32 h-20 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[#f1f1f1] font-medium truncate">{video.title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-[#aaaaaa] text-sm">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {formatNumber(video.viewCount)}
                        </span>
                        <span>{formatDate(video.uploadDate)}</span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedVideo(video)}
                          className="text-[#cc0000] hover:text-[#aa0000] hover:bg-[#cc0000]/10"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#181818] border-[#272727]">
                        <DialogHeader>
                          <DialogTitle className="text-[#f1f1f1]">Add Video</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-40 object-cover rounded"
                          />
                          <p className="text-[#f1f1f1] font-medium">{video.title}</p>
                          <div>
                            <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                              Niche
                            </label>
                            <NicheInput
                              value={niche}
                              onChange={setNiche}
                              disabled={addingVideo}
                            />
                          </div>
                          <Button
                            onClick={handleAddVideo}
                            disabled={addingVideo || !niche.trim()}
                            className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
                          >
                            {addingVideo ? 'Adding...' : 'Add to My Videos'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UserChannelAnalysis;
