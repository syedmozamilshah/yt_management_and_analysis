
import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Users2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HomeHeaderProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ activeSection, setActiveSection }) => {
  const { user } = useAuth();

  return (
    <div className="sticky top-0 z-10 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-[#272727]/50 px-6 py-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg transition-all duration-200" />
        <Users2 className="w-5 h-5 text-[#cc0000]" />
        <h1 className="text-lg font-medium text-[#f1f1f1]">
          Add Channel
        </h1>
      </div>
    </div>
  );
};

export default HomeHeader;
