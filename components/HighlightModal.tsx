'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface HighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function HighlightModal({ isOpen, onClose, title, description, icon: IconComponent }: HighlightModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-[#F6F6F6]">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#F6F6F6]">
                <div className="flex items-center gap-4">
                  {IconComponent && (
                    <div className="w-12 h-12 rounded-full bg-[#F9D2E5] flex items-center justify-center text-[#10B8D9]">
                      <IconComponent className="w-6 h-6" />
                    </div>
                  )}
                  <h3 className="text-2xl font-display font-bold text-[#1E1F1C]">
                    {title}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-[#F6F6F6] transition-colors text-[#1E1F1C]/60 hover:text-[#1E1F1C]"
                  aria-label={t.eventModal.close}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <p className="text-[#1E1F1C]/80 text-base md:text-lg leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
