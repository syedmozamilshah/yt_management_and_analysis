import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Sparkles, Tags, Wand2, FileText } from "lucide-react";
import { generateYoutubeSeo, SeoResult, buildSeoHistoryItem } from "@/services/seoService";
import { SavedSeoDescription } from "./ToolsHistorySidebar";
import { supabase } from "@/integrations/supabase/client";

interface SeoGeneratorProps {
  onSeoGenerated: (seo: SavedSeoDescription) => void;
  currentSeo: SavedSeoDescription | null;
}

const SeoGenerator = ({ onSeoGenerated, currentSeo }: SeoGeneratorProps) => {
  const { toast } = useToast();
  const [scriptText, setScriptText] = useState(currentSeo?.script || "");
  const [seoResult, setSeoResult] = useState<SeoResult | null>(
    currentSeo ? { titles: currentSeo.titles, description: currentSeo.description, tags: currentSeo.tags } : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Simulate initial loading for visual consistency
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Update state when currentSeo changes
  useEffect(() => {
    if (currentSeo) {
      setScriptText(currentSeo.script || "");
      setSeoResult({
        titles: currentSeo.titles,
        description: currentSeo.description,
        tags: currentSeo.tags,
      });
    } else {
      setScriptText("");
      setSeoResult(null);
    }
  }, [currentSeo]);

  const handleGenerateSeo = async () => {
    if (!scriptText.trim()) {
      toast({
        title: "Script required",
        description: "Paste your YouTube script to generate SEO assets.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get OpenAI API key from Supabase edge function secrets
      const { data: secretData, error: secretError } = await supabase.functions.invoke('get-api-keys', {
        method: 'POST',
        body: { key: 'OPENAI_API_KEY' }
      });

      if (secretError || !secretData?.apiKey) {
        // Fallback to using the edge function for SEO generation
        const { data, error: funcError } = await supabase.functions.invoke('generate-seo', {
          method: 'POST',
          body: { script: scriptText.trim() }
        });

        if (funcError) {
          throw new Error(funcError.message);
        }

        const seo = data as SeoResult;
        setSeoResult(seo);

        const historyItem = buildSeoHistoryItem(scriptText.trim(), seo);
        onSeoGenerated({
          id: historyItem.id,
          script: historyItem.script,
          titles: historyItem.titles,
          description: historyItem.description,
          tags: historyItem.tags,
          timestamp: historyItem.timestamp,
        });

        toast({
          title: "SEO copy ready",
          description: "5 titles, description, and tags generated.",
        });
        return;
      }

      const seo = await generateYoutubeSeo(scriptText.trim(), secretData.apiKey);
      setSeoResult(seo);

      const historyItem = buildSeoHistoryItem(scriptText.trim(), seo);
      onSeoGenerated({
        id: historyItem.id,
        script: historyItem.script,
        titles: historyItem.titles,
        description: historyItem.description,
        tags: historyItem.tags,
        timestamp: historyItem.timestamp,
      });

      toast({
        title: "SEO copy ready",
        description: "5 titles, description, and tags generated.",
      });
    } catch (err) {
      console.error("SEO generation error", err);
      setError("Something went wrong while generating SEO copy. Please try again.");
      toast({
        title: "Generation failed",
        description: "Request did not complete. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Text copied to clipboard",
      });
    } catch (err) {
      console.error("Failed to copy:", err);
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleNewDescription = () => {
    setScriptText("");
    setSeoResult(null);
    setError("");
  };

  const renderTitles = (titles: string[]) => {
    if (!titles?.length) return null;
    return (
      <div className="grid gap-2">
        {titles.map((title, index) => (
          <Card key={index} className="border-[#272727] bg-[#181818] hover:border-[#cc0000]/50 hover:bg-[#cc0000]/5 transition-all">
            <CardContent className="flex items-center justify-between py-3 px-4 gap-3">
              <div className="flex items-center gap-3 text-sm flex-1">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#cc0000]/10 text-xs font-semibold text-[#cc0000]">
                  {index + 1}
                </span>
                <span className="font-medium leading-tight text-white">{title}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(title)}
                className="gap-2 text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const tagsList = seoResult?.tags
    ? seoResult.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];

  // Loading skeleton
  if (isInitialLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        {/* Header skeleton */}
        <header className="mb-6 sm:mb-8">
          <div className="w-56 h-8 bg-[#272727] rounded animate-pulse mb-2" />
          <div className="w-96 h-4 bg-[#272727] rounded animate-pulse" />
        </header>

        {/* Input Card skeleton */}
        <div className="bg-[#0f0f0f] border border-[#272727] rounded-xl p-6 mb-6 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-[#272727] rounded" />
            <div className="w-36 h-6 bg-[#272727] rounded" />
          </div>
          <div className="w-72 h-4 bg-[#272727] rounded mb-4" />
          <div className="h-32 bg-[#272727] rounded-lg mb-4" />
          <div className="w-32 h-10 bg-[#272727] rounded-lg" />
        </div>

        {/* Results skeleton */}
        <div className="space-y-4">
          <div className="bg-[#0f0f0f] border border-[#272727] rounded-xl p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-[#272727] rounded" />
              <div className="w-40 h-6 bg-[#272727] rounded" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-[#272727] rounded-lg" />
              ))}
            </div>
          </div>
          <div className="bg-[#0f0f0f] border border-[#272727] rounded-xl p-6 animate-pulse">
            <div className="w-32 h-6 bg-[#272727] rounded mb-4" />
            <div className="h-24 bg-[#272727] rounded-lg" />
          </div>
          <div className="bg-[#0f0f0f] border border-[#272727] rounded-xl p-6 animate-pulse">
            <div className="w-20 h-6 bg-[#272727] rounded mb-4" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-20 h-6 bg-[#272727] rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <header className="mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">YouTube SEO Generator</h1>
          <p className="text-sm sm:text-base text-[#aaaaaa]">
            Paste your script and get 5 titles, one optimized description, and comma-separated tags.
          </p>
        </div>
      </header>

      <Card className="mb-6 bg-[#0f0f0f] border-[#272727]">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-white text-lg sm:text-xl">
            <Wand2 className="h-5 w-5" />
            Paste your script
          </CardTitle>
          <p className="text-xs sm:text-sm text-[#aaaaaa]">
            Craft optimized titles, description, and tags tailored for YouTube.
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="Paste the full YouTube script you want to optimize..."
            className="min-h-[240px] resize-y text-base bg-[#181818] border-[#272727] text-white placeholder:text-[#666666]"
            disabled={isLoading}
          />
          <Button
            onClick={handleGenerateSeo}
            disabled={isLoading}
            className="w-full mt-4 h-12 text-base font-semibold bg-[#cc0000] hover:bg-[#cc0000]/90 text-white"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating content...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate SEO
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-red-500 bg-red-500/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-red-500 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {seoResult && !isLoading && (
        <Card className="bg-[#0f0f0f] border-[#272727]">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5" />
              SEO Output
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCopy(JSON.stringify(seoResult, null, 2))} 
                className="gap-2 border-[#272727] text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copy All</span>
                <span className="sm:hidden">Copy</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNewDescription}
                className="border-[#272727] text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
              >
                New Description
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-4 sm:px-6">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="h-4 w-4 text-[#aaaaaa]" />
                <h3 className="text-lg font-semibold text-white">Titles</h3>
              </div>
              {renderTitles(seoResult.titles)}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-[#aaaaaa]" />
                <h3 className="text-lg font-semibold text-white">Description</h3>
              </div>
              <div className="relative group">
                <Textarea
                  value={seoResult.description}
                  readOnly
                  className="min-h-[180px] text-sm bg-[#181818] border-[#272727] text-[#aaaaaa] focus:bg-[#1a1a1a]"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1 bg-[#272727] text-white hover:bg-[#333333]"
                    onClick={() => handleCopy(seoResult.description)}
                    title="Copy description text"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Tags className="h-4 w-4 text-[#aaaaaa]" />
                <h3 className="text-lg font-semibold text-white">Tags</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-[#181818] rounded-lg border border-[#272727]">
                {tagsList.length ? (
                  tagsList.map((tag, idx) => (
                    <Badge
                      key={`${tag}-${idx}`}
                      variant="secondary"
                      className="text-xs cursor-pointer bg-[#272727] text-[#aaaaaa] hover:bg-[#cc0000] hover:text-white transition-colors"
                      onClick={() => handleCopy(tag)}
                      title="Click to copy this tag"
                    >
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-[#666666]">No tags returned</p>
                )}
              </div>
              <div className="relative group">
                <Textarea
                  value={seoResult.tags}
                  readOnly
                  className="min-h-[80px] text-sm bg-[#181818] border-[#272727] text-[#aaaaaa] focus:bg-[#1a1a1a]"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1 bg-[#272727] text-white hover:bg-[#333333]"
                    onClick={() => handleCopy(seoResult.tags)}
                    title="Copy all tags as comma-separated list"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card className="border-[#cc0000]/20 bg-[#cc0000]/5">
          <CardContent className="py-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#cc0000]" />
            <p className="text-sm text-[#aaaaaa]">Generating SEO suggestions…</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SeoGenerator;
