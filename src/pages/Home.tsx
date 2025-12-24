
import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import HomeHeader from '@/components/home/HomeHeader';
import UserVideoManagement from '@/components/home/UserVideoManagement';
import UserAddVideo from '@/components/home/UserAddVideo';
import UserChannelAnalysis from '@/components/home/UserChannelAnalysis';
import UserProvenNiches from '@/components/home/UserProvenNiches';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';

const Home = () => {
  const { user, loading, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<string>('video-management');

  // Check URL params for section navigation (e.g., from sidebar Add Competitor)
  useEffect(() => {
    const section = searchParams.get('section');
    if (section && ['video-management', 'add-video', 'channel-analysis', 'proven-niches'].includes(section)) {
      setActiveSection(section);
    }
  }, [searchParams]);

  // Redirect admin to database page - admin doesn't have Home page
  if (!loading && isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Redirect to auth if not logged in
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-[#f1f1f1]">Loading...</div>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'add-video':
        return <UserAddVideo />;
      case 'channel-analysis':
        return <UserChannelAnalysis />;
      case 'proven-niches':
        return <UserProvenNiches />;
      case 'video-management':
      default:
        return <UserVideoManagement />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <HomeHeader activeSection={activeSection} setActiveSection={setActiveSection} />
          <main className="flex-1 overflow-auto p-6">
            {renderSection()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Home;
