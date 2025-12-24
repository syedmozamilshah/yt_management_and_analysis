
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { AddToFavoritesForm } from '@/components/AddToFavoritesForm';
import { Heart, Plus, Globe, User } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface Video {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  thumbnail_url: string;
  created_at: string;
  channel_name?: string | null;
  channel_subscribers?: number | null;
  upload_date?: string | null;
  view_count?: number | null;
  is_favorite?: boolean;
}

const Favorites = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin, user, shouldQueryAllData, adminDataMode } = useAuth();

  useEffect(() => {
    fetchFavoriteVideos();
  }, [isAdmin, user?.id, adminDataMode]);

  const fetchFavoriteVideos = async () => {
    try {
      if (shouldQueryAllData()) {
        // Admin in "all-data" mode: fetch ALL users' favorites from user_videos
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('*')
          .eq('is_favorite', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setVideos(data || []);
      } else if (user?.id) {
        // Regular users OR admin in "my-data" mode: fetch from user_videos
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_favorite', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setVideos(data || []);
      } else {
        setVideos([]);
      }
    } catch (error) {
      console.error('Error fetching favorite videos:', error);
      toast({
        title: "Error",
        description: "Failed to load favorite videos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVideoAdded = () => {
    fetchFavoriteVideos();
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#0f0f0f]">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
              <div className="sticky top-0 z-10 bg-[#181818] border-b border-[#272727] px-6 py-4">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg transition-all duration-200" />
                  <h1 className="text-xl font-semibold text-[#f1f1f1]">
                    Favorites
                  </h1>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {[...Array(15)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-[#212121] rounded-lg overflow-hidden">
                      <div className="bg-[#272727] h-48 rounded-t-lg"></div>
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-[#272727] rounded-md"></div>
                        <div className="h-4 bg-[#272727] rounded-md w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            <div className="sticky top-0 z-10 bg-[#181818] border-b border-[#272727] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg transition-all duration-200" />
                  <h1 className="text-xl font-semibold text-[#f1f1f1]">
                    Favorites
                  </h1>
                  {isAdmin && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#212121] border border-[#272727]">
                      {shouldQueryAllData() ? (
                        <>
                          <Globe className="w-4 h-4 text-[#cc0000]" />
                          <span className="text-sm text-[#cc0000] font-medium">All Users</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-[#aaaaaa]" />
                          <span className="text-sm text-[#aaaaaa] font-medium">My Data</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#cc0000] hover:bg-[#aa0000] text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Competitor Video
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#181818] border-[#272727] text-[#f1f1f1]">
                    <AddToFavoritesForm onVideoAdded={handleVideoAdded} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <Heart className="w-8 h-8 text-[#cc0000] fill-[#cc0000]" />
                  <h1 className="text-4xl font-bold text-[#f1f1f1]">
                    Favorite Competitor Videos
                  </h1>
                </div>
                <p className="text-[#aaaaaa] text-lg">Your starred competitor video collection</p>
              </div>
              
              {videos.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-[#212121] rounded-2xl p-12 max-w-md mx-auto border border-[#272727]">
                    <Heart className="w-16 h-16 text-[#cc0000] mx-auto mb-4" />
                    <p className="text-[#f1f1f1] text-xl font-medium mb-2">No favorite competitors yet</p>
                    <p className="text-[#aaaaaa] mb-6">Start adding some competitor videos to see them here!</p>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-[#cc0000] hover:bg-[#aa0000] text-white">
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Competitor Video
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#181818] border-[#272727] text-[#f1f1f1]">
                        <AddToFavoritesForm onVideoAdded={handleVideoAdded} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {videos.map((video) => (
                    <div key={video.id}>
                      <div 
                        className="cursor-pointer hover:shadow-xl hover:shadow-black/30 transition-all duration-300 relative bg-[#212121] border-[#272727] hover:border-[#404040] group overflow-hidden rounded-lg"
                        onClick={() => window.open(video.youtube_url, '_blank')}
                      >
                        <div className="aspect-video w-full overflow-hidden rounded-t-lg relative">
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute top-3 right-3">
                            <Heart className="w-6 h-6 text-[#cc0000] fill-[#cc0000]" />
                          </div>
                        </div>
                        <div className="p-5 bg-[#212121]">
                          <h3 className="font-semibold text-lg line-clamp-2 leading-tight mb-3 text-[#f1f1f1] group-hover:text-[#cc0000] transition-colors">
                            {video.title}
                          </h3>
                          
                          <div className="space-y-1 text-sm text-[#aaaaaa]">
                            {video.channel_name && (
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-[#f1f1f1]">{video.channel_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Favorites;
