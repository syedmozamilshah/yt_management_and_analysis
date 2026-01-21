
import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import UserManagement from '@/components/admin/UserManagement';

const AdminUsers = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818]/95 border-b border-[#272727]">
              <div className="px-4 sm:px-8 py-6">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
                  <h1 className="text-xl sm:text-2xl font-semibold text-white">User Management</h1>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-8">
              <UserManagement />
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminUsers;
