import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronRight, AlertCircle, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface SavedScript {
  id: string;
  originalArticle: string;
  outline: string;
  result: string;
  timestamp: number;
  wordCount?: number;
}

export interface SavedSeoDescription {
  id: string;
  script: string;
  titles: string[];
  description: string;
  tags: string;
  timestamp: number;
}

interface ToolsHistorySidebarProps {
  scripts: SavedScript[];
  seoDescriptions: SavedSeoDescription[];
  onSelectScript: (script: SavedScript) => void;
  onDeleteScript: (id: string) => void;
  onSelectSeo: (item: SavedSeoDescription) => void;
  onDeleteSeo: (id: string) => void;
  onNewScript: () => void;
  onNewSeo: () => void;
  wordUsage: number;
  maxWords: number;
  currentScriptId?: string;
  currentSeoId?: string;
  activeTab: "script" | "seo";
  setActiveTab: (tab: "script" | "seo") => void;
}

const ToolsHistorySidebar = ({
  scripts,
  seoDescriptions,
  onSelectScript,
  onDeleteScript,
  onSelectSeo,
  onDeleteSeo,
  onNewScript,
  onNewSeo,
  wordUsage,
  maxWords,
  currentScriptId,
  currentSeoId,
  activeTab,
  setActiveTab,
}: ToolsHistorySidebarProps) => {
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const isLimitReached = wordUsage >= maxWords;

  const getScriptTitle = (script: SavedScript) => {
    const article = script.originalArticle || "";
    return article.substring(0, 40) + (article.length > 40 ? "..." : "");
  };

  const getSeoTitle = (item: SavedSeoDescription) => {
    if (item.titles?.length) return item.titles[0].substring(0, 40) + (item.titles[0].length > 40 ? "..." : "");
    return item.description.substring(0, 40) + (item.description.length > 40 ? "..." : "");
  };

  const handleNewScriptClick = () => {
    if (isLimitReached) {
      setShowLimitDialog(true);
    } else {
      onNewScript();
    }
  };

  const getNextResetDate = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="h-full w-full bg-[#0f0f0f] border-r border-[#272727] flex flex-col overflow-hidden">
        {/* Header with New Button */}
        <div className="p-4 border-b border-[#272727]">
          <Button
            className="w-full bg-[#cc0000] hover:bg-[#cc0000]/90 text-white"
            onClick={activeTab === "script" ? handleNewScriptClick : onNewSeo}
            disabled={activeTab === "script" && isLimitReached}
          >
            {activeTab === "script" ? "New Script" : "New SEO"}
          </Button>
        </div>

        {/* Word Limit Indicator - Only show for Script tab */}
        {activeTab === "script" && (
          <div className="p-4 border-b border-[#272727]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#aaaaaa]">Monthly Limit</span>
              <span className="text-xs text-[#666666]">
                {wordUsage.toLocaleString()} / {maxWords.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-[#272727] rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  (wordUsage / maxWords) < 0.7
                    ? "bg-[#cc0000]"
                    : (wordUsage / maxWords) < 0.9
                    ? "bg-yellow-500"
                    : "bg-red-600"
                )}
                style={{ width: `${Math.min((wordUsage / maxWords) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-[#666666] mt-2">
              {Math.round((wordUsage / maxWords) * 100)}% used
              {isLimitReached && (
                <span className="block text-red-500 font-medium mt-1">
                  Limit reached • Resets {getNextResetDate()}
                </span>
              )}
            </p>
          </div>
        )}

        {/* History List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "script" ? (
            scripts.length === 0 ? (
              <div className="px-4 py-6 text-[#666666] text-sm">
                <p>No scripts yet</p>
                <p className="text-xs mt-2">Generate a script to see it here</p>
              </div>
            ) : (
              <nav className="space-y-1 p-2">
                {scripts.map((script) => {
                  const isActive = currentScriptId === script.id;
                  const title = getScriptTitle(script);

                  return (
                    <div
                      key={script.id}
                      className={cn(
                        "group relative rounded-lg transition-colors hover:bg-[#181818]",
                        isActive && "bg-[#cc0000]/10 border border-[#cc0000]/20"
                      )}
                    >
                      <button
                        onClick={() => onSelectScript(script)}
                        className="w-full text-left px-3 py-2 text-sm truncate flex items-center gap-2 text-[#aaaaaa]"
                      >
                        <FileText className="h-4 w-4 text-[#666666] flex-shrink-0" />
                        <span className="truncate flex-1">{title || "Untitled Script"}</span>
                        <ChevronRight className="h-3 w-3 text-[#666666] flex-shrink-0" />
                      </button>
                      <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[#666666] hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteScript(script.id);
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
                  );
                })}
              </nav>
            )
          ) : (
            seoDescriptions.length === 0 ? (
              <div className="px-4 py-6 text-[#666666] text-sm">
                <p>No SEO descriptions yet</p>
                <p className="text-xs mt-2">Generate SEO content to see it here</p>
              </div>
            ) : (
              <nav className="space-y-1 p-2">
                {seoDescriptions.map((item) => {
                  const isActive = currentSeoId === item.id;
                  const title = getSeoTitle(item);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "group relative rounded-lg transition-colors hover:bg-[#181818]",
                        isActive && "bg-[#cc0000]/10 border border-[#cc0000]/20"
                      )}
                    >
                      <button
                        onClick={() => onSelectSeo(item)}
                        className="w-full text-left px-3 py-2 text-sm truncate flex items-center gap-2 text-[#aaaaaa]"
                      >
                        <Sparkles className="h-4 w-4 text-[#666666] flex-shrink-0" />
                        <span className="truncate flex-1">{title}</span>
                        <ChevronRight className="h-3 w-3 text-[#666666] flex-shrink-0" />
                      </button>
                      <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[#666666] hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSeo(item.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="px-3 text-xs text-[#666666] pb-2">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </nav>
            )
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#272727] p-4 text-xs text-[#666666]">
          <p>Blowmeai Tools v1.0</p>
        </div>
      </aside>

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
                You have exhausted your <span className="font-semibold text-white">{maxWords.toLocaleString()} word limit</span> for this month.
              </p>
              <p>
                Your limit will automatically reset on <span className="font-semibold text-white">{getNextResetDate()}</span>.
              </p>
              <p className="text-xs text-[#666666] mt-4">
                Current usage: {wordUsage.toLocaleString()} / {maxWords.toLocaleString()} words
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button 
              onClick={() => setShowLimitDialog(false)}
              className="bg-[#cc0000] hover:bg-[#cc0000]/90 text-white"
            >
              Okay
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ToolsHistorySidebar;
