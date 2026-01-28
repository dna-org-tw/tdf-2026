'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

interface MobileMenuProps {
  isOpen: boolean;
  navLinks: Array<{ name: string; href: string }>;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export default function MobileMenu({ isOpen, navLinks, handleNavClick }: MobileMenuProps) {
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
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-lg font-medium text-[#1E1F1C] cursor-pointer"
              >
                {link.name}
              </a>
            ))}
            <a
              href="#schedule"
              onClick={(e) => handleNavClick(e, '#schedule')}
              className="bg-[#10B8D9] text-white px-6 py-3 rounded-lg text-center font-semibold cursor-pointer"
            >
              {t.nav.register}
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
