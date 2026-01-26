
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

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, signOut, adminDataMode, setAdminDataMode } = useAuth()

  // Menu items - Reorganized sidebar with Ideation, USA and Spanish tabs
  // Ideation is shown for everyone - admin in All Data mode sees all users' data, in My Data mode sees own data
  const mainItems = [
    {
      title: "Ideation",
      url: "/?tab=ideation",
      icon: Lightbulb,
      emoji: null,
    },
    {
      title: "USA",
      url: "/?tab=usa",
      icon: null,
      emoji: "🇺🇸",
    },
    {
      title: "Spanish",
      url: "/?tab=spanish",
      icon: null,
      emoji: "🇪🇸",
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
          // Special case: Ideation tab should be active when on / with no tab param (default)
          if (key === 'tab' && value === 'ideation' && !currentParams.get('tab')) {
            return true;
          }
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
          {/* Logo */}
          <div className="pl-2 pr-0 py-1 mb-1">
            <img src="/blow_me_ai.png" alt="Blow Me AI" className="h-16 w-auto" />
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
                        {item.emoji ? (
                          <span className="text-lg w-5 h-5 flex items-center justify-center">{item.emoji}</span>
                        ) : item.icon ? (
                          <item.icon className="w-5 h-5" />
                        ) : null}
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
    </Sidebar>
  )
}
