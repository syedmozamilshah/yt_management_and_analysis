
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface CompetitorVideosFilterProps {
  selectedDuration: string;
  onDurationChange: (duration: string) => void;
}

export const CompetitorVideosFilter: React.FC<CompetitorVideosFilterProps> = ({
  selectedDuration,
  onDurationChange
}) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[#cc0000]" />
        <span className="text-[#f1f1f1] font-medium">Time Period:</span>
      </div>
      
      <Select value={selectedDuration} onValueChange={onDurationChange}>
        <SelectTrigger className="w-48 bg-[#212121] border-[#404040] text-[#f1f1f1]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#212121] border-[#404040]">
          <SelectItem value="7d" className="text-[#f1f1f1] hover:bg-[#cc0000] focus:bg-[#cc0000]">Last 7 Days</SelectItem>
          <SelectItem value="14d" className="text-[#f1f1f1] hover:bg-[#cc0000] focus:bg-[#cc0000]">Last 14 Days</SelectItem>
          <SelectItem value="30d" className="text-[#f1f1f1] hover:bg-[#cc0000] focus:bg-[#cc0000]">Last 30 Days</SelectItem>
          <SelectItem value="60d" className="text-[#f1f1f1] hover:bg-[#cc0000] focus:bg-[#cc0000]">Last 60 Days</SelectItem>
          <SelectItem value="90d" className="text-[#f1f1f1] hover:bg-[#cc0000] focus:bg-[#cc0000]">Last 90 Days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
