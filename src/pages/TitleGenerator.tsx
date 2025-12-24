
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Video } from '@/types/video';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { WizardSteps } from '@/components/title-generator/WizardSteps';
import { DataSourceSelection } from '@/components/title-generator/DataSourceSelection';
import { ScriptInput } from '@/components/title-generator/ScriptInput';
import { SimpleAnalysisView } from '@/components/title-generator/SimpleAnalysisView';
import { TitleResults } from '@/components/title-generator/TitleResults';
import { Badge } from '@/components/ui/badge';
import { Database, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Helper function to log AI tool usage
const logAIUsage = async (userId: string, toolType: string, requestData?: any) => {
  try {
    await (supabase as any)
      .from('ai_usage_logs')
      .insert({
        user_id: userId,
        tool_type: toolType,
        request_data: requestData
      });
  } catch (error) {
    console.error('Error logging AI usage:', error);
  }
};

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

const TitleGenerator = () => {
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
  const { isAdmin, adminDataMode, user } = useAuth();

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

      // Log AI usage for script analysis
      if (user?.id) {
        logAIUsage(user.id, 'script_analysis', { 
          scriptLength: script.length 
        });
      }

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

      // Log AI usage for title generation
      if (user?.id) {
        logAIUsage(user.id, 'title_generation', { 
          dataSource,
          titlesGenerated: data.titles?.length || 0 
        });
      }

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
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="min-h-screen bg-[#0f0f0f]">
            {/* Main Content */}
            <div className="container mx-auto px-6 py-8">
              {/* Header - Left aligned like Script Generator */}
              <header className="mb-6 sm:mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl sm:text-3xl font-bold text-white">Generate Title</h1>
                      {isAdmin && (
                        <Badge 
                          variant="outline" 
                          className={`${
                            adminDataMode === 'all-data' 
                              ? 'border-green-500 text-green-400 bg-green-500/10' 
                              : 'border-blue-500 text-blue-400 bg-blue-500/10'
                          }`}
                        >
                          {adminDataMode === 'all-data' ? (
                            <><Globe className="w-3 h-3 mr-1" /> All Data</>
                          ) : (
                            <><Database className="w-3 h-3 mr-1" /> My Data</>
                          )}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm sm:text-base text-[#aaaaaa]">
                      {steps[currentStep]}
                    </p>
                  </div>
                </div>

                {/* Progress Steps */}
                <WizardSteps currentStep={currentStep} steps={steps} />
              </header>

              {/* Step Content */}
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
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default TitleGenerator;
