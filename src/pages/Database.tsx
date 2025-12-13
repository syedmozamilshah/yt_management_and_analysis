
import React, { useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Heart, TrendingUp, Zap, FileText, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VideoGrid } from '@/components/VideoGrid';
import { UserVideoGrid } from '@/components/UserVideoGrid';
import { TitleGeneratorSection } from '@/components/TitleGeneratorSection';
import { useAuth } from '@/contexts/AuthContext';

const Database = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'videos' | 'title-generator'>('videos');
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();

  const refreshVideos = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            
            {/* Header */}
            <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
              <div className="px-4 sm:px-8 py-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-6">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-[#cc0000]">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#f1f1f1]">
                          {isAdmin ? 'Viral Outliers' : 'My Video Collection'}
                        </h1>
                        <p className="text-[#aaaaaa] text-sm">
                          {isAdmin 
                            ? 'Videos that break algorithmic barriers & AI-powered title generation'
                            : 'Your saved videos and personal analytics'
                          }
                        </p>
                        {!isAdmin && (
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-3 h-3 text-[#666666]" />
                            <span className="text-xs text-[#666666]">{user?.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={() => navigate('/favorites')}
                      className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
                      size="default"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Favorites
                    </Button>
                    <Button 
                      onClick={() => navigate(isAdmin ? '/admin' : '/home')}
                      className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
                      size="default"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Video
                    </Button>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6">
                  <Button
                    onClick={() => setActiveTab('videos')}
                    variant={activeTab === 'videos' ? 'default' : 'ghost'}
                    className={`flex items-center gap-2 ${
                      activeTab === 'videos' 
                        ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                        : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Viral Videos
                  </Button>
                  <Button
                    onClick={() => setActiveTab('title-generator')}
                    variant={activeTab === 'title-generator' ? 'default' : 'ghost'}
                    className={`flex items-center gap-2 ${
                      activeTab === 'title-generator' 
                        ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                        : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Title Generator
                  </Button>
                </div>

                {/* Search - only show for videos tab */}
                {activeTab === 'videos' && (
                  <div className="relative max-w-2xl">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#aaaaaa] w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="Search viral videos, channels, or discover hidden gems..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 pr-6 py-3 bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#aaaaaa] focus:border-[#cc0000] rounded-xl"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-8 py-8">
              {activeTab === 'videos' ? (
                <>
                  {/* Welcome Section */}
                  <div className="bg-[#212121] rounded-2xl border border-[#272727] p-8 mb-8">
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#cc0000] mb-4">
                        <Zap className="w-8 h-8 text-white" />
                      </div>
                      
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#f1f1f1]">
                        {isAdmin ? (
                          <>Uncover The Next <span className="text-[#cc0000]">Viral Sensation</span></>
                        ) : (
                          <>Your Personal <span className="text-[#cc0000]">Video Library</span></>
                        )}
                      </h2>
                      
                      <p className="text-[#aaaaaa] text-lg max-w-2xl mx-auto">
                        {isAdmin 
                          ? 'Discover videos where views dramatically exceed subscriber counts. Find breakthrough content and spot emerging trends.'
                          : 'Track and analyze your saved YouTube videos. Build your research database and discover insights.'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Video Grid - Admin sees all, Users see their own */}
                  {isAdmin ? (
                    <VideoGrid refreshTrigger={refreshTrigger} />
                  ) : (
                    <UserVideoGrid refreshTrigger={refreshTrigger} />
                  )}
                </>
              ) : (
                <TitleGeneratorSection />
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Database;
