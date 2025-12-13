import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getWordUsage, addWordUsage, subtractWordUsage } from '@/lib/toolUsageApi';
import ToolsHistorySidebar, { SavedScript, SavedSeoDescription } from '@/components/tools/ToolsHistorySidebar';
import ScriptGenerator from '@/components/tools/ScriptGenerator';
import SeoGenerator from '@/components/tools/SeoGenerator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const MAX_WORDS = 40000;

const Tools = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"script" | "seo">("script");
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [seoDescriptions, setSeoDescriptions] = useState<SavedSeoDescription[]>([]);
  const [currentScriptId, setCurrentScriptId] = useState<string>();
  const [currentSeoId, setCurrentSeoId] = useState<string>();
  const [wordUsage, setWordUsage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load word usage
      const usageData = await getWordUsage();
      if (usageData) {
        setWordUsage(usageData.wordUsage);
      }

      // Load scripts from Supabase
      const { data: scriptsData, error: scriptsError } = await (supabase as any)
        .from('user_scripts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (scriptsError) {
        console.error('Error loading scripts:', scriptsError);
      } else if (scriptsData) {
        setScripts(scriptsData.map((s: any) => ({
          id: s.id,
          originalArticle: s.original_article || '',
          outline: s.outline || '',
          result: s.result,
          timestamp: new Date(s.created_at).getTime(),
          wordCount: s.word_count || 0,
        })));
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
        setSeoDescriptions(seoData.map((s: any) => ({
          id: s.id,
          script: s.script,
          titles: s.titles || [],
          description: s.description,
          tags: s.tags,
          timestamp: new Date(s.created_at).getTime(),
        })));
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
    setCurrentScriptId(undefined);
    setActiveTab("script");
  };

  const handleNewSeo = () => {
    setCurrentSeoId(undefined);
    setActiveTab("seo");
  };

  const currentScript = scripts.find(s => s.id === currentScriptId) || null;
  const currentSeo = seoDescriptions.find(s => s.id === currentSeoId) || null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#aaaaaa]">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0f0f0f]">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            {/* Header with navigation */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#181818]/95 border-b border-[#272727]">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center gap-2 sm:gap-4">
                  <SidebarTrigger className="text-[#f1f1f1] hover:bg-[#272727] rounded-lg p-2 transition-all" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] gap-1 sm:gap-2 px-2 sm:px-3"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back</span>
                  </Button>
                  <div className="h-6 w-px bg-[#272727] hidden sm:block" />
                  <h1 className="text-lg sm:text-xl font-semibold text-white">
                    AI Tools
                  </h1>
                </div>
                
                {/* Tools sidebar toggle - visible on all screens */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                  className="text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
                >
                  {showMobileSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </div>
            </header>

            {/* Main content area */}
            <div className="flex-1 flex relative">
              {/* Sidebar overlay */}
              {showMobileSidebar && (
                <div 
                  className="fixed inset-0 bg-black/50 z-40"
                  onClick={() => setShowMobileSidebar(false)}
                />
              )}
              
              {/* Tools History Sidebar - slides in from left on all screens */}
              <div className={`
                fixed inset-y-0 left-0 z-50
                transform transition-transform duration-300 ease-in-out
                ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
                w-72 sm:w-80 flex-shrink-0
              `}>
                <ToolsHistorySidebar
                  scripts={scripts}
                  seoDescriptions={seoDescriptions}
                  onSelectScript={(script) => {
                    handleSelectScript(script);
                    setShowMobileSidebar(false);
                  }}
                  onDeleteScript={handleDeleteScript}
                  onSelectSeo={(seo) => {
                    handleSelectSeo(seo);
                    setShowMobileSidebar(false);
                  }}
                  onDeleteSeo={handleDeleteSeo}
                  onNewScript={() => {
                    handleNewScript();
                    setShowMobileSidebar(false);
                  }}
                  onNewSeo={() => {
                    handleNewSeo();
                    setShowMobileSidebar(false);
                  }}
                  wordUsage={wordUsage}
                  maxWords={MAX_WORDS}
                  currentScriptId={currentScriptId}
                  currentSeoId={currentSeoId}
                  activeTab={activeTab}
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setShowMobileSidebar(false);
                  }}
                />
              </div>

              {/* Main Generator Area */}
              <div className="flex-1 overflow-auto min-h-0">
                <div className="p-4 sm:p-6 lg:p-8">
                  {activeTab === "script" ? (
                    <ScriptGenerator
                      onScriptGenerated={handleScriptGenerated}
                      currentScript={currentScript}
                      wordUsage={wordUsage}
                      maxWords={MAX_WORDS}
                      onUpdateUsage={setWordUsage}
                    />
                  ) : (
                    <SeoGenerator
                      onSeoGenerated={handleSeoGenerated}
                      currentSeo={currentSeo}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Tools;
