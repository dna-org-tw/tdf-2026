import { Award } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function AwardsInfo() {
  const { t } = useTranslation();

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Award className="w-6 h-6 text-[#10B8D9]" />
        {t.award?.awards?.title || 'Prizes'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-[#10B8D9] mb-2">🥇</div>
          <div className="text-xl font-semibold mb-1">{t.award?.awards?.first || '$600 USD'}</div>
          <div className="text-white/60 text-sm">1st Place</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-[#10B8D9] mb-2">🥈</div>
          <div className="text-xl font-semibold mb-1">{t.award?.awards?.second || '$300 USD'}</div>
          <div className="text-white/60 text-sm">2nd Place</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-[#10B8D9] mb-2">🥉</div>
          <div className="text-xl font-semibold mb-1">{t.award?.awards?.third || '$150 USD'}</div>
          <div className="text-white/60 text-sm">3rd Place</div>
        </div>
      </div>
      <p className="text-center text-white/70 mt-6 text-sm">
        {t.award?.ceremony}
      </p>
    </div>
  );
}
