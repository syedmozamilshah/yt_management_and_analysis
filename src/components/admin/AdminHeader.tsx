
import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Video, Users, Target, BarChart3, UserCheck, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminHeaderProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ activeSection, setActiveSection }) => {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#181818] border-b border-[#272727]">
      <div className="px-4 sm:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-xl p-2 transition-all duration-300" />
            <h1 className="text-2xl font-bold text-[#f1f1f1]">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => navigate('/?tab=title-generator')}
              className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
              size="default"
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate Title
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-4">
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
            Manage Videos
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
          <Button
            onClick={() => setActiveSection('proven-niches')}
            variant={activeSection === 'proven-niches' ? 'default' : 'ghost'}
            className={`flex items-center gap-2 ${
              activeSection === 'proven-niches' 
                ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
            }`}
          >
            <Target className="w-4 h-4" />
            Add Niches
          </Button>
          <Button
            onClick={() => setActiveSection('user-analytics')}
            variant={activeSection === 'user-analytics' ? 'default' : 'ghost'}
            className={`flex items-center gap-2 ${
              activeSection === 'user-analytics' 
                ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            User Analytics
          </Button>
          <Button
            onClick={() => setActiveSection('user-management')}
            variant={activeSection === 'user-management' ? 'default' : 'ghost'}
            className={`flex items-center gap-2 ${
              activeSection === 'user-management' 
                ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Users
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
