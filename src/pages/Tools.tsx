import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getWordUsage, addWordUsage, subtractWordUsage } from '@/lib/toolUsageApi';
import { SavedScript, SavedSeoDescription } from '@/components/tools/ToolsHistorySidebar';
import ScriptGenerator from '@/components/tools/ScriptGenerator';
import SeoGenerator from '@/components/tools/SeoGenerator';
import CompetitorFinder from '@/components/tools/CompetitorFinder';
import { CompetitorAnalysis, deleteCompetitorAnalysis } from '@/services/competitorHistoryService';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Sparkles, Trash2, Plus, AlertCircle, Users, Target } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
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
  SidebarHeader,
} from "@/components/ui/sidebar";
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_WORDS = 40000;

const CACHE_KEY = 'tools_data_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  scripts: SavedScript[];
  seoDescriptions: SavedSeoDescription[];
  wordUsage: number;
  timestamp: number;
  userId: string;
}

const getCache = (userId: string): CachedData | null => {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached) as CachedData;
      // Check if cache is valid (same user and not expired)
      if (data.userId === userId && Date.now() - data.timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
  } catch (e) {
    console.error('Error reading cache:', e);
  }
  return null;
};

const setCache = (data: Omit<CachedData, 'timestamp'>) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch (e) {
    console.error('Error setting cache:', e);
  }
};

const Tools = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"script" | "seo" | "competitor">("script");
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [seoDescriptions, setSeoDescriptions] = useState<SavedSeoDescription[]>([]);
  const [competitorHistory, setCompetitorHistory] = useState<CompetitorAnalysis[]>([]);
  const [selectedCompetitorItem, setSelectedCompetitorItem] = useState<CompetitorAnalysis | null>(null);
  const [currentScriptId, setCurrentScriptId] = useState<string>();
  const [currentSeoId, setCurrentSeoId] = useState<string>();
  const [wordUsage, setWordUsage] = useState(0);
  // Check for cached data to determine initial loading state
  const [isLoading, setIsLoading] = useState(() => {
    if (user) {
      const cached = getCache(user.id);
      return !cached; // Only show loading if no cache
    }
    return true;
  });
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  // Handle URL tab parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'script' || tab === 'seo' || tab === 'competitor') {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    if (user) {
      // Check for cached data first
      const cached = getCache(user.id);
      if (cached) {
        setScripts(cached.scripts);
        setSeoDescriptions(cached.seoDescriptions);
        setWordUsage(cached.wordUsage);
        setIsLoading(false);
      } else {
        loadData();
      }
    }
  }, [user]);

  // Update cache when data changes
  useEffect(() => {
    if (user && !isLoading && (scripts.length > 0 || seoDescriptions.length > 0 || wordUsage > 0)) {
      setCache({
        scripts,
        seoDescriptions,
        wordUsage,
        userId: user.id,
      });
    }
  }, [scripts, seoDescriptions, wordUsage, user, isLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load word usage
      let loadedWordUsage = 0;
      const usageData = await getWordUsage();
      if (usageData) {
        loadedWordUsage = usageData.wordUsage;
        setWordUsage(loadedWordUsage);
      }

      let loadedScripts: SavedScript[] = [];
      let loadedSeoDescriptions: SavedSeoDescription[] = [];

      // Load scripts from Supabase
      const { data: scriptsData, error: scriptsError } = await (supabase as any)
        .from('user_scripts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (scriptsError) {
        console.error('Error loading scripts:', scriptsError);
      } else if (scriptsData) {
        loadedScripts = scriptsData.map((s: any) => ({
          id: s.id,
          originalArticle: s.original_article || '',
          outline: s.outline || '',
          result: s.result,
          timestamp: new Date(s.created_at).getTime(),
          wordCount: s.word_count || 0,
        }));
        setScripts(loadedScripts);
      }

      // Load SEO descriptions from Supabase
      const { data: seoData, error: seoError } = await (supabase as any)
        .from('user_seo_descriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (seoError) {
        console.error('Error loading SEO descriptions:', seoError);
      } else if (seoData) {
        loadedSeoDescriptions = seoData.map((s: any) => ({
          id: s.id,
          script: s.script,
          titles: s.titles || [],
          description: s.description,
          tags: s.tags,
          timestamp: new Date(s.created_at).getTime(),
        }));
        setSeoDescriptions(loadedSeoDescriptions);
      }

      // Cache the loaded data
      if (user) {
        setCache({
          scripts: loadedScripts,
          seoDescriptions: loadedSeoDescriptions,
          wordUsage: loadedWordUsage,
          userId: user.id,
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScriptGenerated = async (script: SavedScript) => {
    try {
      // Save to Supabase
      const { data, error } = await (supabase as any)
        .from('user_scripts')
        .insert({
          user_id: user?.id,
          original_article: script.originalArticle,
          outline: script.outline,
          result: script.result,
          word_count: script.wordCount,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving script:', error);
        toast({
          title: "Error",
          description: "Failed to save script to database",
          variant: "destructive",
        });
        return;
      }

      const savedScript = {
        id: data.id,
        originalArticle: data.original_article || '',
        outline: data.outline || '',
        result: data.result,
        timestamp: new Date(data.created_at).getTime(),
        wordCount: data.word_count || 0,
      };

      setScripts(prev => [savedScript, ...prev]);
      // Don't set currentScriptId here - let ScriptGenerator maintain its own state
      // The script will be available in history for later selection

      // Update word usage in backend
      if (script.wordCount) {
        const updatedUsage = await addWordUsage(script.wordCount);
        if (updatedUsage) {
          setWordUsage(updatedUsage.wordUsage);
        } else {
          // Fallback: update local state even if API fails
          setWordUsage(prev => prev + script.wordCount);
        }
      }
    } catch (error) {
      console.error('Error saving script:', error);
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      const scriptToDelete = scripts.find(s => s.id === id);
      const wordCountToRemove = scriptToDelete?.wordCount || 0;

      const { error } = await (supabase as any)
        .from('user_scripts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting script:', error);
        return;
      }

      setScripts(prev => prev.filter(s => s.id !== id));
      
      if (currentScriptId === id) {
        setCurrentScriptId(undefined);
      }

      // Update word usage
      if (wordCountToRemove > 0) {
        const updatedUsage = await subtractWordUsage(wordCountToRemove);
        if (updatedUsage) {
          setWordUsage(updatedUsage.wordUsage);
        }
      }

      toast({
        title: "Deleted",
        description: "Script removed from history.",
      });
    } catch (error) {
      console.error('Error deleting script:', error);
    }
  };

  const handleSeoGenerated = async (seo: SavedSeoDescription) => {
    try {
      // Save to Supabase
      const { data, error } = await (supabase as any)
        .from('user_seo_descriptions')
        .insert({
          user_id: user?.id,
          script: seo.script,
          titles: seo.titles,
          description: seo.description,
          tags: seo.tags,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving SEO description:', error);
        toast({
          title: "Error",
          description: "Failed to save SEO description to database",
          variant: "destructive",
        });
        return;
      }

      const savedSeo = {
        id: data.id,
        script: data.script,
        titles: data.titles || [],
        description: data.description,
        tags: data.tags,
        timestamp: new Date(data.created_at).getTime(),
      };

      setSeoDescriptions(prev => [savedSeo, ...prev]);
      setCurrentSeoId(data.id);
    } catch (error) {
      console.error('Error saving SEO description:', error);
    }
  };

  const handleDeleteSeo = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('user_seo_descriptions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting SEO description:', error);
        return;
      }

      setSeoDescriptions(prev => prev.filter(s => s.id !== id));
      
      if (currentSeoId === id) {
        setCurrentSeoId(undefined);
      }

      toast({
        title: "Deleted",
        description: "SEO description removed from history.",
      });
    } catch (error) {
      console.error('Error deleting SEO description:', error);
    }
  };

  const handleSelectScript = (script: SavedScript) => {
    setCurrentScriptId(script.id);
    setActiveTab("script");
  };

  const handleSelectSeo = (seo: SavedSeoDescription) => {
    setCurrentSeoId(seo.id);
    setActiveTab("seo");
  };

  const handleNewScript = () => {
    if (isLimitReached) {
      setShowLimitDialog(true);
      return;
    }
    setCurrentScriptId(undefined);
    setActiveTab("script");
  };

  const handleNewSeo = () => {
    setCurrentSeoId(undefined);
    setActiveTab("seo");
  };

  const handleBackToIdeation = () => {
    navigate('/');
  };

  const isLimitReached = wordUsage >= MAX_WORDS;

  const getScriptTitle = (script: SavedScript) => {
    const article = script.originalArticle || "";
    return article.substring(0, 40) + (article.length > 40 ? "..." : "");
  };

  const getSeoTitle = (item: SavedSeoDescription) => {
    if (item.titles?.length) return item.titles[0].substring(0, 40) + (item.titles[0].length > 40 ? "..." : "");
    return item.description.substring(0, 40) + (item.description.length > 40 ? "..." : "");
  };

  const getNextResetDate = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const currentScript = scripts.find(s => s.id === currentScriptId) || null;
  const currentSeo = seoDescriptions.find(s => s.id === currentSeoId) || null;

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#0f0f0f]">
          {/* History Sidebar */}
          <Sidebar className="border-r border-[#272727]">
            <SidebarHeader className="p-4 border-b border-[#272727]">
              <div className="w-10 h-10 bg-[#272727] rounded-lg animate-pulse mb-3" />
              <div className="w-full h-6 bg-[#272727] rounded-lg animate-pulse" />
            </SidebarHeader>
            <SidebarContent>
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-[#272727] rounded-lg animate-pulse" />
                ))}
              </div>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="flex-1">
            <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
              {/* Content skeleton */}
              <div className="flex-1 container mx-auto px-6 py-8">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#272727] rounded-full mx-auto animate-pulse" />
                    <div className="w-64 h-8 bg-[#272727] rounded mx-auto animate-pulse" />
                  </div>
                  <div className="space-y-4 mt-8">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-[#181818] border border-[#272727] rounded-xl p-6 animate-pulse">
                        <div className="w-32 h-5 bg-[#272727] rounded mb-4" />
                        <div className="h-24 bg-[#272727] rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#0f0f0f]">
          {/* Custom History Sidebar */}
          <Sidebar className="border-r border-[#272727]">
            <SidebarHeader className="p-4 border-b border-[#272727]">
              {/* Back button - icon only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToIdeation}
                className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] mb-3"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              {/* Tool Title */}
              <div className="flex items-center gap-2">
                {activeTab === "script" ? (
                  <>
                    <FileText className="w-5 h-5 text-[#cc0000]" />
                    <span className="text-lg font-semibold text-[#f1f1f1]">Script Generator</span>
                  </>
                ) : activeTab === "seo" ? (
                  <>
                    <Sparkles className="w-5 h-5 text-[#cc0000]" />
                    <span className="text-lg font-semibold text-[#f1f1f1]">SEO Generator</span>
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5 text-[#cc0000]" />
                    <span className="text-lg font-semibold text-[#f1f1f1]">Competitor Finder</span>
                  </>
                )}
              </div>
            </SidebarHeader>
            
            <SidebarContent>
              <SidebarGroup>
                {/* New button - Only show for script and seo tabs */}
                {activeTab !== "competitor" && (
                  <div className="p-4">
                    <Button
                      className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white"
                      onClick={activeTab === "script" ? handleNewScript : handleNewSeo}
                      disabled={activeTab === "script" && isLimitReached}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {activeTab === "script" ? "New Script" : "New SEO"}
                    </Button>
                  </div>
                )}

                {/* Competitor finder info */}
                {activeTab === "competitor" && (
                  <div className="px-4 py-4">
                    <div className="p-3 rounded-lg bg-[#181818] border border-[#272727]">
                      <p className="text-sm text-[#aaaaaa]">
                        Find similar YouTube channels based on content analysis.
                      </p>
                      <p className="text-xs text-[#666666] mt-2">
                        Enter a channel URL or @handle to discover competitors.
                      </p>
                    </div>
                  </div>
                )}

                {/* Word Limit Indicator - Only show for Script tab */}
                {activeTab === "script" && (
                  <div className="px-4 pb-4">
                    <div className="p-3 rounded-lg bg-[#181818] border border-[#272727]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-[#aaaaaa]">Monthly Limit</span>
                        <span className="text-xs text-[#666666]">
                          {wordUsage.toLocaleString()} / {MAX_WORDS.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-[#272727] rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            (wordUsage / MAX_WORDS) < 0.7
                              ? "bg-[#cc0000]"
                              : (wordUsage / MAX_WORDS) < 0.9
                              ? "bg-yellow-500"
                              : "bg-red-600"
                          )}
                          style={{ width: `${Math.min((wordUsage / MAX_WORDS) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#666666] mt-2">
                        {Math.round((wordUsage / MAX_WORDS) * 100)}% used
                      </p>
                    </div>
                  </div>
                )}

                <SidebarGroupLabel className="px-4 text-xs text-[#666666] uppercase tracking-wider">
                  History
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {activeTab === "script" ? (
                      scripts.length === 0 ? (
                        <div className="px-4 py-6 text-[#666666] text-sm">
                          <p>No scripts yet</p>
                          <p className="text-xs mt-2">Generate a script to see it here</p>
                        </div>
                      ) : (
                        scripts.map((script) => {
                          const isActive = currentScriptId === script.id;
                          const title = getScriptTitle(script);

                          return (
                            <SidebarMenuItem key={script.id}>
                              <div
                                className={cn(
                                  "group relative rounded-lg transition-colors hover:bg-[#181818] mx-2",
                                  isActive && "bg-[#cc0000]/10 border border-[#cc0000]/20"
                                )}
                              >
                                <SidebarMenuButton
                                  onClick={() => handleSelectScript(script)}
                                  className="w-full text-left px-3 py-2"
                                >
                                  <div className="flex items-center gap-2 text-sm text-[#aaaaaa]">
                                    <FileText className="h-4 w-4 text-[#666666] flex-shrink-0" />
                                    <span className="truncate flex-1">{title || "Untitled Script"}</span>
                                  </div>
                                </SidebarMenuButton>
                                <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-[#666666] hover:text-red-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteScript(script.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="px-3 text-xs text-[#666666] pb-2">
                                  {new Date(script.timestamp).toLocaleDateString()}
                                  {script.wordCount && ` • ${script.wordCount.toLocaleString()} words`}
                                </div>
                              </div>
                            </SidebarMenuItem>
                          );
                        })
                      )
                    ) : activeTab === "seo" ? (
                      seoDescriptions.length === 0 ? (
                        <div className="px-4 py-6 text-[#666666] text-sm">
                          <p>No SEO descriptions yet</p>
                          <p className="text-xs mt-2">Generate SEO content to see it here</p>
                        </div>
                      ) : (
                        seoDescriptions.map((item) => {
                          const isActive = currentSeoId === item.id;
                          const title = getSeoTitle(item);

                          return (
                            <SidebarMenuItem key={item.id}>
                              <div
                                className={cn(
                                  "group relative rounded-lg transition-colors hover:bg-[#181818] mx-2",
                                  isActive && "bg-[#cc0000]/10 border border-[#cc0000]/20"
                                )}
                              >
                                <SidebarMenuButton
                                  onClick={() => handleSelectSeo(item)}
                                  className="w-full text-left px-3 py-2"
                                >
                                  <div className="flex items-center gap-2 text-sm text-[#aaaaaa]">
                                    <Sparkles className="h-4 w-4 text-[#666666] flex-shrink-0" />
                                    <span className="truncate flex-1">{title}</span>
                                  </div>
                                </SidebarMenuButton>
                                <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-[#666666] hover:text-red-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSeo(item.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="px-3 text-xs text-[#666666] pb-2">
                                  {new Date(item.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                            </SidebarMenuItem>
                          );
                        })
                      )
                    ) : (
                      competitorHistory.length === 0 ? (
                        <div className="px-4 py-6 text-[#666666] text-sm">
                          <p>No competitor analyses yet</p>
                          <p className="text-xs mt-2">Analyze a channel to see history here</p>
                        </div>
                      ) : (
                        competitorHistory.map((item) => {
                          return (
                            <SidebarMenuItem key={item.id}>
                              <div
                                className="group relative rounded-lg transition-colors hover:bg-[#181818] mx-2"
                              >
                                <SidebarMenuButton
                                  onClick={() => setSelectedCompetitorItem(item)}
                                  className="w-full text-left px-3 py-2"
                                >
                                  <div className="flex items-center gap-2 text-sm text-[#aaaaaa]">
                                    <Target className="h-4 w-4 text-[#666666] flex-shrink-0" />
                                    <span className="truncate flex-1">{item.source_channel_name}</span>
                                  </div>
                                </SidebarMenuButton>
                                <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-[#666666] hover:text-red-500"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const success = await deleteCompetitorAnalysis(item.id);
                                      if (success) {
                                        setCompetitorHistory(prev => prev.filter(h => h.id !== item.id));
                                        toast({
                                          title: "Deleted",
                                          description: "Analysis removed from history",
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="px-3 text-xs text-[#666666] pb-2">
                                  {item.total_channels_found} competitors • {new Date(item.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </SidebarMenuItem>
                          );
                        })
                      )
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-[#272727] p-4">
              <p className="text-xs text-[#666666]">Video Stash AI Tools</p>
            </SidebarFooter>
          </Sidebar>

          {/* Main Content Area */}
          <SidebarInset className="flex-1">
            <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
              <div className="flex-1 overflow-auto min-h-0">
                <div className="container mx-auto px-6 py-8">
                  {activeTab === "script" ? (
                    <ScriptGenerator
                      onScriptGenerated={handleScriptGenerated}
                      currentScript={currentScript}
                      wordUsage={wordUsage}
                      maxWords={MAX_WORDS}
                      onUpdateUsage={setWordUsage}
                    />
                  ) : activeTab === "seo" ? (
                    <SeoGenerator
                      onSeoGenerated={handleSeoGenerated}
                      currentSeo={currentSeo}
                    />
                  ) : (
                    <CompetitorFinder 
                      onHistoryChange={setCompetitorHistory}
                      selectedHistoryItem={selectedCompetitorItem}
                      onClearSelectedHistory={() => setSelectedCompetitorItem(null)}
                    />
                  )}
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>

      {/* Limit Reached Dialog */}
      <AlertDialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <AlertDialogContent className="bg-[#0f0f0f] border-[#272727]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Monthly Limit Reached
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-[#aaaaaa]">
              <p>
                You have exhausted your <span className="font-semibold text-white">{MAX_WORDS.toLocaleString()} word limit</span> for this month.
              </p>
              <p>
                Your limit will automatically reset on <span className="font-semibold text-white">{getNextResetDate()}</span>.
              </p>
              <p className="text-xs text-[#666666] mt-4">
                Current usage: {wordUsage.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button 
              onClick={() => setShowLimitDialog(false)}
              className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
            >
              Okay
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Tools;
