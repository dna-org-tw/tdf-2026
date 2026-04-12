'use client';

import { useState, useEffect } from 'react';
import { Menu, X, Globe, Instagram } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import MobileMenu from './MobileMenu';
import { trackEvent } from '@/components/FacebookPixel';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const { t, lang, toggleLanguage } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === '/';

  // Non-home pages always show scrolled (solid) navbar
  useEffect(() => {
    if (!isHomePage) setScrolled(true);
  }, [isHomePage]);

  // Handle scroll effect with throttle optimization
  useEffect(() => {
    if (!isHomePage) return;
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
  }, [isHomePage]);

  // Helper function to calculate scroll position
  const calculateScrollPosition = (element: HTMLElement) => {
    // Dynamically get navbar height
    const navbarElement = document.querySelector('nav');
    const navbarHeight = navbarElement ? navbarElement.offsetHeight : 80;

    // Scroll offset is simply the navbar height
    return Math.max(0, element.offsetTop - navbarHeight);
  };

  // Handle smooth scroll to section
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const hash = href.replace('#', '');

    trackEvent('Lead', {
      content_name: 'Navigation',
      content_category: 'Navigation',
      section: hash,
      location: 'navbar',
    });

    if (isHomePage) {
      // If on home page, just scroll to the section
      const element = document.getElementById(hash);
      if (element) {
        const scrollPosition = calculateScrollPosition(element);
        window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
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
            const scrollPosition = calculateScrollPosition(element);
            window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
          }
        }, 300);
      }
    }
  }, [isHomePage, pathname]);

  const navLinks = [
    { name: t.nav.news, href: '#news' },
    { name: t.nav.tickets, href: '#tickets' },
    { name: t.nav.highlights, href: '#events' },
    { name: t.nav.accommodation, href: '#accommodation' },
    { name: t.nav.team, href: '#team' },
    { name: t.nav.followUs, href: '#follow-us' },
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
            <span className="md:hidden">TDF 2026</span>
            <span className="hidden md:inline">Taiwan Digital Fest 2026</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={`text-sm font-medium hover:text-[#10B8D9] transition-colors cursor-pointer ${
                scrolled ? 'text-[#1E1F1C]' : 'text-white'
              }`}
            >
              {link.name}
            </a>
          ))}

          <button
            onClick={toggleLanguage}
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label={lang === 'en' ? 'Switch to Chinese' : 'Switch to English'}
          >
            <Globe className="w-5 h-5" />
          </button>

          <a
            href="http://instagram.com/taiwandigitalfest"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('Lead', {
                content_name: 'Instagram Link',
                content_category: 'Social Media',
                link_type: 'instagram',
                location: 'navbar_desktop',
              });
            }}
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>

          {!authLoading && (
            <Link
              href="/member"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-[#1E1F1C] hover:text-[#10B8D9]' : 'text-white hover:text-[#10B8D9]'
              }`}
            >
              {user ? t.nav.member : t.nav.login}
            </Link>
          )}

          <Link
            href="/award"
            onClick={() => {
              trackEvent('Lead', {
                content_name: 'Award',
                content_category: 'Navigation',
                section: 'award',
                location: 'navbar_desktop',
              });
            }}
            className={`bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-4 py-2 rounded-full transition-colors text-sm whitespace-nowrap ${
              scrolled ? 'shadow-md' : ''
            }`}
          >
            {t.nav.award || 'Award'}
          </Link>
        </div>

        {/* Mobile Menu Button and Icons */}
        <div className="md:hidden flex items-center gap-4">
          {!authLoading && (
            <Link
              href="/member"
              className={`transition-colors ${
                scrolled ? 'text-[#1E1F1C] hover:text-[#10B8D9]' : 'text-white hover:text-[#10B8D9]'
              }`}
            >
              {user ? t.nav.member : t.nav.login}
            </Link>
          )}
          <button
            onClick={toggleLanguage}
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label={lang === 'en' ? 'Switch to Chinese' : 'Switch to English'}
          >
            <Globe className="w-5 h-5" />
          </button>
          <a
            href="http://instagram.com/taiwandigitalfest"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('Lead', {
                content_name: 'Instagram Link',
                content_category: 'Social Media',
                link_type: 'instagram',
                location: 'navbar_mobile',
              });
            }}
            className={`hover:text-[#10B8D9] transition-colors ${
              scrolled ? 'text-[#1E1F1C]' : 'text-white'
            }`}
            aria-label="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
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
