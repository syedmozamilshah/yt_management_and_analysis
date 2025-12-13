
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
  const { toast } = useToast();

  const steps = ['Choose Data Source', 'Paste Your Script', 'Review & Edit', 'Get Your Titles'];

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
