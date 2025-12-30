import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Settings, Save, Sparkles, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAIPrompts, saveAIPrompts, DEFAULT_AI_PROMPTS } from '@/services/transcriptService';

interface AIPromptsSettingsDrawerProps {
  trigger?: React.ReactNode;
}

export const AIPromptsSettingsDrawer: React.FC<AIPromptsSettingsDrawerProps> = ({ trigger }) => {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState(DEFAULT_AI_PROMPTS);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setPrompts(getAIPrompts());
    }
  }, [open]);

  const handleSave = () => {
    saveAIPrompts(prompts);
    toast({
      title: "Settings Saved",
      description: "Your AI prompts have been updated successfully."
    });
    setOpen(false);
  };

  const handleReset = (tool: 'claude' | 'gemini' | 'gpt') => {
    setPrompts(prev => ({
      ...prev,
      [tool]: DEFAULT_AI_PROMPTS[tool]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] transition-all duration-200"
            title="AI Prompt Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#181818] border border-[#272727] text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold">AI Prompt Settings</span>
              <p className="text-sm font-normal text-[#888888]">Customize prompts for each AI model</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          {/* Claude Prompt */}
          <div className="space-y-3 bg-[#0f0f0f] rounded-xl p-4 border border-[#272727] hover:border-[#cc0000]/30 transition-colors">
            <div className="flex items-center justify-between">
              <Label className="text-[#f1f1f1] font-medium flex items-center gap-3">
                <img src="/logo/claude.png" alt="Claude" className="w-8 h-8 rounded-lg shadow-sm" />
                <span>Claude</span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReset('claude')}
                className="text-[#666666] hover:text-[#cc0000] hover:bg-[#cc0000]/10 text-xs h-7 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
            <Textarea
              value={prompts.claude}
              onChange={(e) => setPrompts(prev => ({ ...prev, claude: e.target.value }))}
              className="bg-[#181818] border-[#272727] text-[#f1f1f1] min-h-[100px] resize-y text-sm focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]/20"
              placeholder="Enter your Claude prompt..."
            />
          </div>

          {/* Gemini Prompt */}
          <div className="space-y-3 bg-[#0f0f0f] rounded-xl p-4 border border-[#272727] hover:border-[#cc0000]/30 transition-colors">
            <div className="flex items-center justify-between">
              <Label className="text-[#f1f1f1] font-medium flex items-center gap-3">
                <img src="/logo/gemini.png" alt="Gemini" className="w-8 h-8 rounded-lg shadow-sm" />
                <span>Gemini</span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReset('gemini')}
                className="text-[#666666] hover:text-[#cc0000] hover:bg-[#cc0000]/10 text-xs h-7 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
            <Textarea
              value={prompts.gemini}
              onChange={(e) => setPrompts(prev => ({ ...prev, gemini: e.target.value }))}
              className="bg-[#181818] border-[#272727] text-[#f1f1f1] min-h-[100px] resize-y text-sm focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]/20"
              placeholder="Enter your Gemini prompt..."
            />
          </div>

          {/* GPT Prompt */}
          <div className="space-y-3 bg-[#0f0f0f] rounded-xl p-4 border border-[#272727] hover:border-[#cc0000]/30 transition-colors">
            <div className="flex items-center justify-between">
              <Label className="text-[#f1f1f1] font-medium flex items-center gap-3">
                <img src="/logo/gpt.png" alt="ChatGPT" className="w-8 h-8 rounded-lg shadow-sm" />
                <span>ChatGPT</span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReset('gpt')}
                className="text-[#666666] hover:text-[#cc0000] hover:bg-[#cc0000]/10 text-xs h-7 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
            <Textarea
              value={prompts.gpt}
              onChange={(e) => setPrompts(prev => ({ ...prev, gpt: e.target.value }))}
              className="bg-[#181818] border-[#272727] text-[#f1f1f1] min-h-[100px] resize-y text-sm focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]/20"
              placeholder="Enter your ChatGPT prompt..."
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#dd0000] hover:to-[#bb0000] text-white h-11 rounded-xl shadow-lg shadow-[#cc0000]/30 hover:shadow-[#cc0000]/50 transition-all duration-300"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
