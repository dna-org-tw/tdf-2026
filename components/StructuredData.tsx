import { content } from '@/data/content';

interface StructuredDataProps {
  lang?: 'en' | 'zh';
}

export default function StructuredData({ lang = 'en' }: StructuredDataProps) {
  const t = content[lang];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fest.dna.org.tw';
  const currentDate = new Date().toISOString();
  const eventStartDate = '2026-05-01T00:00:00+08:00';
  const eventEndDate = '2026-05-31T23:59:59+08:00';

  // Organization Schema with sameAs (AEO关键优化)
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Taiwan Digital Nomad Association',
    alternateName: 'TDNA',
    url: 'https://dna.org.tw',
    logo: `${baseUrl}/images/logo/tdf2026_logo.png`,
    description: lang === 'en' 
      ? 'Taiwan Digital Nomad Association (TDNA) organizes Taiwan Digital Fest, a curated festival for digital nomads combining professional development with natural experiences in Taiwan.'
      : '台灣數位遊牧協會（TDNA）主辦台灣數位嘉年華，為數位遊牧者策劃結合專業發展與自然體驗的節慶活動。',
    sameAs: [
      'https://www.facebook.com/taiwandigitalfest',
      'https://www.instagram.com/taiwandigitalfest',
      'https://dna.org.tw',
      // AEO优化：实体链接到外部知识库，提升实体权威性
      // 如果TDNA有Wikipedia或Wikidata条目，可以添加：
      // 'https://en.wikipedia.org/wiki/Taiwan_Digital_Nomad_Association',
      // 'https://www.wikidata.org/wiki/Q...',
      // 也可以添加LinkedIn、Twitter等社交媒体链接
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'fest@dna.org.tw',
      contactType: 'Event Information',
    },
    foundingLocation: {
      '@type': 'Place',
      name: 'Taiwan',
    },
  };

  // Event Schema (AEO核心：事件结构化数据)
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    name: lang === 'en' ? 'Taiwan Digital Fest 2026' : '2026 台灣數位嘉年華',
    alternateName: 'TDF 2026',
    description: t.about.description,
    startDate: eventStartDate,
    endDate: eventEndDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: [
      {
        '@type': 'Place',
        name: 'Taitung, Taiwan',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Taitung',
          addressRegion: 'Taitung County',
          addressCountry: 'TW',
        },
      },
      {
        '@type': 'Place',
        name: 'Hualien, Taiwan',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Hualien',
          addressRegion: 'Hualien County',
          addressCountry: 'TW',
        },
      },
    ],
    organizer: {
      '@type': 'Organization',
      name: 'Taiwan Digital Nomad Association',
      url: 'https://dna.org.tw',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Explorer',
        description: t.tickets.explore.features.join(', '),
        category: 'Explorer',
      },
      {
        '@type': 'Offer',
        name: 'Contributor',
        description: t.tickets.contribute.features.join(', '),
        category: 'Contributor',
      },
      {
        '@type': 'Offer',
        name: 'Backer',
        description: t.tickets.backer.features.join(', '),
        category: 'Backer',
      },
    ],
    keywords: t.about.tags.join(', '),
    inLanguage: lang === 'en' ? 'en' : 'zh-TW',
    audience: {
      '@type': 'Audience',
      audienceType: 'Digital Nomads, Remote Workers, Entrepreneurs, Creators',
    },
  };

  // FAQPage Schema (AEO优化：问答结构化数据)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: lang === 'en' ? 'Home' : '首頁',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: lang === 'en' ? 'Taiwan Digital Fest 2026' : '2026 台灣數位嘉年華',
        item: `${baseUrl}${lang === 'en' ? '?lang=en' : '?lang=zh'}`,
      },
    ],
  };

  // WebSite Schema with SearchAction
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: lang === 'en' ? 'Taiwan Digital Fest 2026' : '2026 台灣數位嘉年華',
    url: baseUrl,
    description: t.hero.subtitle,
    publisher: {
      '@type': 'Organization',
      name: 'Taiwan Digital Nomad Association',
    },
    inLanguage: [lang === 'en' ? 'en' : 'zh-TW'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  // AEO优化：结构化数据脚本，Next.js会自动将其放在head中
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
