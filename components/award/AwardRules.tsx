import { CheckCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function AwardRules() {
  const { t } = useTranslation();

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
      <h2 className="text-2xl font-bold mb-4">{t.award?.rules?.title || 'Rules'}</h2>
      <ul className="space-y-2 text-white/80">
        <li className="flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-[#10B8D9] flex-shrink-0 mt-0.5" />
          <span>{t.award?.rules?.rule1}</span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-[#10B8D9] flex-shrink-0 mt-0.5" />
          <span>{t.award?.rules?.rule3}</span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-[#10B8D9] flex-shrink-0 mt-0.5" />
          <span>{t.award?.rules?.rule4}</span>
        </li>
      </ul>
    </div>
  );
}
