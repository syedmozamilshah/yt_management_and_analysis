
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Plus } from 'lucide-react';
import ChannelAnalysisForm from '../ChannelAnalysisForm';

const ChannelAnalysisSection = () => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Plus className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">Add Competitor Channel Videos 📺</h2>
        <p className="text-[#aaaaaa] text-lg">
          Import all videos from any YouTube channel for a selected time period
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="bg-[#181818] border-[#272727] mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Video className="w-8 h-8 text-[#cc0000]" />
              <div>
                <h3 className="text-[#f1f1f1] font-semibold text-lg">Bulk Video Import</h3>
                <p className="text-[#aaaaaa] text-sm">
                  Get all videos from a channel for analysis and storage 📊
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-[#212121] p-3 rounded-lg">
                <div className="text-2xl">🎯</div>
                <div className="text-[#aaaaaa] text-sm font-medium">All Videos</div>
              </div>
              <div className="bg-[#212121] p-3 rounded-lg">
                <div className="text-2xl">⚡</div>
                <div className="text-[#aaaaaa] text-sm font-medium">Bulk Import</div>
              </div>
              <div className="bg-[#212121] p-3 rounded-lg">
                <div className="text-2xl">🚀</div>
                <div className="text-[#aaaaaa] text-sm font-medium">Fast Analysis</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ChannelAnalysisForm />
      </div>
    </div>
  );
};

export default ChannelAnalysisSection;
