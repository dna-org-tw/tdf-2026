'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Instagram } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface MobileMenuProps {
  isOpen: boolean;
  navLinks: Array<{ name: string; href: string }>;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  isAdmin?: boolean;
  onToggleLanguage?: () => void;
  lang?: 'en' | 'zh';
  onClose?: () => void;
}

export default function MobileMenu({
  isOpen,
  navLinks,
  handleNavClick,
  isAdmin = false,
  onToggleLanguage,
  lang,
  onClose,
}: MobileMenuProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-full left-0 right-0 bg-white border-b border-[#F6F6F6] p-6 md:hidden shadow-lg"
        >
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={
                  link.href.startsWith('#')
                    ? (e: React.MouseEvent<HTMLAnchorElement>) => handleNavClick(e, link.href)
                    : undefined
                }
                className="text-lg font-medium text-[#1E1F1C] cursor-pointer"
              >
                {link.name}
              </a>
            ))}

            <a
              href="#events"
              onClick={(e) => handleNavClick(e, '#events')}
              className="bg-[#10B8D9] text-white px-6 py-3 rounded-lg text-center font-semibold cursor-pointer"
            >
              {t.nav.register}
            </a>

            <div className="mt-2 pt-4 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                {isAdmin && (
                  <Link
                    href="/admin"
                    prefetch={false}
                    onClick={onClose}
                    className="text-sm font-medium text-[#1E1F1C] hover:text-[#10B8D9]"
                  >
                    {t.nav.admin}
                  </Link>
                )}
                {onToggleLanguage && lang && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleLanguage();
                      onClose?.();
                    }}
                    className="text-sm font-semibold text-[#1E1F1C] hover:text-[#10B8D9]"
                  >
                    {lang === 'en' ? '中文' : 'EN'}
                  </button>
                )}
              </div>
              <a
                href="http://instagram.com/taiwandigitalfest"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-[#1E1F1C] hover:text-[#10B8D9]"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
