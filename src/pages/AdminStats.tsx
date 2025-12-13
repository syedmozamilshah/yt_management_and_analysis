import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import AdminStatsSection from '@/components/admin/sections/AdminStatsSection';
import { PieChart } from 'lucide-react';

const AdminStats = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Header */}
          <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
            <div className="px-4 sm:px-8 py-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#cc0000] rounded-xl flex items-center justify-center">
                    <PieChart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#f1f1f1]">Admin Statistics</h1>
                    <p className="text-sm text-[#aaaaaa]">Platform analytics and usage metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <main className="flex-1 overflow-auto p-6">
            <AdminStatsSection />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminStats;
