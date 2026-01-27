'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect } from 'react';
import { Instagram, Globe, Youtube, Twitter, Linkedin, Music } from 'lucide-react';

interface LumaPartner {
  name: string;
  logo?: string;
  instagram?: string;
  website?: string;
  youtube?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
}

export default function PartnersSection() {
  const { t } = useTranslation();
  const [lumaPartners, setLumaPartners] = useState<LumaPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLumaPartners = async () => {
      try {
        const response = await fetch('/api/luma-partners');
        if (response.ok) {
          const data = await response.json();
          setLumaPartners(data.partners || []);
        }
      } catch (error) {
        console.error('Error fetching Luma partners:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLumaPartners();
  }, []);
  
  return (
    <section id="partners" className="text-center">
      {/* 主辦單位 Organizers */}
      <div id="organizer" className="py-24 md:py-32 bg-[#F6F6F6]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-[#1E1F1C] mb-12"
          >
            {t.partners.organizers.title}
          </motion.h2>
          
          <div className="flex flex-col items-center gap-12 md:gap-16 lg:gap-20 opacity-70 hover:opacity-100 transition-all duration-500">
            {/* TDNA 獨立一排 */}
            <div className="relative h-28 md:h-36 lg:h-44 w-auto">
              <Image
                src="/images/logo/tdna_logo.png"
                alt="Taiwan Digital Nomad Association"
                width={200}
                height={192}
                className="h-full w-auto object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 贊助單位 Sponsors */}
      <div className="py-24 md:py-32 bg-[#F9D2E5]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-[#1E1F1C] mb-12"
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
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-6 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold tracking-wide transition-all shadow-lg bg-[#C54090] hover:bg-[#C54090]/80 text-white shadow-[#C54090]/20"
              >
                {t.partners.sponsors.cta.text}
              </motion.a>
            </motion.div>
          )}
        </div>
      </div>

      {/* 合作夥伴 Partners */}
      <div className="py-24 md:py-32 bg-[#10B8D9]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-white mb-12"
          >
            {t.partners.partners.title}
          </motion.h2>
          
          {/* Display Luma Partners */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : lumaPartners.filter(p => p.name && p.name.trim().length > 0).length > 0 ? (
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 mb-12">
              {lumaPartners
                .filter(p => p.name && p.name.trim().length > 0)
                .map((partner, index) => (
                <motion.div
                  key={partner.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center gap-4"
                >
                  {/* Partner Logo or Name */}
                  {partner.logo ? (
                    <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-full bg-white p-1 flex items-center justify-center">
                      <div className="relative w-full h-full rounded-full overflow-hidden">
                        <Image
                          src={partner.logo}
                          alt={partner.name}
                          width={128}
                          height={128}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to text if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-[#1E1F1C] font-bold text-lg">${partner.name}</span>`;
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-full bg-white flex items-center justify-center">
                      <span className="text-[#1E1F1C] font-bold text-sm md:text-base text-center px-2">
                        {partner.name}
                      </span>
                    </div>
                  )}
                  
                  {/* Partner Name */}
                  <h3 className="text-white font-semibold text-lg md:text-xl">
                    {partner.name}
                  </h3>
                  
                  {/* Social Links */}
                  <div className="flex flex-wrap gap-3 items-center justify-center">
                    {partner.instagram && (
                      <motion.a
                        href={partner.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label={`${partner.name} Instagram`}
                        title="Instagram"
                      >
                        <Instagram size={20} />
                      </motion.a>
                    )}
                    {partner.youtube && (
                      <motion.a
                        href={partner.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label={`${partner.name} YouTube`}
                        title="YouTube"
                      >
                        <Youtube size={20} />
                      </motion.a>
                    )}
                    {partner.twitter && (
                      <motion.a
                        href={partner.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label={`${partner.name} Twitter`}
                        title="Twitter"
                      >
                        <Twitter size={20} />
                      </motion.a>
                    )}
                    {partner.linkedin && (
                      <motion.a
                        href={partner.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label={`${partner.name} LinkedIn`}
                        title="LinkedIn"
                      >
                        <Linkedin size={20} />
                      </motion.a>
                    )}
                    {partner.tiktok && (
                      <motion.a
                        href={partner.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label={`${partner.name} TikTok`}
                        title="TikTok"
                      >
                        <Music size={20} />
                      </motion.a>
                    )}
                    {partner.website && (
                      <motion.a
                        href={partner.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label={`${partner.name} Website`}
                        title="Website"
                      >
                        <Globe size={20} />
                      </motion.a>
                    )}
                  </div>
                </motion.div>
              ))}
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
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-6 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold tracking-wide transition-all shadow-lg bg-white hover:bg-white/90 text-[#1E1F1C] shadow-[#004E9D]/20"
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
