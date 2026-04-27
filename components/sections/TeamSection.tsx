'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect, useMemo } from 'react';
import { trackEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useLumaData } from '@/contexts/LumaDataContext';
import { ExternalLink, Instagram, Mail, Globe, User, Youtube, Linkedin, Twitter, X, ArrowRight } from 'lucide-react';
import type { SpeakerGrouped, SpeakerSocialLinks } from '@/lib/lumaSpeakers';
import { teamMembers } from '@/data/team';
import { MessageCircle } from 'lucide-react';

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
    case 'linkedin_handle': {
      if (raw.startsWith('http')) return raw;
      const handle = v
        .replace(/^(?:www\.)?linkedin\.com\//i, '')
        .replace(/^\/+/, '')
        .replace(/^in\//i, '')
        .replace(/\/+$/, '');
      return `https://www.linkedin.com/in/${handle}`;
    }
    case 'instagram_handle':
      return `https://www.instagram.com/${v}`;
    case 'tiktok_handle':
      return `https://www.tiktok.com/@${v}`;
    default:
      return null;
  }
}

function CoOrganizerPhoto({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const hasMany = images.length > 1;

  useEffect(() => {
    if (!hasMany) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasMany, images.length]);

  if (images.length === 0) return null;

  return (
    <div className="relative h-48 md:h-56 lg:h-64 w-72 md:w-80 lg:w-96 flex-shrink-0 rounded-2xl overflow-hidden bg-[#F4F4F4]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={images[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <Image
            src={images[index]}
            alt={alt}
            fill
            sizes="(max-width: 768px) 288px, (max-width: 1024px) 320px, 384px"
            className="object-cover"
            loading="lazy"
          />
        </motion.div>
      </AnimatePresence>
      {hasMany && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CoOrganizerRowProps {
  name?: string;
  description?: string;
  images: string[];
  fallbackName: string;
  marginTop?: boolean;
}

function CoOrganizerRow({ name, description, images, fallbackName, marginTop = true }: CoOrganizerRowProps) {
  return (
    <div className={`flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 opacity-70 hover:opacity-100 transition-all duration-500${marginTop ? ' mt-16 md:mt-20' : ''}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <CoOrganizerPhoto images={images} alt={name || fallbackName} />
      </motion.div>
      <div className="flex flex-col items-start gap-4 mt-4 md:mt-0">
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xl md:text-2xl font-display font-bold text-[#1E1F1C]"
        >
          {name}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-3xl text-base md:text-lg leading-relaxed text-[#4B4C47] text-center md:text-left"
        >
          {description}
        </motion.p>
      </div>
    </div>
  );
}

const CO_ORGANIZER_KEYS = [
  {
    key: 'nanhueiAlliance' as const,
    fallbackName: '南迴永續旅行聯盟',
    images: ['/images/partners/nanhuei_alliance.jpg'],
  },
  {
    key: 'yuanNatural' as const,
    fallbackName: '源天然股份有限公司',
    images: ['/images/partners/yuan_natural.jpg'],
  },
  {
    key: 'rootsCoworking' as const,
    fallbackName: '旅蒔共享工作空間（Roots Coworking）',
    images: [
      '/images/partners/roots/01.jpg',
      '/images/partners/roots/02.jpg',
      '/images/partners/roots/03.jpg',
      '/images/partners/roots/04.jpg',
    ],
  },
  {
    key: 'herflow' as const,
    fallbackName: '合流生活提案所（HerFlow）',
    images: ['/images/partners/herflow.jpeg'],
  },
  {
    key: 'tsaomin' as const,
    fallbackName: '草民 Tsaomin Brunch',
    images: [
      '/images/partners/tsaomin/01.jpg',
      '/images/partners/tsaomin/02.jpg',
      '/images/partners/tsaomin/03.jpg',
      '/images/partners/tsaomin/04.jpg',
      '/images/partners/tsaomin/05.jpg',
      '/images/partners/tsaomin/06.jpg',
      '/images/partners/tsaomin/07.jpg',
      '/images/partners/tsaomin/08.jpg',
      '/images/partners/tsaomin/09.jpg',
    ],
  },
];

export default function TeamSection() {
  const { t } = useTranslation();
  const { speakers: contextSpeakers, speakersLoading } = useLumaData();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<(typeof teamMembers)[number] | null>(null);

  const speakers = useMemo((): SpeakerGroupedWithMock[] => {
    const real = [...contextSpeakers].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
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
                {t.partners.organizers.tdna?.description}
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

          {/* 台東縣政府 Taitung County Government */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 opacity-70 hover:opacity-100 transition-all duration-500 mt-16 md:mt-20">
            <motion.a
              href="https://www.taitung.gov.tw/"
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
                src="/images/logo/taitung_gov_logo.png"
                alt="Taitung County Government"
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
                {t.partners.organizers.taitungGov?.description}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-4 justify-center md:justify-start w-full"
              >
                <a
                  href="https://www.instagram.com/tt.nomads/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.facebook.com/taitung.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a
                  href="https://www.taitung.gov.tw/"
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

      {/* 協辦單位 Co-Organizers */}
      <div id="co-organizer" className="py-20 md:py-28 lg:py-32 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.coOrganizers?.title}
          </motion.h2>

          {CO_ORGANIZER_KEYS.map((entry, idx) => {
            const data = t.partners.coOrganizers?.[entry.key];
            return (
              <CoOrganizerRow
                key={entry.key}
                name={data?.name}
                description={data?.description}
                images={entry.images}
                fallbackName={entry.fallbackName}
                marginTop={idx > 0}
              />
            );
          })}

        </div>
      </div>

      {/* 官方平台 Nomad Taiwan — 書腰 obi banner */}
      {t.partners.officialPlatform && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="block w-full overflow-hidden shadow-[0_4px_30px_rgba(13,74,109,0.25)]"
        >
          <div className="relative bg-gradient-to-r from-[#0d4a6d] via-[#1d6e8a] to-[#3d7dc9] px-6 sm:px-12 lg:px-20 py-8 sm:py-10">
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none overflow-hidden">
              <svg className="absolute -top-10 -right-10 w-72 h-72" viewBox="0 0 200 200" fill="white">
                <path d="M100 10L190 90V190H10V90L100 10Z" />
              </svg>
              <svg className="absolute -bottom-8 left-[20%] w-40 h-40" viewBox="0 0 200 200" fill="white">
                <path d="M100 10L190 90V190H10V90L100 10Z" />
              </svg>
              <svg className="absolute top-2 left-[60%] w-28 h-28" viewBox="0 0 200 200" fill="white">
                <path d="M100 10L190 90V190H10V90L100 10Z" />
              </svg>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-6 sm:gap-12">
              <div className="flex-shrink-0">
                <div className="relative w-[220px] sm:w-[280px] h-[60px] sm:h-[76px]">
                  <Image
                    src={t.partners.officialPlatform.logoWhite}
                    alt={t.partners.officialPlatform.name}
                    fill
                    sizes="(max-width: 640px) 220px, 280px"
                    className="object-contain"
                  />
                </div>
                {t.partners.officialPlatform.tagline && (
                  <p className="text-white/60 text-xs sm:text-sm mt-2 text-center sm:text-left tracking-wider uppercase">
                    {t.partners.officialPlatform.tagline}
                  </p>
                )}
              </div>

              <div className="hidden sm:block w-px self-stretch bg-white/20 flex-shrink-0" />

              <div className="flex-1 text-center sm:text-left">
                <p className="text-white text-sm sm:text-base lg:text-lg leading-relaxed mb-4">
                  {t.partners.officialPlatform.description}
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  {t.partners.officialPlatform.features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-block px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-shrink-0 hidden sm:flex flex-col gap-2">
                {t.partners.officialPlatform.ctas.map((c) => (
                  <a
                    key={c.url}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/cta flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-full px-6 py-3 transition-colors duration-300"
                  >
                    <span className="text-white text-sm font-bold whitespace-nowrap">
                      {c.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white group-hover/cta:translate-x-1 transition-transform duration-300" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:hidden flex flex-col">
            {t.partners.officialPlatform.ctas.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/cta bg-[#0a3a55] hover:bg-[#072a3f] px-6 py-3 flex items-center justify-center gap-2 transition-colors duration-300 border-t border-white/10"
              >
                <span className="text-white text-sm font-bold">{c.label}</span>
                <ArrowRight className="w-4 h-4 text-white group-hover/cta:translate-x-1 transition-transform duration-300" />
              </a>
            ))}
          </div>
        </motion.div>
      )}

      {/* 執行團隊 Organizing Team */}
      <div id="organizing-team" className="py-20 md:py-28 lg:py-32 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-4 md:mb-6"
          >
            {t.partners.team.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#4B4C47] text-base md:text-lg mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.team.subtitle}
          </motion.p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
            {teamMembers.map((member, index) => (
              <motion.button
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedMember(member)}
                className="flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="relative w-[clamp(5.5rem,32vw,8rem)] h-[clamp(5.5rem,32vw,8rem)] rounded-full overflow-hidden bg-[#F6F6F6] border-2 border-[#E0E0E0] group-hover:border-[#C54090] transition-colors flex-shrink-0 mb-3 aspect-square">
                  <Image
                    src={member.photo || '/images/team/placeholder.svg'}
                    alt={member.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
                  />
                </div>
                <p className="font-semibold text-[#1E1F1C] text-sm sm:text-base line-clamp-2">
                  {member.name}
                </p>
                <p className="text-[#C54090] text-xs sm:text-sm font-medium mt-0.5">
                  {member.title}
                </p>
                {member.bio && (
                  <p className="text-[#4B4C47] text-xs mt-1 text-center w-full min-w-0 line-clamp-3">
                    {member.bio}
                  </p>
                )}
                {(member.email || member.instagram || member.website || member.whatsapp) && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                    {member.website && (
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47]">
                        <Globe className="w-4 h-4" />
                      </span>
                    )}
                    {member.instagram && (
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47]">
                        <Instagram className="w-4 h-4" />
                      </span>
                    )}
                    {member.email && (
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47]">
                        <Mail className="w-4 h-4" />
                      </span>
                    )}
                    {member.whatsapp && (
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47]">
                        <MessageCircle className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Team Member Modal */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
              onClick={() => setSelectedMember(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[101] flex items-center justify-center p-4"
              onClick={() => setSelectedMember(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative p-6 sm:p-8">
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#F6F6F6] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col items-center text-center">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[#F6F6F6] border-2 border-[#E0E0E0] mb-4">
                      <Image
                        src={selectedMember.photo || '/images/team/placeholder.svg'}
                        alt={selectedMember.name}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-[#1E1F1C]">
                      {selectedMember.name}
                    </h3>
                    <p className="text-[#C54090] font-medium mt-1">
                      {selectedMember.title}
                    </p>
                    {selectedMember.bio && (
                      <p className="text-[#4B4C47] text-sm leading-relaxed mt-4">
                        {selectedMember.bio}
                      </p>
                    )}
                    {(selectedMember.email || selectedMember.instagram || selectedMember.website || selectedMember.whatsapp) && (
                      <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
                        {selectedMember.website && (
                          <a href={selectedMember.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors" aria-label="Website">
                            <Globe className="w-5 h-5" />
                          </a>
                        )}
                        {selectedMember.instagram && (
                          <a href={selectedMember.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors" aria-label="Instagram">
                            <Instagram className="w-5 h-5" />
                          </a>
                        )}
                        {selectedMember.email && (
                          <a href={`mailto:${selectedMember.email}`} className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors" aria-label="Email">
                            <Mail className="w-5 h-5" />
                          </a>
                        )}
                        {selectedMember.whatsapp && (
                          <a href={`https://wa.me/${selectedMember.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F6F6F6] border border-[#E0E0E0] text-[#4B4C47] hover:bg-[#1E1F1C] hover:text-white transition-colors" aria-label="WhatsApp">
                            <MessageCircle className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Speakers 講者 */}
      <div id="speakers" className="py-20 md:py-28 lg:py-32 bg-[#F6F6F6]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-4 md:mb-6"
          >
            {t.partners.speakers.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#4B4C47] text-base md:text-lg mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.speakers.subtitle}
          </motion.p>

          {speakersLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E1F1C]"></div>
            </div>
          ) : speakers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-8">
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

                const CardProfile = (
                  <>
                    <div className="relative w-[clamp(5.5rem,32vw,8rem)] h-[clamp(5.5rem,32vw,8rem)] rounded-full overflow-hidden bg-[#F6F6F6] border-2 border-[#E0E0E0] flex-shrink-0 mb-3 aspect-square">
                      {speaker.avatarUrl ? (
                        <Image
                          src={speaker.avatarUrl}
                          alt={isMock ? t.partners.speakers.mockLabel : speaker.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
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
                    {!isMock && speaker.bioShort && (
                      <p className="text-[#4B4C47] text-xs mt-1 text-center w-full min-w-0 line-clamp-3">
                        {speaker.bioShort}
                      </p>
                    )}
                  </>
                );

                const EventBadges = (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2 w-full min-w-0">
                    {visibleEvents.map((ev, i) =>
                      ev.eventUrl ? (
                        <a
                          key={i}
                          href={ev.eventUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E0E0E0] text-[#1E1F1C] hover:bg-[#1E1F1C] hover:text-white transition-colors line-clamp-1 max-w-full"
                          title={ev.eventName}
                        >
                          <span className="truncate">{ev.eventName}</span>
                        </a>
                      ) : (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E0E0E0] text-[#1E1F1C] line-clamp-1 max-w-full"
                          title={ev.eventName}
                        >
                          <span className="truncate">{ev.eventName}</span>
                        </span>
                      )
                    )}
                    {restCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1E1F1C] text-white">
                        +{restCount}
                      </span>
                    )}
                  </div>
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
                        {CardProfile}
                      </a>
                    ) : (
                      CardProfile
                    )}
                    {EventBadges}
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

      {/* 贊助單位 Sponsors - 暫時隱藏 */}
      {false && <div className="py-20 md:py-28 lg:py-32 bg-[#F9D2E5]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-10 md:mb-12 lg:mb-16"
          >
            {t.partners.sponsors.title}
          </motion.h2>
          
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
      </div>}

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
