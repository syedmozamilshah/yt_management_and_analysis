
import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus, Video, Users, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface HomeHeaderProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ activeSection, setActiveSection }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
      <div className="px-4 sm:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#cc0000]">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#f1f1f1]">My Competitors</h1>
                <p className="text-[#aaaaaa] text-sm truncate max-w-[200px]">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            onClick={() => setActiveSection('video-management')}
            variant={activeSection === 'video-management' ? 'default' : 'ghost'}
            className={`flex items-center gap-2 ${
              activeSection === 'video-management' 
                ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
            }`}
          >
            <Video className="w-4 h-4" />
            Competitor Videos
          </Button>
          <Button
            onClick={() => setActiveSection('add-video')}
            variant={activeSection === 'add-video' ? 'default' : 'ghost'}
            className={`flex items-center gap-2 ${
              activeSection === 'add-video' 
                ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Competitor Video
          </Button>
          <Button
            onClick={() => setActiveSection('channel-analysis')}
            variant={activeSection === 'channel-analysis' ? 'default' : 'ghost'}
            className={`flex items-center gap-2 ${
              activeSection === 'channel-analysis' 
                ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
            }`}
          >
            <Users className="w-4 h-4" />
            Add Competitor Channel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomeHeader;
