
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useLocation, useNavigate } from "react-router-dom"
import { 
  Home, 
  Lightbulb, 
  Heart,
  Settings,
  LogOut,
  TrendingUp,
  Globe,
  User,
  PieChart,
  FileText,
  Type,
  Tags,
  Users,
  Sparkles,
  ChevronDown
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, signOut, adminDataMode, setAdminDataMode } = useAuth()
  const [showAddCompetitorModal, setShowAddCompetitorModal] = useState(false)
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [selectedDuration, setSelectedDuration] = useState('7d')

  const { toast } = useToast()

  // Menu items - Reorganized sidebar
  const mainItems = [
    {
      title: "Ideation",
      url: "/",
      icon: Lightbulb,
    },
    // Only show Competitor for non-admin users
    ...(!isAdmin ? [{
      title: "Competitor",
      url: "/home",
      icon: Users,
    }] : []),
    {
      title: "Favorites",
      url: "/favorites",
      icon: Heart,
    },
  ]

  // AI Tools items
  const aiToolItems = [
    {
      title: "Script",
      url: "/tools?tab=script",
      icon: FileText,
    },
    {
      title: "Title",
      url: "/?tab=title-generator",
      icon: Type,
    },
    {
      title: "SEO",
      url: "/tools?tab=seo",
      icon: Tags,
    },
    {
      title: "Competitor",
      url: "/tools?tab=competitor",
      icon: Users,
    }
  ]

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const isItemActive = (itemUrl: string) => {
    const [itemPath, itemQuery] = itemUrl.split('?');
    const currentPath = location.pathname;
    const currentSearch = location.search;
    
    // If the URL has query params, check both path and params
    if (itemQuery) {
      const params = new URLSearchParams('?' + itemQuery);
      const currentParams = new URLSearchParams(currentSearch);
      
      if (currentPath === itemPath) {
        for (const [key, value] of params.entries()) {
          if (currentParams.get(key) === value) {
            return true;
          }
        }
      }
      return false;
    }
    
    // For URLs without query params, check path and no conflicting query
    if (currentPath === itemPath && !currentSearch) {
      return true;
    }
    
    return false;
  };

  const handleNavigation = (url: string) => {
    // Force navigation even if same URL
    navigate(url, { replace: true });
  }

  const handleAddCompetitor = async () => {
    if (!competitorUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube channel URL",
        variant: "destructive"
      });
      return;
    }

    // Navigate directly to channel-analysis section with URL and duration
    // The UserChannelAnalysis component will handle the actual analysis using get-channel-videos
    const channelUrlEncoded = encodeURIComponent(competitorUrl);
    const daysParam = selectedDuration === 'all' ? 'all' : selectedDuration.replace('d', '');
    
    setCompetitorUrl('');
    setSelectedDuration('7d');
    setShowAddCompetitorModal(false);
    
    navigate(`/home?section=channel-analysis&channelUrl=${channelUrlEncoded}&days=${daysParam}`);
  };

  return (
    <>
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold mb-4 px-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#cc0000]" />
            Video Stash
          </SidebarGroupLabel>
          {/* Add Competitor Button - Top of sidebar */}
          {!isAdmin && (
            <div className="px-2 mb-3">
              <Button
                onClick={() => setShowAddCompetitorModal(true)}
                className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Competitor
              </Button>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Main Menu Items */}
              {mainItems.map((item) => {
                const isActive = isItemActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      isActive={isActive}
                      className={`hover:bg-sidebar-accent transition-colors cursor-pointer ${
                        isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' : ''
                      }`}
                      onClick={() => handleNavigation(item.url)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI Tools Section */}
        <SidebarSeparator className="my-2" />
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 flex items-center gap-2 text-[#aaaaaa] text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#cc0000]" />
            AI Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiToolItems.map((item) => {
                const isActive = isItemActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      isActive={isActive}
                      className={`hover:bg-sidebar-accent transition-colors cursor-pointer ${
                        isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' : ''
                      }`}
                      onClick={() => handleNavigation(item.url)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 flex items-center gap-2 text-[#aaaaaa] text-xs uppercase tracking-wider">
                <Settings className="w-4 h-4 text-[#cc0000]" />
                Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={location.pathname === '/admin-stats'}
                      className={`hover:bg-sidebar-accent transition-colors cursor-pointer ${
                        location.pathname === '/admin-stats' ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' : ''
                      }`}
                      onClick={() => handleNavigation('/admin-stats')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <PieChart className="w-5 h-5" />
                        <span>Admin Stats</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={location.pathname === '/admin'}
                      className={`hover:bg-sidebar-accent transition-colors cursor-pointer ${
                        location.pathname === '/admin' ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' : ''
                      }`}
                      onClick={() => handleNavigation('/admin')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Settings className="w-5 h-5" />
                        <span>Admin Portal</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      
      {/* Footer with user info and sign out */}
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="flex flex-col gap-3">
            {/* Admin Data Mode Toggle */}
            {isAdmin && (
              <div className="p-3 rounded-lg bg-[#181818] border border-[#272727]">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-[#aaaaaa] font-medium">Data View Mode</Label>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 text-xs ${adminDataMode === 'my-data' ? 'text-[#cc0000]' : 'text-[#666666]'}`}>
                    <User className="w-3 h-3" />
                    <span>My Data</span>
                  </div>
                  <Switch
                    checked={adminDataMode === 'all-data'}
                    onCheckedChange={(checked) => setAdminDataMode(checked ? 'all-data' : 'my-data')}
                    className="data-[state=checked]:bg-[#cc0000]"
                  />
                  <div className={`flex items-center gap-1 text-xs ${adminDataMode === 'all-data' ? 'text-[#cc0000]' : 'text-[#666666]'}`}>
                    <Globe className="w-3 h-3" />
                    <span>All Data</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* User email with dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-sidebar-foreground/70 hover:bg-sidebar-accent p-2"
                >
                  <span className="truncate text-sm">{user.email}</span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-[#181818] border-[#272727]">
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="text-[#f1f1f1] hover:bg-[#272727] cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {isAdmin && (
              <div className="text-xs text-[#cc0000] font-medium px-2">
                Admin Account
              </div>
            )}
          </div>
        </SidebarFooter>
      )}
    </Sidebar>

    {/* Add Competitor Modal */}
    <Dialog open={showAddCompetitorModal} onOpenChange={setShowAddCompetitorModal}>
      <DialogContent className="bg-[#181818] border-[#272727] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add Competitor Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#aaaaaa] mb-2 block">YouTube Channel URL</label>
            <Input
              type="url"
              placeholder="Paste YouTube channel URL here... (e.g., https://youtube.com/@channelname)"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              className="bg-[#0f0f0f] border-[#272727] text-white placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]"
            />
          </div>
          <div>
            <label className="text-sm text-[#aaaaaa] mb-2 block">Import Period</label>
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#272727] text-white px-3 py-2 rounded-lg focus:outline-none focus:border-[#cc0000]"
            >
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="60d">Last 60 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowAddCompetitorModal(false)}
              className="flex-1 bg-[#272727] hover:bg-[#333333] text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCompetitor}
              className="flex-1 bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              Add Channel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
