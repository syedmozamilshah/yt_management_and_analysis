
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
  ChevronDown,
  Plus,
  Search,
  Rss,
  Loader2
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { addTrackedChannel } from "@/services/channelTrackerService"
import { ChannelAnalysisDialog } from "@/components/ChannelAnalysisDialog"

interface ChannelData {
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  channel_thumbnail: string | null;
  channel_subscribers: number;
  videos_fetched?: number;
  videos?: Array<{
    id: string;
    video_id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string;
    youtube_url: string | null;
    view_count: number | null;
  }>;
  rss_feed_url?: string;
}

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, signOut, adminDataMode, setAdminDataMode } = useAuth()
  const { toast } = useToast()
  const [addChannelModalOpen, setAddChannelModalOpen] = useState(false)
  const [channelUrl, setChannelUrl] = useState('')
  const [daysPeriod, setDaysPeriod] = useState('7')
  const [isAddingChannel, setIsAddingChannel] = useState(false)
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false)
  const [analyzedChannelData, setAnalyzedChannelData] = useState<ChannelData | null>(null)

  const handleAnalyzeChannel = async () => {
    if (!channelUrl.trim()) return;
    
    setIsAddingChannel(true);
    
    try {
      // Use RSS-based analyze-channel (free, no API quota) with time period filtering
      const result = await addTrackedChannel(channelUrl, parseInt(daysPeriod));
      
      // Store channel data and close the first dialog
      setAnalyzedChannelData({
        channel_id: result.channel_id,
        channel_name: result.channel_name,
        channel_handle: result.channel_handle || null,
        channel_thumbnail: result.channel_thumbnail || null,
        channel_subscribers: result.channel_subscribers,
        videos_fetched: result.videos_fetched,
        videos: result.videos,
        rss_feed_url: result.rss_feed_url
      });
      
      setAddChannelModalOpen(false);
      // Open the analysis dialog instead of navigating
      setAnalysisDialogOpen(true);
    } catch (error: any) {
      console.error('Error adding channel:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add channel. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingChannel(false);
    }
  }

  const handleAnalysisComplete = () => {
    // Reset form state
    setChannelUrl('');
    setDaysPeriod('7');
    setAnalyzedChannelData(null);
    // Navigate to ideation page to show the added videos
    navigate('/');
  }

  // Menu items - Reorganized sidebar
  const mainItems = [
    {
      title: "Ideation",
      url: "/",
      icon: Lightbulb,
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          {/* Logo - perfectly aligned with Add Channel button */}
          <div className="pl-2 pr-0 py-1 mb-1">
            <img src="/Blow_me_ai.png" alt="Blow Me AI" className="h-16 w-auto" />
          </div>
          {/* Add Channel Button - Top of sidebar */}
          <div className="px-2 mb-3">
            <Dialog open={addChannelModalOpen} onOpenChange={setAddChannelModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Channel
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#181818] border border-[#272727] text-white sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#cc0000]" />
                      Add Channel
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label className="text-[#aaaaaa]">Channel URL or Handle</Label>
                      <Input
                        value={channelUrl}
                        onChange={(e) => setChannelUrl(e.target.value)}
                        placeholder="@channelname or youtube.com/..."
                        className="bg-[#0f0f0f] border-[#272727] text-white placeholder:text-[#666666]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#aaaaaa]">Time Period</Label>
                      <Select value={daysPeriod} onValueChange={setDaysPeriod}>
                        <SelectTrigger className="bg-[#0f0f0f] border-[#cc0000] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#181818] border-[#272727]">
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="28">Last 28 days</SelectItem>
                          <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleAnalyzeChannel}
                      disabled={!channelUrl.trim() || isAddingChannel}
                      className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
                    >
                      {isAddingChannel ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding Channel...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Analyze Channel
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
            </Dialog>
          </div>
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
                      isActive={location.pathname === '/admin/users'}
                      className={`hover:bg-sidebar-accent transition-colors cursor-pointer ${
                        location.pathname === '/admin/users' ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' : ''
                      }`}
                      onClick={() => handleNavigation('/admin/users')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Users className="w-5 h-5" />
                        <span>Users</span>
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

      {/* Channel Analysis Dialog */}
      <ChannelAnalysisDialog
        open={analysisDialogOpen}
        onOpenChange={setAnalysisDialogOpen}
        channelData={analyzedChannelData}
        daysPeriod={parseInt(daysPeriod)}
        onComplete={handleAnalysisComplete}
      />
    </Sidebar>
  )
}
