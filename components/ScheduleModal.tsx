'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
  const { t } = useTranslation();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Full Screen Modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[101] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 bg-white border-b border-[#1E1F1C]/10">
              <h3 className="text-xl md:text-2xl font-display font-bold text-[#1E1F1C]">
                {t.schedule?.title || 'Schedule'}
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[#1E1F1C]/10 transition-colors text-[#1E1F1C]/60 hover:text-[#1E1F1C]"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Iframe Content */}
            <div className="flex-1 overflow-hidden bg-white">
              <iframe
                src="https://docs.google.com/spreadsheets/d/e/2PACX-1vSrOxj08tRlLbnZwafhyGRJwrJNv9uAErn_2FlZIhriQcgrxIdBEBlpB4di2BxwFU2gkJtA9guTkXNk/pubhtml?gid=366714409&amp;single=true&amp;widget=true&amp;headers=false"
                className="w-full h-full border-0"
                loading="lazy"
                title="Schedule Spreadsheet"
                allow="fullscreen"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
