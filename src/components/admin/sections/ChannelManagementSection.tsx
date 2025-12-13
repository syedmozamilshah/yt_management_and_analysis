
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import ChannelManagement from '../ChannelManagement';

const ChannelManagementSection = () => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Channel Management 📺</h2>
        <p className="text-[#aaaaaa] text-lg">
          Keep track of channels and update their statistics
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <ChannelManagement />
      </div>
    </div>
  );
};

export default ChannelManagementSection;
