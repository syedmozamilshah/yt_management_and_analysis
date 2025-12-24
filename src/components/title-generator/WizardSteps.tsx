
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
                ? 'bg-[#cc0000] border-[#cc0000] text-white' 
                : index === currentStep 
                ? 'bg-[#cc0000] border-[#cc0000] text-white shadow-lg shadow-red-900/30' 
                : 'bg-[#272727] border-[#3f3f3f] text-[#666666]'
            }`}>
              {index < currentStep ? (
                <Check className="w-6 h-6" />
              ) : (
                <span className="text-lg font-semibold">{index + 1}</span>
              )}
            </div>
            <span className={`text-sm mt-2 font-medium hidden sm:block ${
              index <= currentStep ? 'text-white' : 'text-[#666666]'
            }`}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 mt-[-20px] sm:mt-[-20px] ${
              index < currentStep ? 'bg-[#cc0000]' : 'bg-[#3f3f3f]'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};
