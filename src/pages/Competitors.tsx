
import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Users2, Sparkles } from 'lucide-react';
import UserChannelAnalysis from '@/components/home/UserChannelAnalysis';

const Competitors = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="bg-[#0f0f0f] text-[#f1f1f1] min-h-screen">
            <div className="sticky top-0 z-10 bg-[#0f0f0f]/90 backdrop-blur-xl border-b border-[#272727]/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg transition-all duration-200" />
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/20">
                  <Users2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-[#f1f1f1] flex items-center gap-2">
                    Competitor Analysis
                    <Sparkles className="w-4 h-4 text-[#cc0000]" />
                  </h1>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-w-5xl mx-auto">
              <UserChannelAnalysis />
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Competitors;
