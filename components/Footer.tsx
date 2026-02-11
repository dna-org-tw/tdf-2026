'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import Link from 'next/link';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-[#1E1F1C] text-[#F6F6F6] z-10 max-h-[150px] overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
          {/* Brand Section */}
          <div className="text-center md:text-left">
             <h3 className="text-white font-display font-bold text-base sm:text-lg mb-1">TDF 2026</h3>
             <p className="text-xs">Taiwan Digital Fest</p>
             <p className="text-xs mt-1">{t.footer.copyright}</p>
          </div>
          
          {/* Get Involved Section */}
          <div className="flex flex-col gap-1 text-xs">
            <h4 className="font-semibold text-white mb-1 text-xs sm:text-sm">{t.footer.getInvolved}</h4>
            <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5">
              <a 
                href="https://forms.gle/pVc6oTEi1XZ1pAR49"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('Lead', {
                    content_name: 'Call for Speakers',
                    content_category: 'CTA',
                    location: 'footer',
                  });
                }}
                className="hover:text-[#10B8D9] transition-colors text-[#F6F6F6]/80"
              >
                {t.footer.callForSpeakers}
              </a>
              <a 
                href="https://forms.gle/aN3LbaHy8iV5xqyi8"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('Lead', {
                    content_name: 'Call for Sponsors',
                    content_category: 'CTA',
                    location: 'footer',
                  });
                }}
                className="hover:text-[#10B8D9] transition-colors text-[#F6F6F6]/80"
              >
                {t.footer.callForSponsors}
              </a>
              <a 
                href="https://forms.gle/KqJGkQhdWmSZVTdv6"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('Lead', {
                    content_name: 'Call for Partners',
                    content_category: 'CTA',
                    location: 'footer',
                  });
                }}
                className="hover:text-[#10B8D9] transition-colors text-[#F6F6F6]/80"
              >
                {t.footer.callForPartners}
              </a>
              <a 
                href="https://forms.gle/SPCggMHifbE3oqkk7"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('Lead', {
                    content_name: 'Call for Volunteers',
                    content_category: 'CTA',
                    location: 'footer',
                  });
                }}
                className="hover:text-[#10B8D9] transition-colors text-[#F6F6F6]/80"
              >
                {t.footer.callForVolunteers}
              </a>
              <a 
                href="https://forms.gle/EofTp9Qso27jEeeY7"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('Lead', {
                    content_name: 'Call for Side Events',
                    content_category: 'CTA',
                    location: 'footer',
                  });
                }}
                className="hover:text-[#10B8D9] transition-colors text-[#F6F6F6]/80"
              >
                {t.footer.callForSideEvents}
              </a>
            </div>
          </div>
          
          {/* Contact Section */}
          <div className="flex flex-col gap-1 text-xs">
            <Link 
              href="/order/query"
              onClick={() => trackEvent('Lead', { content_name: 'Order Query', content_category: 'CTA', location: 'footer' })}
              className="hover:text-[#10B8D9] transition-colors text-[#F6F6F6]/80"
            >
              {t.footer.orderQuery}
            </Link>
            <a 
              href="mailto:fest@dna.org.tw"
              onClick={() => {
                trackEvent('Contact', { content_category: 'Email Contact', location: 'footer' });
              }}
              className="hover:text-[#10B8D9] transition-colors"
            >
              <span className="font-semibold">Contact: </span>
              <span className="text-[#F6F6F6]/60">fest@dna.org.tw</span>
            </a>
            <a 
              href="http://instagram.com/taiwandigitalfest" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'Taiwan Digital Fest Instagram',
                  content_category: 'Social Media',
                  link_type: 'instagram',
                  location: 'footer',
                  account: 'taiwandigitalfest',
                });
              }}
              className="hover:text-[#10B8D9] transition-colors"
            >
              <span className="font-semibold">Taiwan Digital Fest </span>
              <span className="text-[#F6F6F6]/60">Instagram</span>
            </a>
            <a 
              href="https://www.instagram.com/dna.org.tw" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'TDNA Instagram',
                  content_category: 'Social Media',
                  link_type: 'instagram',
                  location: 'footer',
                  account: 'dna.org.tw',
                });
              }}
              className="hover:text-[#10B8D9] transition-colors"
            >
              <span className="font-semibold">TDNA </span>
              <span className="text-[#F6F6F6]/60">Instagram</span>
            </a>
          </div>
        </div>
        {/* reCAPTCHA branding (required when hiding badge) */}
        <div className="text-center mt-2 pt-2 border-t border-[#F6F6F6]/10">
          <p className="text-xs text-[#F6F6F6]/60">
            {t.footer.recaptcha}{' '}
            <a 
              href="https://policies.google.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-[#10B8D9] transition-colors underline"
            >
              {t.footer.privacyPolicy}
            </a>{' '}
            {t.footer.and}{' '}
            <a 
              href="https://policies.google.com/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-[#10B8D9] transition-colors underline"
            >
              {t.footer.termsOfService}
            </a>{' '}
            {t.footer.apply}
          </p>
        </div>
      </div>
    </footer>
  );
}
