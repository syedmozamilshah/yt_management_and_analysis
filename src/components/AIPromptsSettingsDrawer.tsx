import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Sparkles, RotateCcw, Pencil, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAIPrompts, saveAIPrompts, DEFAULT_AI_PROMPTS } from '@/services/transcriptService';

interface AIPromptsSettingsDrawerProps {
  trigger?: React.ReactNode;
}

type ToolType = 'claude' | 'gemini' | 'gpt';

interface Tool {
  id: ToolType;
  name: string;
  icon: string;
}

const tools: Tool[] = [
  { id: 'claude', name: 'Claude', icon: '/logo/claude.png' },
  { id: 'gemini', name: 'Gemini', icon: '/logo/gemini.png' },
  { id: 'gpt', name: 'ChatGPT', icon: '/logo/gpt.png' },
];

export const AIPromptsSettingsDrawer: React.FC<AIPromptsSettingsDrawerProps> = ({ trigger }) => {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState(DEFAULT_AI_PROMPTS);
  const [open, setOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolType | null>(null);

  useEffect(() => {
    if (open) {
      setPrompts(getAIPrompts());
      setEditingTool(null);
    }
  }, [open]);

  const handleSave = (tool: ToolType) => {
    saveAIPrompts(prompts);
    toast({
      title: "Prompt Saved",
      description: `Your ${tool === 'gpt' ? 'ChatGPT' : tool.charAt(0).toUpperCase() + tool.slice(1)} prompt has been updated.`
    });
    setEditingTool(null);
  };

  const handleReset = (tool: ToolType) => {
    setPrompts(prev => ({
      ...prev,
      [tool]: DEFAULT_AI_PROMPTS[tool]
    }));
  };

  const handleCancelEdit = () => {
    // Reset to saved prompts
    setPrompts(getAIPrompts());
    setEditingTool(null);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] transition-all duration-200"
            title="AI Prompt Settings"
          >
            <Sparkles className="w-5 h-5" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="bg-[#181818] border-l border-[#272727] text-white w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-[#cc0000]/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold">AI Prompt Settings</span>
              <p className="text-sm font-normal text-[#888888]">Customize prompts for each AI model</p>
            </div>
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="bg-[#0f0f0f] rounded-xl border border-[#272727] overflow-hidden transition-all"
            >
              {/* Tool Header - Always visible */}
              <div 
                className={`flex items-center justify-between p-4 ${
                  editingTool !== tool.id ? 'cursor-pointer hover:bg-[#181818]' : ''
                } transition-colors`}
                onClick={() => editingTool !== tool.id && setEditingTool(tool.id)}
              >
                <div className="flex items-center gap-3">
                  <img src={tool.icon} alt={tool.name} className="w-10 h-10 rounded-lg shadow-sm" />
                  <span className="text-[#f1f1f1] font-medium text-lg">{tool.name}</span>
                </div>
                {editingTool !== tool.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTool(tool.id);
                    }}
                    className="text-[#888888] hover:text-[#cc0000] hover:bg-[#cc0000]/10 gap-1.5"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCancelEdit()}
                    className="text-[#888888] hover:text-white hover:bg-[#272727] h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Edit Area - Only visible when editing */}
              {editingTool === tool.id && (
                <div className="p-4 pt-0 space-y-3 border-t border-[#272727]">
                  <Textarea
                    value={prompts[tool.id]}
                    onChange={(e) => setPrompts(prev => ({ ...prev, [tool.id]: e.target.value }))}
                    className="bg-[#181818] border-[#272727] text-[#f1f1f1] min-h-[150px] resize-y text-sm focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]/20"
                    placeholder={`Enter your ${tool.name} prompt...`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReset(tool.id)}
                      className="text-[#666666] hover:text-[#cc0000] hover:bg-[#cc0000]/10 text-xs h-8 gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to Default
                    </Button>
                    <Button
                      onClick={() => handleSave(tool.id)}
                      size="sm"
                      className="bg-[#cc0000] hover:bg-[#aa0000] text-white h-8 gap-1.5"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
