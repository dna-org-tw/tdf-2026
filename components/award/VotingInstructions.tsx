import { useTranslation } from '@/hooks/useTranslation';
import { CheckCircle2 } from 'lucide-react';

export default function VotingInstructions() {
  const { t } = useTranslation();

  const steps = [
    t.award?.voting?.step1,
    t.award?.voting?.step2,
    t.award?.voting?.step3,
    t.award?.voting?.step4,
    t.award?.voting?.step5,
  ].filter(Boolean);

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
      <h2 className="text-2xl font-bold mb-8">{t.award?.voting?.title || 'How to Vote'}</h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#10B8D9] via-[#10B8D9]/60 to-[#10B8D9]/30"></div>
        
        {/* Steps */}
        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={index} className="relative flex items-start gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-[#10B8D9] flex items-center justify-center border-4 border-[#1E1F1C] shadow-lg">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-[#10B8D9] bg-[#1E1F1C] px-2">
                  {index + 1}
                </div>
              </div>
              
              {/* Step content */}
              <div className="flex-1 pt-1">
                <p className="text-white/90 text-base md:text-lg leading-relaxed">
                  {step}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
