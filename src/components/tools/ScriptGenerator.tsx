import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Sparkles, Search, FileText, AlertCircle } from "lucide-react";
import { SavedScript } from "./ToolsHistorySidebar";

interface ScriptGeneratorProps {
  onScriptGenerated: (script: SavedScript) => void;
  currentScript: SavedScript | null;
  wordUsage: number;
  maxWords: number;
  onUpdateUsage: (newUsage: number) => void;
}

const ANALYZE_WEBHOOK_URL = "https://n8n-14pv.onrender.com/webhook/6cd46bb2-4ab9-44a1-a055-68be14b77b08";
const GENERATE_WEBHOOK_URL = "https://n8n-14pv.onrender.com/webhook/31cc881b-c4ab-4335-b7a8-5f9fb2cd73ce";

const analyzeLoadingStages = [
  "Sending to Perplexity…",
  "Searching the web…",
  "Gathering facts…",
  "Compiling research…",
  "Building outline…",
  "Almost there…",
  "Finalizing research…",
  "Still searching…"
];

const generateLoadingStages = [
  "Sending to Claude…",
  "Writing Part 1…",
  "Crafting the narrative…",
  "Writing Part 2…",
  "Polishing the script…",
  "Almost there…",
  "Finalizing script…",
  "Still writing…"
];

type WorkflowStep = "input" | "outline" | "result";

const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

const ScriptGenerator = ({
  onScriptGenerated,
  currentScript,
  wordUsage,
  maxWords,
  onUpdateUsage,
}: ScriptGeneratorProps) => {
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(
    currentScript?.result ? "result" : currentScript?.outline ? "outline" : "input"
  );
  const [originalArticle, setOriginalArticle] = useState(currentScript?.originalArticle || "");
  const [outline, setOutline] = useState(currentScript?.outline || "");
  const [result, setResult] = useState(currentScript?.result || "");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [currentLoadingStages, setCurrentLoadingStages] = useState<string[]>(analyzeLoadingStages);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Update state when currentScript changes (e.g., selecting from history)
  // Don't reset if we're in the middle of a generation (result is set but currentScript is null)
  useEffect(() => {
    if (currentScript) {
      // Loading a script from history
      setOriginalArticle(currentScript.originalArticle || "");
      setOutline(currentScript.outline || "");
      setResult(currentScript.result || "");
      setWorkflowStep(currentScript.result ? "result" : currentScript.outline ? "outline" : "input");
    } else if (!result) {
      // Only reset if we don't have a generated result (new script flow)
      setOriginalArticle("");
      setOutline("");
      setResult("");
      setWorkflowStep("input");
    }
    // If currentScript is null but result exists, keep current state (just generated)
  }, [currentScript]);

  const handleAnalyze = async () => {
    if (!originalArticle.trim()) {
      toast({
        title: "Error",
        description: "Please enter an article or transcript to analyze.",
        variant: "destructive",
      });
      return;
    }

    if (wordUsage >= maxWords) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);

      toast({
        title: "Monthly Limit Reached",
        description: `You have exhausted your ${maxWords.toLocaleString()} word limit for this month. Your limit will reset on ${nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        variant: "destructive",
        duration: 6000,
      });
      return;
    }

    setIsLoading(true);
    setLoadingStage(0);
    setCurrentLoadingStages(analyzeLoadingStages);
    setError("");
    setOutline("");

    const interval = setInterval(() => {
      setLoadingStage((prev) => {
        if (prev >= analyzeLoadingStages.length - 1) {
          return analyzeLoadingStages.length - 2;
        }
        return prev + 1;
      });
    }, 20000);

    try {
      const response = await fetch(ANALYZE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cleanedTranscript: originalArticle }),
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      let outlineResult: string;

      try {
        const jsonData = JSON.parse(responseText);
        outlineResult = typeof jsonData === 'string'
          ? jsonData
          : (jsonData.choices?.[0]?.message?.content || jsonData.output || jsonData.merged || JSON.stringify(jsonData, null, 2));
      } catch {
        outlineResult = responseText;
      }

      setOutline(outlineResult);
      setWorkflowStep("outline");

      toast({
        title: "Analysis Complete!",
        description: "Research outline generated. You can edit it before generating the script.",
      });
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Something went wrong during analysis. Please try again.");
      toast({
        title: "Error",
        description: "Failed to analyze content.",
        variant: "destructive",
      });
    } finally {
      clearInterval(interval);
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!outline.trim()) {
      toast({
        title: "Error",
        description: "Please provide an outline to generate the script.",
        variant: "destructive",
      });
      return;
    }

    if (wordUsage >= maxWords) {
      toast({
        title: "Word Limit Reached",
        description: `You have reached your ${maxWords.toLocaleString()} word limit.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setLoadingStage(0);
    setCurrentLoadingStages(generateLoadingStages);
    setError("");
    setResult("");

    const interval = setInterval(() => {
      setLoadingStage((prev) => {
        if (prev >= generateLoadingStages.length - 1) {
          return generateLoadingStages.length - 2;
        }
        return prev + 1;
      });
    }, 20000);

    try {
      const response = await fetch(GENERATE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: outline }),
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      let scriptResult: string;

      try {
        const jsonData = JSON.parse(responseText);
        scriptResult = typeof jsonData === 'string'
          ? jsonData
          : (jsonData.merged || jsonData.output || JSON.stringify(jsonData, null, 2));
      } catch {
        scriptResult = responseText;
      }

      const wordCount = countWords(scriptResult);
      const newWordUsage = wordUsage + wordCount;

      if (newWordUsage > maxWords) {
        setError(`This script has ${wordCount.toLocaleString()} words, but you only have ${(maxWords - wordUsage).toLocaleString()} words remaining. The script has been generated but not saved.`);
        setResult(scriptResult);
        setWorkflowStep("result");
        toast({
          title: "Word Limit Exceeded",
          description: `Script exceeds limit. Generated: ${wordCount.toLocaleString()} words, Remaining: ${(maxWords - wordUsage).toLocaleString()} words`,
          variant: "destructive",
        });
        return;
      }

      setResult(scriptResult);
      setWorkflowStep("result");
      onUpdateUsage(newWordUsage);

      const newScript: SavedScript = {
        id: Date.now().toString(),
        originalArticle,
        outline,
        result: scriptResult,
        timestamp: Date.now(),
        wordCount,
      };

      onScriptGenerated(newScript);

      toast({
        title: "Success!",
        description: `YouTube script generated successfully. Used ${wordCount.toLocaleString()} words.`,
      });
    } catch (err) {
      console.error("Generation error:", err);
      setError("Something went wrong during script generation. Please try again.");
      toast({
        title: "Error",
        description: "Failed to generate script.",
        variant: "destructive",
      });
    } finally {
      clearInterval(interval);
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    if (wordUsage >= maxWords) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);

      toast({
        title: "Monthly Limit Reached",
        description: `You have exhausted your ${maxWords.toLocaleString()} word limit for this month. Your limit will reset on ${nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        variant: "destructive",
        duration: 6000,
      });
      return;
    }

    setWorkflowStep("input");
    setOriginalArticle("");
    setOutline("");
    setResult("");
    setError("");
  };

  const handleBackToOutline = () => {
    setWorkflowStep("outline");
    setResult("");
    setError("");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Content copied to clipboard.",
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">Generate Script</h1>
            <p className="text-sm sm:text-base text-[#aaaaaa]">
              {workflowStep === "input" && "Step 1: Paste your article and analyze it"}
              {workflowStep === "outline" && "Step 2: Review and edit the research outline"}
              {workflowStep === "result" && "Step 3: Your generated YouTube script"}
            </p>
          </div>
        </div>

        {/* Progress Steps - Responsive */}
        <div className="flex items-center gap-1 sm:gap-2 mt-4 sm:mt-6 overflow-x-auto pb-2">
          <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap ${
            workflowStep === "input" ? "bg-[#cc0000] text-white" : "bg-[#272727] text-[#aaaaaa]"
          }`}>
            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
            <span className="hidden sm:inline">Article</span>
          </div>
          <div className="h-px w-4 sm:w-8 bg-[#272727] flex-shrink-0" />
          <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap ${
            workflowStep === "outline" ? "bg-[#cc0000] text-white" : "bg-[#272727] text-[#aaaaaa]"
          }`}>
            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
            <span className="hidden sm:inline">Outline</span>
          </div>
          <div className="h-px w-4 sm:w-8 bg-[#272727] flex-shrink-0" />
          <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap ${
            workflowStep === "result" ? "bg-[#cc0000] text-white" : "bg-[#272727] text-[#aaaaaa]"
          }`}>
            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
            <span className="hidden sm:inline">Script</span>
          </div>
        </div>
      </header>

      {/* Step 1: Input Article */}
      {workflowStep === "input" && (
        <Card className="mb-6 sm:mb-8 bg-[#0f0f0f] border-[#272727]">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <label htmlFor="article" className="block text-sm font-medium mb-2 text-[#aaaaaa]">
              Paste your article or transcript here
            </label>
            <Textarea
              id="article"
              value={originalArticle}
              onChange={(e) => setOriginalArticle(e.target.value)}
              placeholder="Enter your article, news story, or transcript here. We'll analyze it and create a detailed research outline..."
              className="min-h-[200px] sm:min-h-[300px] resize-y text-sm sm:text-base bg-[#181818] border-[#272727] text-white placeholder:text-[#666666]"
              disabled={isLoading}
            />
            <Button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="w-full mt-4 h-11 sm:h-12 text-sm sm:text-base font-semibold bg-[#cc0000] hover:bg-[#cc0000]/90 text-white"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span className="truncate">{currentLoadingStages[loadingStage]}</span>
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Analyze & Research
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Outline (Editable) */}
      {workflowStep === "outline" && (
        <Card className="mb-6 sm:mb-8 bg-[#0f0f0f] border-[#272727]">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-white">
                <FileText className="h-5 w-5" />
                Research Outline
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartOver}
                className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] w-fit"
              >
                Start Over
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-[#aaaaaa]">
              Review and edit this outline before generating your script. Add or remove details as needed.
            </p>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              className="min-h-[300px] sm:min-h-[400px] resize-y text-sm sm:text-base font-mono bg-[#181818] border-[#272727] text-white"
              disabled={isLoading}
            />
            <Button
              onClick={handleGenerate}
              disabled={isLoading || wordUsage >= maxWords}
              className="w-full mt-4 h-11 sm:h-12 text-sm sm:text-base font-semibold bg-[#cc0000] hover:bg-[#cc0000]/90 text-white disabled:opacity-50"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span className="truncate">{currentLoadingStages[loadingStage]}</span>
                </>
              ) : wordUsage >= maxWords ? (
                <>
                  <AlertCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Word Limit Reached
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Generate Script
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Result */}
      {workflowStep === "result" && !isLoading && (
        <Card className="mb-6 sm:mb-8 bg-[#0f0f0f] border-[#272727]">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl text-white">Generated YouTube Script</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToOutline}
                className="border-[#272727] text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
              >
                <span className="hidden sm:inline">Edit Outline</span>
                <span className="sm:hidden">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(result)}
                className="gap-2 border-[#272727] text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copy Script</span>
                <span className="sm:hidden">Copy</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartOver}
                className="border-[#272727] text-[#aaaaaa] hover:text-white hover:bg-[#272727]"
              >
                New Script
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {error && (
              <Card className="mb-4 border-yellow-500 bg-yellow-500/10">
                <CardContent className="pt-4">
                  <p className="text-yellow-400 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto bg-[#181818] rounded-lg p-4 sm:p-6">
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed text-[#aaaaaa]">
                {result}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Stages Indicator */}
      {isLoading && (
        <Card className="mb-6 sm:mb-8 border-[#cc0000]/20 bg-[#cc0000]/5">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-1 sm:gap-4">
              {currentLoadingStages.slice(0, 5).map((_, index) => (
                <div key={index} className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-1.5 sm:h-2 rounded-full flex-1 transition-all duration-500 ${
                      index <= loadingStage
                        ? "bg-[#cc0000]"
                        : "bg-[#272727]"
                    }`}
                  />
                </div>
              ))}
            </div>
            <p className="text-center mt-3 sm:mt-4 text-xs sm:text-sm text-[#aaaaaa]">
              {currentLoadingStages[loadingStage]}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && !result && (
        <Card className="mb-6 sm:mb-8 border-red-500 bg-red-500/10">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <p className="text-red-500 text-center text-sm sm:text-base font-medium">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScriptGenerator;
