
import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import ProvenNichesContent from '@/components/ProvenNichesContent';

const ProvenNiches = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <ProvenNichesContent />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default ProvenNiches;
