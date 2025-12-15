
import React, { useState, useEffect } from 'react';
import { VideoGrid } from '@/components/VideoGrid';
import { UserVideoGrid } from '@/components/UserVideoGrid';
import { AllUsersVideoGrid } from '@/components/AllUsersVideoGrid';
import { TitleGeneratorSection } from '@/components/TitleGeneratorSection';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Globe, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'videos' | 'title-generator'>('videos');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, shouldQueryAllData, adminDataMode } = useAuth();

  // Check URL params for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'title-generator') {
      setActiveTab('title-generator');
    } else {
      // Reset to videos if no tab param or different tab
      setActiveTab('videos');
    }
  }, [location.search]);

  const handleVideoAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            
            {/* Header - only show for title generator */}
            {activeTab === 'title-generator' && (
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
                <div className="px-4 sm:px-8 py-6">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                    <h1 className="text-xl sm:text-2xl font-semibold text-white">Title Generator</h1>
                  </div>
                </div>
              </div>
            )}

            {/* Minimal header for videos tab */}
            {activeTab === 'videos' && (
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
                <div className="px-4 sm:px-8 py-4">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                    {isAdmin && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#212121] border border-[#272727]">
                        {shouldQueryAllData() ? (
                          <>
                            <Globe className="w-4 h-4 text-[#cc0000]" />
                            <span className="text-sm text-[#cc0000] font-medium">Viewing All Users Data</span>
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4 text-[#aaaaaa]" />
                            <span className="text-sm text-[#aaaaaa] font-medium">Viewing My Data</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="px-4 sm:px-8 py-8">
              {activeTab === 'videos' ? (
                shouldQueryAllData() ? (
                  <AllUsersVideoGrid refreshTrigger={refreshTrigger} />
                ) : (
                  <UserVideoGrid refreshTrigger={refreshTrigger} />
                )
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

export default Index;
