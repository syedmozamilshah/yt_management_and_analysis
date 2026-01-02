
import React, { useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Users2, Sparkles, Zap } from 'lucide-react';
import UserChannelAnalysis from '@/components/home/UserChannelAnalysis';
import CompetitorWebhookTracker from '@/components/home/CompetitorWebhookTracker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Competitors = () => {
  const [activeTab, setActiveTab] = useState('webhooks');

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
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#181818] border border-[#272727] rounded-xl p-1 mb-6">
                  <TabsTrigger
                    value="webhooks"
                    className="rounded-lg data-[state=active]:bg-[#cc0000] data-[state=active]:text-white text-[#888888]"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Real-time Tracker
                  </TabsTrigger>
                  <TabsTrigger
                    value="analyzer"
                    className="rounded-lg data-[state=active]:bg-[#cc0000] data-[state=active]:text-white text-[#888888]"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Channel Analyzer
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="webhooks" className="space-y-4">
                  <div className="p-4 bg-[#0f0f0f]/50 border border-[#cc0000]/20 rounded-xl">
                    <p className="text-sm text-[#aaaaaa]">
                      <span className="text-[#cc0000] font-semibold">WebSub-powered:</span> Get real-time notifications when competitors upload new videos. Videos appear instantly via webhook delivery, with RSS polling as backup every 12 hours.
                    </p>
                  </div>
                  <CompetitorWebhookTracker />
                </TabsContent>

                <TabsContent value="analyzer" className="space-y-4">
                  <div className="p-4 bg-[#0f0f0f]/50 border border-[#cc0000]/20 rounded-xl">
                    <p className="text-sm text-[#aaaaaa]">
                      <span className="text-[#cc0000] font-semibold">One-time analysis:</span> Analyze any YouTube channel to see their video performance history. Perfect for research and competitive intelligence.
                    </p>
                  </div>
                  <UserChannelAnalysis />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Competitors;
