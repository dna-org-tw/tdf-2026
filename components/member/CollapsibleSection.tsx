'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({ title, count, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-baseline gap-2">
          <h3 className="font-display font-bold text-slate-900 text-base">{title}</h3>
          {count != null && (
            <span className="text-[12px] font-mono text-slate-400">{count}</span>
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
            <div className="px-5 pb-5 pt-1 border-t border-stone-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
