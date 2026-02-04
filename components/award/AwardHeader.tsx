'use client';

import { useState, useEffect } from 'react';
import { Trophy, Calendar, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function AwardHeader() {
  const { t, lang } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    // 截止时间：2026年4月30日 12:00 台湾时间 (UTC+8)
    const deadline = new Date('2026-04-30T12:00:00+08:00');

    const updateCountdown = () => {
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center mb-12 pt-8 md:pt-12">
      <div className="flex items-center justify-center gap-3 mb-4">
        <Trophy className="w-12 h-12 text-[#10B8D9]" />
        <h1 className="text-4xl md:text-5xl font-bold font-display">
          {t.award?.title || 'Nomad Award'}
        </h1>
      </div>
      <p className="text-xl md:text-2xl text-[#10B8D9] mb-2">
        {t.award?.subtitle || 'Short Video Contest'}
      </p>
      <p className="text-white/70 max-w-2xl mx-auto mb-6">
        {t.award?.description}
      </p>
      
      {/* Countdown Timer */}
      {timeLeft !== null && (
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 text-[#10B8D9] mb-3">
            <Clock className="w-5 h-5" />
            <span className="text-lg font-semibold">
              {lang === 'en' ? 'Time Remaining:' : '倒數計時：'}
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 md:gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
              <div className="text-3xl md:text-4xl font-bold text-[#10B8D9]">
                {timeLeft.days.toString().padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-white/60 mt-1">
                {lang === 'en' ? 'Days' : '天'}
              </div>
            </div>
            <div className="text-2xl md:text-3xl text-[#10B8D9] font-bold">:</div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
              <div className="text-3xl md:text-4xl font-bold text-[#10B8D9]">
                {timeLeft.hours.toString().padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-white/60 mt-1">
                {lang === 'en' ? 'Hours' : '小時'}
              </div>
            </div>
            <div className="text-2xl md:text-3xl text-[#10B8D9] font-bold">:</div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
              <div className="text-3xl md:text-4xl font-bold text-[#10B8D9]">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-white/60 mt-1">
                {lang === 'en' ? 'Minutes' : '分鐘'}
              </div>
            </div>
            <div className="text-2xl md:text-3xl text-[#10B8D9] font-bold">:</div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
              <div className="text-3xl md:text-4xl font-bold text-[#10B8D9]">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-white/60 mt-1">
                {lang === 'en' ? 'Seconds' : '秒'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
        <Calendar className="w-4 h-4" />
        <span>{t.award?.deadline}</span>
      </div>
    </div>
  );
}
