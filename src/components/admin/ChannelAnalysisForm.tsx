
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Eye, Users, Video, Download } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatNumbers';
import { NicheInput } from '../NicheInput';

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

const ChannelAnalysisForm = () => {
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
    if (!selectedVideo || !niche.trim()) {
      toast({
        title: "Error",
        description: "Please enter a niche for this video",
        variant: "destructive"
      });
      return;
    }

    setAddingVideo(true);

    try {
      const { error } = await supabase
        .from('videos')
        .insert({
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
        description: "Video added to database!"
      });

      setSelectedVideo(null);
      setNiche('');
    } catch (error) {
      console.error('Error adding video:', error);
      toast({
        title: "Error",
        description: "Failed to add video. It may already exist in the database.",
        variant: "destructive"
      });
    } finally {
      setAddingVideo(false);
    }
  };

  const handleBulkAddVideos = async () => {
    if (!results?.videos.length || !bulkNiche.trim()) {
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

      const { error } = await supabase
        .from('videos')
        .insert(videosToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully added ${results.videos.length} videos to the database!`
      });

      setBulkNiche('');
    } catch (error) {
      console.error('Error bulk adding videos:', error);
      toast({
        title: "Error",
        description: "Failed to add videos. Some may already exist in the database.",
        variant: "destructive"
      });
    } finally {
      setBulkAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="bg-[#181818] border-[#272727]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5" />
            Channel Video Import
          </CardTitle>
          <p className="text-[#aaaaaa]">
            Import all videos from a YouTube channel for the selected time period.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="url"
              placeholder="Paste YouTube channel URL here... (e.g., https://youtube.com/@channelname)"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              disabled={loading}
              className="bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
            />
            
            <div className="space-y-2">
              <label className="text-[#aaaaaa] text-sm font-medium">Import Period</label>
              <Select value={daysPeriod} onValueChange={setDaysPeriod} disabled={loading}>
                <SelectTrigger className="bg-[#212121] border-[#272727] text-[#f1f1f1]">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent className="bg-[#181818] border-[#272727]">
                  <SelectItem value="7" className="text-[#f1f1f1]">Last 7 days</SelectItem>
                  <SelectItem value="28" className="text-[#f1f1f1]">Last 28 days</SelectItem>
                  <SelectItem value="90" className="text-[#f1f1f1]">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              {loading ? 'Fetching Videos...' : `Get All Videos (${daysPeriod} days)`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results && (
        <Card className="bg-[#181818] border-[#272727]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-[#cc0000]" />
              Channel Videos Retrieved
            </CardTitle>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-[#aaaaaa]">
                <Users className="w-4 h-4" />
                <span className="font-medium">{results.channelName}</span>
                <Badge variant="secondary" className="bg-[#272727] text-[#f1f1f1] border-[#272727]">
                  {formatNumber(results.subscriberCount)} subscribers
                </Badge>
              </div>
              <div className="text-[#aaaaaa]">
                {results.totalVideosFound} videos uploaded in last {results.daysPeriod} days
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[#cc0000]" />
                <span className="text-[#cc0000] font-bold">
                  {results.videos.length} videos ready to import
                </span>
              </div>
            </div>
          </CardHeader>
          
          {results.videos.length > 0 && (
            <>
              {/* Bulk Add Section */}
              <div className="px-6 pb-4">
                <Card className="bg-[#212121] border-[#272727]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[#cc0000] text-lg flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Bulk Import All Videos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <NicheInput
                      value={bulkNiche}
                      onChange={setBulkNiche}
                      disabled={bulkAdding}
                      placeholder="Enter niche for all videos..."
                    />
                    <Button
                      onClick={handleBulkAddVideos}
                      disabled={bulkAdding || !bulkNiche.trim()}
                      className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold"
                    >
                      {bulkAdding ? 'Importing Videos...' : `Import All ${results.videos.length} Videos`}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <CardContent>
                <div className="space-y-4">
                  {results.videos.map((video) => (
                    <div key={video.id} className="relative p-4 rounded-lg bg-[#212121] border border-[#272727]">
                      <div className="flex gap-4">
                        <div className="relative">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-32 h-20 object-cover rounded border border-[#272727]"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-semibold line-clamp-2 leading-tight mb-3">
                            {video.title}
                          </h4>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 bg-[#272727] rounded border border-[#404040]">
                              <Eye className="w-4 h-4 text-[#cc0000]" />
                              <span className="text-[#aaaaaa] font-medium">
                                {formatNumber(video.viewCount)} views
                              </span>
                            </div>
                            
                            <div className="text-[#aaaaaa] text-sm">
                              Uploaded: {formatDate(video.uploadDate)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => window.open(video.youtubeUrl, '_blank')}
                            variant="outline"
                            size="sm"
                            className="bg-[#272727] hover:bg-[#404040] border-[#272727] text-[#aaaaaa] hover:text-white"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                onClick={() => setSelectedVideo(video)}
                                size="sm"
                                className="bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Single
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-[#181818] border-[#272727] text-white">
                              <DialogHeader>
                                <DialogTitle className="text-white">Add Competitor Video to Database</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="text-[#aaaaaa] text-sm">
                                  <strong>{selectedVideo?.title}</strong>
                                </div>
                                <NicheInput
                                  value={niche}
                                  onChange={setNiche}
                                  disabled={addingVideo}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={handleAddVideo}
                                    disabled={addingVideo || !niche.trim()}
                                    className="flex-1 bg-[#cc0000] hover:bg-[#aa0000] text-white"
                                  >
                                    {addingVideo ? 'Adding...' : 'Add Competitor Video'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </>
          )}
          
          {results.videos.length === 0 && (
            <CardContent>
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📺</div>
                <p className="text-white text-lg mb-2">No videos found</p>
                <p className="text-[#aaaaaa]">
                  No videos were uploaded by {results.channelName} in the last {results.daysPeriod} days.
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};

export default ChannelAnalysisForm;
