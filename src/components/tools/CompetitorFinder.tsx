import { useState, useCallback, useEffect } from "react";
import { ChannelInput } from "./competitor/ChannelInput";
import { AnalysisProgress, AnalysisStep } from "./competitor/AnalysisProgress";
import { ResultsDisplay } from "./competitor/ResultsDisplay";
import { SimilarChannel } from "./competitor/SimilarChannelCard";
import { useToast } from "@/hooks/use-toast";
import { analyzeChannel, isValidChannelInput } from "@/services/channelAnalyzer";
import { ChannelInfo } from "@/types/youtube";
import { 
  saveCompetitorAnalysis, 
  getCompetitorAnalysisHistory, 
  deleteCompetitorAnalysis,
  CompetitorAnalysis 
} from "@/services/competitorHistoryService";

type AppState = "input" | "analyzing" | "results" | "error";

const INITIAL_STEPS: AnalysisStep[] = [
  { id: "extract", label: "Initializing", status: "pending" },
  { id: "fetch", label: "Gathering data", status: "pending" },
  { id: "search", label: "Deep analysis", status: "pending" },
  { id: "analyze", label: "Processing", status: "pending" },
  { id: "results", label: "Finalizing", status: "pending" },
];

const DEFAULT_SOURCE_CHANNEL: ChannelInfo = {
  id: "",
  name: "Loading...",
  handle: "",
  thumbnail: "",
};

interface CompetitorFinderProps {
  onHistoryChange?: (history: CompetitorAnalysis[]) => void;
  selectedHistoryItem?: CompetitorAnalysis | null;
  onClearSelectedHistory?: () => void;
}

export default function CompetitorFinder({ 
  onHistoryChange, 
  selectedHistoryItem,
  onClearSelectedHistory 
}: CompetitorFinderProps) {
  const [appState, setAppState] = useState<AppState>("input");
  const [steps, setSteps] = useState<AnalysisStep[]>(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [sourceChannel, setSourceChannel] = useState<ChannelInfo>(DEFAULT_SOURCE_CHANNEL);
  const [similarChannels, setSimilarChannels] = useState<SimilarChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { toast } = useToast();

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Handle selected history item from sidebar
  useEffect(() => {
    if (selectedHistoryItem) {
      setSourceChannel({
        id: selectedHistoryItem.source_channel_id,
        name: selectedHistoryItem.source_channel_name,
        handle: selectedHistoryItem.source_channel_handle || "",
        thumbnail: selectedHistoryItem.source_channel_thumbnail || "",
      });
      setSimilarChannels(selectedHistoryItem.similar_channels);
      setAppState("results");
      onClearSelectedHistory?.();
    }
  }, [selectedHistoryItem, onClearSelectedHistory]);

  const loadHistory = async () => {
    const data = await getCompetitorAnalysisHistory(10);
    onHistoryChange?.(data);
  };

  const updateStepStatus = useCallback(
    (stepId: string, status: AnalysisStep["status"]) => {
      setSteps((prev) => {
        const stepIndex = prev.findIndex((s) => s.id === stepId);
        if (stepIndex === -1) return prev;

        return prev.map((step, idx) => {
          if (step.id === stepId) {
            return { ...step, status };
          }
          // Mark previous steps as completed if current is active
          if (status === "active" && idx < stepIndex) {
            return { ...step, status: "completed" };
          }
          return step;
        });
      });

      const stepIndex = INITIAL_STEPS.findIndex((s) => s.id === stepId);
      if (stepIndex !== -1) {
        setCurrentStep(stepIndex);
      }
    },
    []
  );

  const handleProgress = useCallback(
    (step: string, progress: number, message: string) => {
      // Update step status based on progress
      if (progress === 0) {
        updateStepStatus(step, "active");
      } else if (progress >= 100) {
        updateStepStatus(step, "completed");
      }
    },
    [updateStepStatus]
  );

  const handleAnalyze = async (url: string) => {
    if (!isValidChannelInput(url)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid YouTube channel URL or @handle",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAppState("analyzing");
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));
    setCurrentStep(0);
    setErrorMessage("");

    toast({
      title: "Analysis Started",
      description: `Analyzing channel: ${url}`,
    });

    try {
      const result = await analyzeChannel(url, handleProgress);

      // Transform the result to match the expected format
      setSourceChannel(result.sourceChannel);
      setSimilarChannels(
        result.similarChannels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          handle: ch.handle,
          thumbnail: ch.thumbnail,
          subscribers: ch.subscribers,
          similarityScore: ch.similarityScore,
          matchedVideos: ch.matchedVideos,
        }))
      );

      // Mark all steps as completed
      setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" })));

      // Save to history
      const transformedChannels = result.similarChannels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        handle: ch.handle,
        thumbnail: ch.thumbnail,
        subscribers: ch.subscribers,
        similarityScore: ch.similarityScore,
        matchedVideos: ch.matchedVideos,
      }));
      
      await saveCompetitorAnalysis(
        {
          id: result.sourceChannel.id,
          name: result.sourceChannel.name,
          handle: result.sourceChannel.handle,
          thumbnail: result.sourceChannel.thumbnail || "",
        },
        transformedChannels
      );
      
      // Reload history
      loadHistory();

      setAppState("results");

      toast({
        title: "Analysis Complete",
        description: `Found ${result.similarChannels.length} similar channels`,
      });
    } catch (error) {
      console.error("Analysis failed:", error);

      const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred";
      setErrorMessage(errorMsg);

      // Mark current step as error
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === currentStep ? { ...step, status: "error" } : step
        )
      );

      toast({
        title: "Analysis Failed",
        description: errorMsg,
        variant: "destructive",
      });

      // Return to input after a delay
      setTimeout(() => {
        setAppState("input");
        setSteps(INITIAL_STEPS);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAppState("input");
    setSteps(INITIAL_STEPS);
    setCurrentStep(0);
    setSimilarChannels([]);
    setSourceChannel(DEFAULT_SOURCE_CHANNEL);
    setErrorMessage("");
  };

  return (
    <div className="min-h-full">
      <div className="py-6">
        {appState === "input" && (
          <div className="animate-fade-in">
            <ChannelInput onAnalyze={handleAnalyze} isLoading={isLoading} />
          </div>
        )}

        {appState === "analyzing" && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#f1f1f1] mb-1">
                Analyzing Channel
              </h2>
              <p className="text-sm text-[#666666]">
                This may take a few moments...
              </p>
            </div>
            <AnalysisProgress steps={steps} currentStep={currentStep} />

            {errorMessage && (
              <div className="mt-6 max-w-xl mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                <p className="text-red-500 text-sm font-medium">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="mt-3 px-4 py-2 bg-[#181818] hover:bg-[#272727] rounded-lg text-sm text-[#f1f1f1] transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {appState === "results" && (
          <div className="animate-fade-in">
            <ResultsDisplay
              sourceChannel={{
                name: sourceChannel.name,
                handle: sourceChannel.handle,
                thumbnail: sourceChannel.thumbnail || "",
              }}
              similarChannels={similarChannels}
              onReset={handleReset}
            />
          </div>
        )}
      </div>
    </div>
  );
}
