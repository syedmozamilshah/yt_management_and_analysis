
import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import HomeHeader from '@/components/home/HomeHeader';
import UserChannelAnalysis from '@/components/home/UserChannelAnalysis';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';

const Home = () => {
  const { user, loading, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<string>('channel-analysis');

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <HomeHeader activeSection={activeSection} setActiveSection={setActiveSection} />
          <main className="flex-1 overflow-auto p-6 max-w-4xl mx-auto">
            <UserChannelAnalysis />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Home;
