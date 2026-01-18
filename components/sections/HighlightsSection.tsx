'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowUpRight, Calendar, CalendarCheck, Users, Heart } from 'lucide-react';
import HighlightModal from '@/components/HighlightModal';

export default function HighlightsSection() {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<{ title: string; desc: string; icon?: React.ComponentType<{ className?: string }> } | null>(null);

  // 图标映射
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Calendar,
    CalendarCheck,
    Users,
    Heart,
  };

  // 默认图标数组（如果没有指定图标，按顺序使用）
  const defaultIcons = [Calendar, CalendarCheck, Users, Heart];

  const items = t.highlights.items;

  return (
    <section id="highlights" className="bg-stone-100 py-16 md:py-20">
      <div className="container mx-auto px-6">
        {/* 标题区域 */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 md:mb-12">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-slate-900 max-w-lg leading-tight"
          >
            {t.highlights.title}
          </motion.h2>
          <motion.div
             initial={{ opacity: 0, x: 20 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             className="hidden md:block w-32 h-1 bg-teal-500 mb-4"
          />
        </div>

        {/* 卡片网格布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {items.map((item, index) => {
            // 获取图标：优先使用 item.icon，否则使用默认图标
            const itemWithIcon = item as { icon?: string; title: string; desc: string; summary?: string };
            const IconComponent = itemWithIcon.icon 
              ? iconMap[itemWithIcon.icon] || defaultIcons[index % defaultIcons.length]
              : defaultIcons[index % defaultIcons.length];

            // 使用 summary 作为摘要，如果没有则使用 desc
            const summary = itemWithIcon.summary || item.desc;
            const hasFullDesc = itemWithIcon.summary && item.desc && item.desc !== itemWithIcon.summary;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className={`bg-white p-6 md:p-7 lg:p-8 rounded-2xl hover:bg-teal-50 transition-colors group border border-stone-200 hover:border-teal-100 ${hasFullDesc ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (hasFullDesc) {
                    setSelectedItem({
                      title: item.title,
                      desc: item.desc,
                      icon: IconComponent,
                    });
                  }
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-stone-100 flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                    <IconComponent className="w-5 h-5 md:w-6 md:h-6 group-hover:text-white text-teal-600 transition-colors" />
                  </div>
                  {hasFullDesc && (
                    <ArrowUpRight className="text-stone-300 group-hover:text-teal-500 transition-colors w-4 h-4 md:w-5 md:h-5" />
                  )}
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-3 group-hover:text-teal-700 transition-colors">
                  {item.title}
                </h3>
                <p className="text-slate-500 text-base md:text-lg leading-relaxed">
                  {summary}
                  {hasFullDesc && (
                    <span className="text-teal-600 hover:text-teal-700 font-medium ml-1">
                      {t.highlights.viewMore}
                    </span>
                  )}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Buttons */}
        {t.highlights.ctas && t.highlights.ctas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            {t.highlights.ctas.map((cta) => {
              const isPrimary = cta.type === "Register";
              return (
                <motion.a
                  key={cta.type}
                  href={cta.href}
                  target={cta.href.startsWith('http') ? '_blank' : undefined}
                  rel={cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`inline-block px-8 py-3 rounded-full text-base md:text-lg font-bold tracking-wide transition-all shadow-lg ${
                    isPrimary
                      ? 'bg-[#10B8D9] hover:bg-[#10B8D9]/80 text-white shadow-[#004E9D]/20'
                      : 'bg-white hover:bg-stone-50 text-[#1E1F1C] border-2 border-[#1E1F1C]'
                  }`}
                >
                  {cta.text}
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Highlight Modal */}
      {selectedItem && (
        <HighlightModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.title}
          description={selectedItem.desc}
          icon={selectedItem.icon}
        />
      )}
    </section>
  );
}
