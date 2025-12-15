
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';
import { WizardSteps } from '@/components/title-generator/WizardSteps';
import { DataSourceSelection } from '@/components/title-generator/DataSourceSelection';
import { ScriptInput } from '@/components/title-generator/ScriptInput';
import { SimpleAnalysisView } from '@/components/title-generator/SimpleAnalysisView';
import { TitleResults } from '@/components/title-generator/TitleResults';
import { Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ScriptAnalysis {
  mainTopic: string;
  mainAuthority: string;
  authorityVsAuthority: {
    authority1: string;
    authority2: string;
    relationship: string;
  } | null;
  contentType: string;
  niche: string;
}

interface GeneratedTitleWithAnalysis {
  title: string;
  adaptedFrom: string;
  patterns: string[];
  statements: string[];
  authorityReplacement: string;
}

type WorkflowStep = 0 | 1 | 2 | 3;

export const TitleGeneratorSection = () => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(0);
  const [dataSource, setDataSource] = useState<'outliers' | 'favorites' | null>(null);
  const [script, setScript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptAnalysis, setScriptAnalysis] = useState<ScriptAnalysis | null>(null);
  const [generatedTitles, setGeneratedTitles] = useState<GeneratedTitleWithAnalysis[]>([]);
  const [referenceVideos, setReferenceVideos] = useState<Video[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState<number>(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { toast } = useToast();

  const steps = ['Choose Data Source', 'Paste Your Script', 'Review & Edit', 'Get Your Titles'];

  // Simulate initial loading for visual consistency
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDataSourceSelect = (source: 'outliers' | 'favorites') => {
    setDataSource(source);
  };

  const handleDataSourceNext = () => {
    if (dataSource) {
      setCurrentStep(1);
    }
  };

  const handleAnalyzeScript = async () => {
    if (!script.trim()) {
      toast({
        title: "Oops! 📝",
        description: "Please tell us about your video first!",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-script', {
        body: { userScript: script }
      });

      if (error) throw error;

      setScriptAnalysis(data.scriptAnalysis);
      setCurrentStep(2);

      toast({
        title: "Great! We got it! 🎯",
        description: "We analyzed your video - check if everything looks right!"
      });
    } catch (error) {
      console.error('Error analyzing script:', error);
      toast({
        title: "Oops! Something went wrong 😅",
        description: "Let's try that again - please check your internet connection.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateTitles = async () => {
    if (!scriptAnalysis) {
      toast({
        title: "Wait! 🛑",
        description: "We need to analyze your script first!",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { 
          userScript: script,
          scriptAnalysis,
          dataSource 
        }
      });

      if (error) throw error;

      setGeneratedTitles(data.titles);
      setReferenceVideos(data.referenceVideos);
      setTotalAnalyzed(data.totalAnalyzed || data.referenceVideos?.length || 0);
      setCurrentStep(3);

      const sourceText = dataSource === 'favorites' ? 'your favorite videos' : 'viral outliers';
      toast({
        title: "Ta-da! Your titles are ready! 🎉",
        description: `We created ${data.titles.length} amazing titles from ${sourceText}!`
      });
    } catch (error) {
      console.error('Error generating titles:', error);
      toast({
        title: "Oops! Something went wrong 😅",
        description: "Let's try generating those titles again!",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalysisUpdate = (updatedAnalysis: ScriptAnalysis) => {
    setScriptAnalysis(updatedAnalysis);
    toast({
      title: "Perfect! Changes saved! ✅",
      description: "Your updates look great - ready to generate titles!"
    });
  };

  const handleGenerateMore = () => {
    setCurrentStep(2);
  };

  const handleStartOver = () => {
    setCurrentStep(0);
    setDataSource(null);
    setScript('');
    setScriptAnalysis(null);
    setGeneratedTitles([]);
    setReferenceVideos([]);
  };

  // Loading skeleton
  if (isInitialLoading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="bg-[#181818] border border-[#272727] rounded-2xl p-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#272727] rounded-xl animate-pulse" />
            </div>
            <div className="w-48 h-10 bg-[#272727] rounded mx-auto animate-pulse" />
            <div className="w-96 h-5 bg-[#272727] rounded mx-auto animate-pulse" />
          </div>
        </div>

        {/* Steps skeleton */}
        <div className="flex justify-center gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#272727] rounded-full animate-pulse" />
              <div className="w-24 h-4 bg-[#272727] rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#181818] border border-[#272727] rounded-xl p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[#272727] rounded-lg" />
              <div className="flex-1">
                <div className="w-32 h-5 bg-[#272727] rounded mb-2" />
                <div className="w-48 h-4 bg-[#272727] rounded" />
              </div>
            </div>
            <div className="h-20 bg-[#272727] rounded-lg" />
          </div>
          <div className="bg-[#181818] border border-[#272727] rounded-xl p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[#272727] rounded-lg" />
              <div className="flex-1">
                <div className="w-32 h-5 bg-[#272727] rounded mb-2" />
                <div className="w-48 h-4 bg-[#272727] rounded" />
              </div>
            </div>
            <div className="h-20 bg-[#272727] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#181818] border border-[#272727] rounded-2xl p-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#cc0000] rounded-xl flex items-center justify-center">
              <Wand2 className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-[#f1f1f1]">Generate Title</h2>
          </div>
          <p className="text-[#aaaaaa] text-xl max-w-2xl mx-auto">
            We scan successful video titles from viral outliers to generate customized titles for you
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <WizardSteps currentStep={currentStep} steps={steps} />

      {/* Main Content */}
      {currentStep === 0 && (
        <DataSourceSelection
          onSourceSelect={handleDataSourceSelect}
          selectedSource={dataSource}
          onNext={handleDataSourceNext}
        />
      )}

      {currentStep === 1 && (
        <ScriptInput
          script={script}
          onScriptChange={setScript}
          onAnalyze={handleAnalyzeScript}
          isAnalyzing={isAnalyzing}
        />
      )}

      {currentStep === 2 && scriptAnalysis && (
        <SimpleAnalysisView
          analysis={scriptAnalysis}
          onAnalysisUpdate={handleAnalysisUpdate}
          onGenerateTitles={handleGenerateTitles}
          isGenerating={isGenerating}
        />
      )}

      {currentStep === 3 && (
        <TitleResults
          titles={generatedTitles}
          referenceVideos={referenceVideos}
          onGenerateMore={handleGenerateMore}
          onStartOver={handleStartOver}
          dataSource={dataSource}
          totalAnalyzed={totalAnalyzed}
        />
      )}
    </div>
  );
};
