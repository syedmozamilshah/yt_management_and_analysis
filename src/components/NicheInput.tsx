
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NicheInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const NicheInput: React.FC<NicheInputProps> = ({ 
  value, 
  onChange, 
  disabled = false, 
  placeholder = "e.g., NASCAR, WNBA, Gaming, Tech..." 
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="niche" className="text-white font-medium">
        Niche <span className="text-red-400">*</span>
      </Label>
      <Input
        id="niche"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-[#181818] border-[#404040] text-white placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]"
        required
      />
      <p className="text-[#aaaaaa] text-xs">
        Enter the content category or sport type for this video
      </p>
    </div>
  );
};
