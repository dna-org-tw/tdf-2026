'use client';

import { useState, useEffect } from 'react';
import { Menu, X, Globe, Instagram, Calendar } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import MobileMenu from './MobileMenu';

export default function Navbar() {
  const { t, lang, toggleLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === '/';

  // Handle scroll effect with throttle optimization
  useEffect(() => {
    // 使用 requestAnimationFrame 優化 scroll 事件處理
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle smooth scroll to section
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const hash = href.replace('#', '');
    
    if (isHomePage) {
      // If on home page, just scroll to the section
      const element = document.getElementById(hash);
      if (element) {
        // Account for navbar height (80px) and fixed footer height (150px)
        const navbarHeight = 80;
        const footerHeight = 150;
        const viewportHeight = window.innerHeight;
        
        // Calculate base position accounting for navbar
        const basePosition = element.offsetTop - navbarHeight;
        
        // Calculate where element bottom would be after scrolling
        const elementBottomAfterScroll = basePosition + element.offsetHeight + navbarHeight;
        
        // Check if element would be hidden behind footer
        const maxVisibleBottom = viewportHeight - footerHeight;
        
        // If element bottom would be below the max visible area, adjust scroll position
        if (elementBottomAfterScroll > maxVisibleBottom) {
          // Scroll so element bottom is just above footer
          const adjustedPosition = element.offsetTop + element.offsetHeight - maxVisibleBottom;
          window.scrollTo({ top: Math.max(0, adjustedPosition), behavior: 'smooth' });
        } else {
          // Normal case: just account for navbar
          window.scrollTo({ top: basePosition, behavior: 'smooth' });
        }
      }
    } else {
      // If on another page, navigate to home page with hash
      router.push(`/${href}`);
    }
    setIsOpen(false);
  };

  // Handle hash navigation after page load (when navigating from other pages)
  useEffect(() => {
    if (isHomePage && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        // Wait for page to fully load, then scroll
        setTimeout(() => {
          const element = document.getElementById(hash.replace('#', ''));
          if (element) {
            // Account for navbar height (80px) and fixed footer height (150px)
            const navbarHeight = 80;
            const footerHeight = 150;
            const viewportHeight = window.innerHeight;
            
            // Calculate base position accounting for navbar
            const basePosition = element.offsetTop - navbarHeight;
            
            // Calculate where element bottom would be after scrolling
            const elementBottomAfterScroll = basePosition + element.offsetHeight + navbarHeight;
            
            // Check if element would be hidden behind footer
            const maxVisibleBottom = viewportHeight - footerHeight;
            
            // If element bottom would be below the max visible area, adjust scroll position
            if (elementBottomAfterScroll > maxVisibleBottom) {
              // Scroll so element bottom is just above footer
              const adjustedPosition = element.offsetTop + element.offsetHeight - maxVisibleBottom;
              window.scrollTo({ top: Math.max(0, adjustedPosition), behavior: 'smooth' });
            } else {
              // Normal case: just account for navbar
              window.scrollTo({ top: basePosition, behavior: 'smooth' });
            }
          }
        }, 300);
      }
    }
  }, [isHomePage, pathname]);

  const navLinks = [
    { name: t.nav.about, nameShort: t.navShort?.about || t.nav.about, href: '#about' },
    { name: t.nav.why, nameShort: t.navShort?.why || t.nav.why, href: '#why' },
    { name: t.nav.highlights, nameShort: t.navShort?.highlights || t.nav.highlights, href: '#highlights' },
    { name: t.nav.schedule, nameShort: t.navShort?.schedule || t.nav.schedule, href: '#tickets-timeline' },
    { name: t.nav.accommodation, nameShort: t.navShort?.accommodation || t.nav.accommodation, href: '#accommodation' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        {/* Logo */}
          <Link href="/" className={`font-display font-bold text-xl tracking-tight flex items-center gap-3 transition-colors ${
            scrolled ? 'text-[#1E1F1C]' : 'text-white'
          }`}>
          <Image 
            src="/images/logo/tdf2026_logo.png" 
            alt="Taiwan Digital Fest 2026 Logo - Taiwan Digital Nomad Association" 
            width={40} 
            height={40}
            className="object-contain"
          />
          <span className="whitespace-nowrap">
            <span className="lg:hidden">TDF 2026</span>
            <span className="hidden lg:inline">Taiwan Digital Fest 2026</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={`text-sm font-medium hover:text-[#10B8D9] transition-colors cursor-pointer ${
                scrolled ? 'text-[#1E1F1C]' : 'text-white'
              }`}
            >
              <span className="md:inline lg:hidden">{link.nameShort}</span>
              <span className="hidden lg:inline">{link.name}</span>
            </a>
          ))}
          
          <a
            href="http://instagram.com/taiwandigitalfest"
            target="_blank"
            rel="noopener noreferrer"
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
          
          <button 
            onClick={toggleLanguage}
            className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider border rounded-full px-3 py-1 hover:bg-[#F9D2E5] transition-colors ${
              scrolled 
                ? 'border-[#F6F6F6] text-[#1E1F1C]' 
                : 'border-white/30 text-white'
            }`}
          >
            <Globe className="w-3 h-3" />
            {lang === 'en' ? '中文' : 'EN'}
          </button>

          <a
            href="#tickets-timeline"
            onClick={(e) => handleNavClick(e, '#tickets-timeline')}
            className="bg-[#1E1F1C] text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-[#10B8D9] transition-colors cursor-pointer"
          >
            {t.nav.register}
          </a>
        </div>

        {/* Mobile Menu Button and Icons */}
        <div className="md:hidden flex items-center gap-4">
          <a
            href="#tickets-timeline"
            onClick={(e) => handleNavClick(e, '#tickets-timeline')}
            className={`hover:text-[#10B8D9] transition-colors cursor-pointer ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label="Event Timeline"
          >
            <Calendar className="w-5 h-5" />
          </a>
          <a
            href="http://instagram.com/taiwandigitalfest"
            target="_blank"
            rel="noopener noreferrer"
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
          <button 
            onClick={toggleLanguage}
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label={lang === 'en' ? 'Switch to Chinese' : 'Switch to English'}
          >
            <Globe className="w-5 h-5" />
          </button>
          <button 
            className={`transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <MobileMenu 
        isOpen={isOpen} 
        navLinks={navLinks} 
        handleNavClick={handleNavClick} 
      />
    </nav>
  );
}
