'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface BriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BriefingModal({ isOpen, onClose }: BriefingModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="briefing-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="relative flex items-center justify-center h-full p-4">
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-[#1E1F1C] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-xl font-display font-bold text-white">
                  {t.briefing.modalTitle}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                  aria-label={t.briefing.closeModal}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Luma Embed */}
              <div className="p-4">
                <iframe
                  src="https://luma.com/embed/event/evt-1ZQ0H7LPHB2tovg/simple"
                  width="100%"
                  height="450"
                  frameBorder="0"
                  style={{ border: '1px solid #bfcbda88', borderRadius: '4px' }}
                  allow="fullscreen; payment"
                  aria-hidden="false"
                  tabIndex={0}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
