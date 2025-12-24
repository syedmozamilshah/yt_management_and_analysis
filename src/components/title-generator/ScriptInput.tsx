
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles } from 'lucide-react';

interface ScriptInputProps {
  script: string;
  onScriptChange: (script: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export const ScriptInput: React.FC<ScriptInputProps> = ({
  script,
  onScriptChange,
  onAnalyze,
  isAnalyzing
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="bg-[#181818] border-[#272727] shadow-2xl">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl font-bold text-white flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-[#cc0000]" />
            Paste Your Script
          </CardTitle>
          <p className="text-[#aaaaaa] text-lg mt-2">
            Just paste your script, description, or tell me what your video is about!
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative">
            <Textarea
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              placeholder="Hi! I made a video about how to make the perfect chocolate chip cookies. It shows 5 simple steps that anyone can follow at home..."
              className="min-h-[160px] bg-[#0f0f0f] border-[#404040] text-white placeholder:text-[#666666] text-lg p-6 rounded-xl resize-none focus:border-[#cc0000] focus:ring-[#cc0000]/20"
              disabled={isAnalyzing}
            />
            <div className="absolute bottom-4 right-4 text-[#666666] text-sm">
              {script.length}/1000
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={onAnalyze}
              disabled={!script.trim() || isAnalyzing}
              size="lg"
              className="bg-[#cc0000] hover:bg-[#aa0000] text-white px-12 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                  Reading Your Script...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-3" />
                  Analyze My Script
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
