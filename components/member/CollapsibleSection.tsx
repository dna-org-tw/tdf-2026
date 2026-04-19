'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type SectionTone =
  | 'default'
  | 'orders'
  | 'transfers'
  | 'visa'
  | 'email';

const TONE_CLASSES: Record<SectionTone, { bg: string; border: string; hover: string; divider: string }> = {
  default:   { bg: 'bg-white',               border: 'border-transparent', hover: 'hover:bg-stone-50',         divider: 'border-stone-100' },
  orders:    { bg: 'bg-[#F6F3EC]',           border: 'border-[#E7E1D3]',  hover: 'hover:bg-[#F0ECE2]',         divider: 'border-[#E7E1D3]/60' },
  transfers: { bg: 'bg-[#EFEEEA]',           border: 'border-[#DCD9D1]',  hover: 'hover:bg-[#E8E7E2]',         divider: 'border-[#DCD9D1]/60' },
  visa:      { bg: 'bg-[#F5EDDC]',           border: 'border-[#E5D7B8]',  hover: 'hover:bg-[#EFE5CE]',         divider: 'border-[#E5D7B8]/60' },
  email:     { bg: 'bg-[#EAF0F5]',           border: 'border-[#D1DCE6]',  hover: 'hover:bg-[#E1E9F1]',         divider: 'border-[#D1DCE6]/60' },
};

interface Props {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  tone?: SectionTone;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  tone = 'default',
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const c = TONE_CLASSES[tone];
  return (
    <section className={`rounded-2xl ${c.bg} border ${c.border} shadow-sm overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 ${c.hover} transition-colors text-left`}
        aria-expanded={open}
      >
        <div className="flex items-baseline gap-2">
          <h3 className="font-display font-bold text-slate-900 text-base">{title}</h3>
          {count != null && (
            <span className="text-[12px] font-mono text-slate-500">{count}</span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400"
          aria-hidden
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={`px-5 pb-5 pt-1 border-t ${c.divider}`}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
