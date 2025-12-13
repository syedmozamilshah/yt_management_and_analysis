
import React, { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import AdminHeader from './AdminHeader';
import AdminVideoManagement from './AdminVideoManagement';
import AdminAddVideo from './AdminAddVideo';
import ChannelAnalysisSection from './sections/ChannelAnalysisSection';
import ProvenNichesSection from './sections/ProvenNichesSection';
import UserAnalyticsSection from './sections/UserAnalyticsSection';

const AdminDashboard = () => {
  console.log('AdminDashboard rendered');
  const [activeSection, setActiveSection] = useState<string>('video-management');

  const renderSection = () => {
    console.log('Rendering section:', activeSection);
    switch (activeSection) {
      case 'add-video':
        return <AdminAddVideo />;
      case 'channel-analysis':
        return <ChannelAnalysisSection />;
      case 'proven-niches':
        return <ProvenNichesSection />;
      case 'user-analytics':
        return <UserAnalyticsSection />;
      case 'video-management':
      default:
        return <AdminVideoManagement />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AdminHeader activeSection={activeSection} setActiveSection={setActiveSection} />
          <main className="flex-1 overflow-auto p-6">
            {renderSection()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
