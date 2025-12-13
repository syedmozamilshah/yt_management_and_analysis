
import React from 'react';
import { Check, Circle } from 'lucide-react';

interface WizardStepsProps {
  currentStep: number;
  steps: string[];
}

export const WizardSteps: React.FC<WizardStepsProps> = ({ currentStep, steps }) => {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              index < currentStep 
                ? 'bg-[#10b981] border-[#10b981] text-white' 
                : index === currentStep 
                ? 'bg-[#3b82f6] border-[#3b82f6] text-white' 
                : 'bg-[#374151] border-[#4b5563] text-[#9ca3af]'
            }`}>
              {index < currentStep ? (
                <Check className="w-6 h-6" />
              ) : (
                <Circle className="w-6 h-6" />
              )}
            </div>
            <span className={`text-sm mt-2 font-medium ${
              index <= currentStep ? 'text-white' : 'text-[#9ca3af]'
            }`}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 h-0.5 mx-4 mt-[-20px] ${
              index < currentStep ? 'bg-[#10b981]' : 'bg-[#4b5563]'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};
