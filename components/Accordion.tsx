'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
}

export default function Accordion({ items }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="border border-stone-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
          >
            <span className="font-medium text-[#1E1F1C] pr-4">{item.question}</span>
            <ChevronDown
              className={`w-5 h-5 text-stone-400 shrink-0 transition-transform duration-300 ${
                openId === item.id ? 'rotate-180' : ''
              }`}
            />
          </button>
          <AnimatePresence initial={false}>
            {openId === item.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 text-stone-600 border-t border-stone-200 bg-stone-50 whitespace-pre-line">
                  {item.answer}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
