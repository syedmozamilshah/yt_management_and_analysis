
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
} from "@/components/ui/sidebar"
import { useLocation, useNavigate } from "react-router-dom"
import { 
  Home, 
  Lightbulb, 
  BarChart3, 
  Heart,
  Settings,
  LogOut,
  TrendingUp,
  Globe,
  User,
  PieChart,
  FileText,
  Type,
  Tags
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, signOut, adminDataMode, setAdminDataMode } = useAuth()

  // Menu items - Reorganized sidebar
  const items = [
    {
      title: "Ideation",
      url: "/",
      icon: Lightbulb,
    },
    // Only show Content for non-admin users
    ...(!isAdmin ? [{
      title: "Content",
      url: "/home",
      icon: Home,
    }] : []),
    {
      title: "Favorites",
      url: "/favorites",
      icon: Heart,
    },
    {
      title: "Viewboard",
      url: "/viewboard", 
      icon: BarChart3,
    },
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
          <SidebarGroupLabel className="text-lg font-bold mb-4 px-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#cc0000]" />
            Video Stash
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
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
              
              {/* Admin Section - only visible to admin */}
              {isAdmin && (
                <>
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
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
            
            <div className="text-sm text-sidebar-foreground/70 truncate">
              {user.email}
            </div>
            {isAdmin && (
              <div className="text-xs text-[#cc0000] font-medium">
                Admin Account
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="justify-start text-sidebar-foreground hover:bg-sidebar-accent p-2"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
