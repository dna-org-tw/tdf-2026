'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect, useMemo } from 'react';
import { trackEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useLumaData } from '@/contexts/LumaDataContext';
import { ExternalLink, Instagram, Mail, Globe, User, Youtube, Linkedin, Twitter } from 'lucide-react';
import type { SpeakerGrouped, SpeakerSocialLinks } from '@/lib/lumaSpeakers';

interface Partner {
  name: string;
  logo?: string;
  link?: string;
}

interface SpeakerGroupedWithMock extends SpeakerGrouped {
  callForSpeakersUrl?: string;
}

const LUMA_USER_BASE = 'https://luma.com/user';
const CALL_FOR_SPEAKERS_URL = 'https://forms.gle/pVc6oTEi1XZ1pAR49';
const DEFAULT_SPEAKER_IMAGE = '/images/default_speaker.jpg';
const MAX_EVENTS_VISIBLE = 3;
const TARGET_SPEAKER_COUNT = 10;

/** Build social URL from handle or use website as-is. */
function getSocialUrl(
  kind: keyof SpeakerSocialLinks,
  value: string | null | undefined
): string | null {
  if (!value || !String(value).trim()) return null;
  const raw = String(value).trim();
  const v = raw.replace(/^@/, '');
  switch (kind) {
    case 'website':
      return raw.startsWith('http') ? raw : `https://${raw}`;
    case 'twitter_handle':
      return `https://x.com/${v}`;
    case 'youtube_handle':
      return `https://www.youtube.com/@${v}`;
    case 'linkedin_handle':
      return `https://www.linkedin.com/in/${v}`;
    case 'instagram_handle':
      return `https://www.instagram.com/${v}`;
    case 'tiktok_handle':
      return `https://www.tiktok.com/@${v}`;
    default:
      return null;
  }
}

export default function TeamSection() {
  const { t } = useTranslation();
  const { speakers: contextSpeakers, speakersLoading } = useLumaData();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  const speakers = useMemo((): SpeakerGroupedWithMock[] => {
    const real = contextSpeakers;
    const mockCount = Math.max(0, TARGET_SPEAKER_COUNT - real.length);
    const mockSpeakers: SpeakerGroupedWithMock[] = Array.from({ length: mockCount }, () => ({
      api_id: '',
      name: '',
      avatarUrl: DEFAULT_SPEAKER_IMAGE,
      username: null,
      events: [],
      callForSpeakersUrl: CALL_FOR_SPEAKERS_URL,
    }));
    return [...real, ...mockSpeakers];
  }, [contextSpeakers]);

  useSectionTracking({ sectionId: 'team', sectionName: 'Team Section', category: 'Event Information' });

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/partners');
        if (response.ok) {
          const data = await response.json();
          setPartners(data.partners || []);
        }
      } catch (error) {
        console.error('Error fetching partners:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, []);

  return (
    <section id="team" className="text-center">
      {/* 主辦單位 Organizers */}
      <div id="organizer" className="py-20 md:py-28 lg:py-32 bg-[#F6F6F6]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.organizers.title}
          </motion.h2>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 opacity-70 hover:opacity-100 transition-all duration-500">
            {/* TDNA 獨立一排 */}
            <motion.a
              href="https://dna.org.tw"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative h-20 md:h-28 lg:h-32 w-auto block flex-shrink-0"
            >
              <Image
                src="/images/logo/tdna_logo.png"
                alt="Taiwan Digital Nomad Association"
                width={200}
                height={192}
                className="h-full w-auto object-contain"
                loading="lazy"
              />
            </motion.a>
            <div className="flex flex-col items-start gap-4 mt-4 md:mt-0">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="max-w-3xl text-base md:text-lg leading-relaxed text-[#4B4C47] text-center md:text-left"
              >
                {t.partners.organizers.description}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-4 justify-center md:justify-start w-full"
              >
                <a
                  href="https://www.instagram.com/dna.org.tw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="mailto:us@dna.org.tw"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                >
                  <Mail className="w-5 h-5" />
                </a>
                <a
                  href="https://dna.org.tw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                >
                  <Globe className="w-5 h-5" />
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Speakers 講者 */}
      <div id="speakers" className="py-20 md:py-28 lg:py-32 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.speakers.title}
          </motion.h2>

          {speakersLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E1F1C]"></div>
            </div>
          ) : speakers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
              {speakers.map((speaker, index) => {
                const visibleEvents = speaker.events.slice(0, MAX_EVENTS_VISIBLE);
                const restCount = speaker.events.length - MAX_EVENTS_VISIBLE;
                const profileUrl = speaker.callForSpeakersUrl ?? (speaker.api_id ? `${LUMA_USER_BASE}/${speaker.api_id}` : null);
                const social = speaker.social;
                const isMock = !!speaker.callForSpeakersUrl;

                const socialLinks: { kind: keyof SpeakerSocialLinks; href: string; icon: React.ReactNode; label: string }[] = [];
                if (!isMock && social) {
                  const w = getSocialUrl('website', social.website);
                  if (w) socialLinks.push({ kind: 'website', href: w, icon: <Globe className="w-4 h-4" />, label: 'Website' });
                  const tw = getSocialUrl('twitter_handle', social.twitter_handle);
                  if (tw) socialLinks.push({ kind: 'twitter_handle', href: tw, icon: <Twitter className="w-4 h-4" />, label: 'X' });
                  const yt = getSocialUrl('youtube_handle', social.youtube_handle);
                  if (yt) socialLinks.push({ kind: 'youtube_handle', href: yt, icon: <Youtube className="w-4 h-4" />, label: 'YouTube' });
                  const li = getSocialUrl('linkedin_handle', social.linkedin_handle);
                  if (li) socialLinks.push({ kind: 'linkedin_handle', href: li, icon: <Linkedin className="w-4 h-4" />, label: 'LinkedIn' });
                  const ig = getSocialUrl('instagram_handle', social.instagram_handle);
                  if (ig) socialLinks.push({ kind: 'instagram_handle', href: ig, icon: <Instagram className="w-4 h-4" />, label: 'Instagram' });
                  const tt = getSocialUrl('tiktok_handle', social.tiktok_handle);
                  if (tt) socialLinks.push({ kind: 'tiktok_handle', href: tt, icon: <ExternalLink className="w-4 h-4" />, label: 'TikTok' });
                }

                const CardMain = (
                  <>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-[#F6F6F6] border-2 border-[#E0E0E0] flex-shrink-0 mb-3">
                      {speaker.avatarUrl ? (
                        <Image
                          src={speaker.avatarUrl}
                          alt={isMock ? t.partners.speakers.mockLabel : speaker.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
                          unoptimized={speaker.avatarUrl.includes('lu.ma') || speaker.avatarUrl.includes('luma')}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#4B4C47]">
                          <User className="w-10 h-10 sm:w-12 sm:h-12" />
                        </div>
                      )}
                    </div>
                    <p className="font-semibold text-[#1E1F1C] text-sm sm:text-base line-clamp-2">
                      {isMock ? t.partners.speakers.mockLabel : speaker.name}
                    </p>
                    <div className="text-[#4B4C47] text-xs sm:text-sm mt-0.5 space-y-0.5 text-center w-full min-w-0">
                      {visibleEvents.map((ev, i) => (
                        <p key={i} className="line-clamp-2">
                          {ev.eventName}
                        </p>
                      ))}
                      {restCount > 0 && (
                        <p className="text-[#1E1F1C] font-medium">
                          {restCount}+
                        </p>
                      )}
                    </div>
                  </>
                );

                return (
                  <motion.div
                    key={speaker.callForSpeakersUrl ? `mock-${index}` : `${speaker.api_id || speaker.name}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    whileHover={{ y: -4 }}
                    className="flex flex-col items-center text-center"
                  >
                    {profileUrl ? (
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-[#1E1F1C] focus:ring-offset-2 rounded-2xl"
                      >
                        {CardMain}
                      </a>
                    ) : (
                      CardMain
                    )}
                    {socialLinks.length > 0 && (
                      <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap" role="group" aria-label="Social links">
                        {socialLinks.map(({ href, icon, label }) => (
                          <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                            aria-label={label}
                          >
                            {icon}
                          </a>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* 贊助單位 Sponsors */}
      <div className="py-20 md:py-28 lg:py-32 bg-[#F9D2E5]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.sponsors.title}
          </motion.h2>
          
          {/* Platinum Sponsors */}
          <div className="mb-16">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-display font-semibold text-[#1E1F1C] mb-8"
            >
              {t.partners.sponsors.platinum}
            </motion.h3>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 lg:gap-20">
              <motion.a
                href="https://www.taitung.gov.tw/"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative h-28 md:h-36 lg:h-44 w-28 md:w-36 lg:w-44 bg-white p-4 rounded-lg border-4 border-[#e4003d] flex items-center justify-center"
              >
                <Image
                  src="/images/logo/taitung_gov_logo.png"
                  alt="Taitung Government"
                  width={200}
                  height={192}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </motion.a>
              <motion.a
                href="https://www.hl.gov.tw/"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative h-28 md:h-36 lg:h-44 w-28 md:w-36 lg:w-44 bg-white p-4 rounded-lg border-4 border-[#e4003d] flex items-center justify-center"
              >
                <Image
                  src="/images/logo/hualien_gov_logo.png"
                  alt="Hualien Government"
                  width={200}
                  height={192}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </motion.a>
            </div>
          </div>

          {/* Gold Sponsors */}
          <div className="mb-16">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-display font-semibold text-[#1E1F1C] mb-8"
            >
              {t.partners.sponsors.gold}
            </motion.h3>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 lg:gap-20">
              {Array.from({ length: 3 }).map((_, index) => (
                <motion.a
                  key={`gold-${index}`}
                  href={t.partners.sponsors.cta?.href || '#'}
                  target={t.partners.sponsors.cta?.href?.startsWith('http') ? '_blank' : undefined}
                  rel={t.partners.sponsors.cta?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative h-24 md:h-32 lg:h-40 w-24 md:w-32 lg:w-40 bg-white p-4 rounded-lg border-4 border-[#ffd028] flex items-center justify-center"
                >
                  <Image
                    src="/images/default_sponsor.jpg"
                    alt="Sponsor"
                    width={160}
                    height={160}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Silver Sponsors */}
          <div className="mb-16">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-display font-semibold text-[#1E1F1C] mb-8"
            >
              {t.partners.sponsors.silver}
            </motion.h3>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 lg:gap-20">
              {Array.from({ length: 5 }).map((_, index) => (
                <motion.a
                  key={`silver-${index}`}
                  href={t.partners.sponsors.cta?.href || '#'}
                  target={t.partners.sponsors.cta?.href?.startsWith('http') ? '_blank' : undefined}
                  rel={t.partners.sponsors.cta?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative h-24 md:h-32 lg:h-40 w-24 md:w-32 lg:w-40 bg-white p-4 rounded-lg border-4 border-[#10b8d9] flex items-center justify-center"
                >
                  <Image
                    src="/images/default_sponsor.jpg"
                    alt="Sponsor"
                    width={160}
                    height={160}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Bronze Sponsors */}
          <div className="mb-16">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-display font-semibold text-[#1E1F1C] mb-8"
            >
              {t.partners.sponsors.bronze}
            </motion.h3>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 lg:gap-20">
              {Array.from({ length: 10 }).map((_, index) => (
                <motion.a
                  key={`bronze-${index}`}
                  href={t.partners.sponsors.cta?.href || '#'}
                  target={t.partners.sponsors.cta?.href?.startsWith('http') ? '_blank' : undefined}
                  rel={t.partners.sponsors.cta?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative h-24 md:h-32 lg:h-40 w-24 md:w-32 lg:w-40 bg-white p-4 rounded-lg border-4 border-[#00993e] flex items-center justify-center"
                >
                  <Image
                    src="/images/default_sponsor.jpg"
                    alt="Sponsor"
                    width={160}
                    height={160}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </motion.a>
              ))}
            </div>
          </div>
          
          {t.partners.sponsors.cta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex justify-center"
            >
              <motion.a
                href={t.partners.sponsors.cta.href}
                target={t.partners.sponsors.cta.href.startsWith('http') ? '_blank' : undefined}
                rel={t.partners.sponsors.cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                onClick={() => trackEvent('Lead', { content_name: 'Call for Sponsors', content_category: 'CTA', location: 'team_section' })}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full text-sm sm:text-base md:text-lg font-bold tracking-wide transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 bg-[#C54090] hover:bg-[#C54090]/90 text-white shadow-[#C54090]/30 hover:shadow-[#C54090]/50"
              >
                {t.partners.sponsors.cta.text}
              </motion.a>
            </motion.div>
          )}
        </div>
      </div>

      {/* 合作夥伴 Partners */}
      <div className="py-20 md:py-28 lg:py-32 bg-[#10B8D9]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.partners.title}
          </motion.h2>
          
          {/* Display Partners as Instagram Tag Style */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : partners.filter(p => p.name && p.name.trim().length > 0).length > 0 ? (
            <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 mb-12">
              {partners
                .filter(p => p.name && p.name.trim().length > 0)
                .map((partner, index) => {
                  const TagContent = (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className={`
                        inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5
                        bg-white/90 backdrop-blur-sm rounded-full
                        border border-white/30
                        shadow-md hover:shadow-lg
                        transition-all duration-300
                        ${partner.link ? 'cursor-pointer' : 'cursor-default'}
                      `}
                    >
                      <span className="text-[#1E1F1C] font-semibold text-sm md:text-base whitespace-nowrap">
                        {partner.name}
                      </span>
                      {partner.link && (
                        <ExternalLink className="w-4 h-4 md:w-5 md:h-5 text-[#1E1F1C] flex-shrink-0" />
                      )}
                    </motion.div>
                  );

                  return partner.link ? (
                    <motion.a
                      key={partner.name}
                      href={partner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackEvent('Lead', {
                          content_name: `${partner.name} Link`,
                          content_category: 'External Link',
                          link_type: 'partner_link',
                          location: 'team_section',
                          partner_name: partner.name,
                        });
                      }}
                    >
                      {TagContent}
                    </motion.a>
                  ) : (
                    <div key={partner.name}>
                      {TagContent}
                    </div>
                  );
                })}
            </div>
          ) : null}
          
          {t.partners.partners.cta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex justify-center"
            >
              <motion.a
                href={t.partners.partners.cta.href}
                target={t.partners.partners.cta.href.startsWith('http') ? '_blank' : undefined}
                rel={t.partners.partners.cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                onClick={() => trackEvent('Lead', { content_name: 'Call for Partners', content_category: 'CTA', location: 'team_section' })}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full text-sm sm:text-base md:text-lg font-bold tracking-wide transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 bg-white hover:bg-white/90 text-[#1E1F1C] shadow-white/20 hover:shadow-white/30"
              >
                {t.partners.partners.cta.text}
              </motion.a>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
