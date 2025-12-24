import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnalysisStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
};

interface AnalysisProgressProps {
  steps: AnalysisStep[];
  currentStep: number;
}

export function AnalysisProgress({ steps, currentStep }: AnalysisProgressProps) {
  const completedSteps = steps.filter(s => s.status === "completed").length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-[#181818] rounded-2xl border border-[#272727] p-8 relative overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#cc0000]/5 to-transparent animate-pulse" />
        
        {/* Icon */}
        <div className="relative flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#cc0000]/10 border border-[#cc0000]/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-[#cc0000] animate-pulse" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative mb-8">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#aaaaaa] font-medium">Finding competitors...</span>
            <span className="text-[#cc0000] font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-[#272727] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#cc0000] to-[#ff4444] transition-all duration-500 ease-out rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="relative space-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                step.status === "active" && "bg-[#cc0000]/10",
                step.status === "completed" && "opacity-50",
                step.status === "pending" && "opacity-30"
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all",
                  step.status === "pending" && "bg-[#272727] text-[#666666]",
                  step.status === "active" && "bg-[#cc0000] text-white",
                  step.status === "completed" && "bg-green-500/20 text-green-500",
                  step.status === "error" && "bg-red-500/20 text-red-500"
                )}
              >
                {step.status === "completed" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : step.status === "active" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : step.status === "error" ? (
                  "!"
                ) : (
                  index + 1
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  "text-sm font-medium",
                  step.status === "active" && "text-[#f1f1f1]",
                  step.status === "completed" && "text-[#aaaaaa]",
                  step.status === "pending" && "text-[#666666]",
                  step.status === "error" && "text-red-500"
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
