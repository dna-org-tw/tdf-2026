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
      // AEO 優化：實體連結到外部知識庫，提升實體權威性
      // 如果TDNA有Wikipedia或Wikidata条目，可以添加：
      // 'https://en.wikipedia.org/wiki/Taiwan_Digital_Nomad_Association',
      // 'https://www.wikidata.org/wiki/Q...',
      // 也可以添加 LinkedIn、Twitter 等社群媒體連結
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

  // Event Schema (SEO核心：事件结构化数据 - 優化關鍵字)
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    name: lang === 'en' ? 'Taiwan Digital Fest 2026' : '2026 台灣數位嘉年華',
    alternateName: [
      'TDF 2026',
      'Digital Nomad Event 2026 Taiwan',
      'Remote Work Summit 2026',
      'Global Nomad Meetup Taiwan',
      'Location Independent Event Taiwan',
      'Taitung Digital Nomad Event',
      'Hualien Digital Nomad Event',
    ],
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
        name: 'Explorer Event Pass',
        description: t.tickets.explore.features.join(', '),
        category: 'Explorer',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Contributor Event Pass',
        description: t.tickets.contribute.features.join(', '),
        category: 'Contributor',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Backer VIP Event Pass',
        description: t.tickets.backer.features.join(', '),
        category: 'Backer',
        availability: 'https://schema.org/InStock',
      },
    ],
    keywords: [
      ...t.about.tags,
      'Digital Nomad Event',
      'Remote Work Summit',
      'Location Independent Event',
      'Global Nomad Meetup',
      'Entrepreneurship Event',
      'Freelancer Summit',
      'Online Business Expo',
      'Geo-arbitrage',
      'Async Work',
      'Bootstrapping',
      'Solopreneur',
      'Indie Hacker',
      'Work-Life Balance',
      'Slow Travel',
      'Nomad Tribe',
      'Cost of living Taiwan',
      'Coworking spaces Taiwan',
      'Visa for digital nomads Taiwan',
      'Early bird tickets',
      'Event Pass',
      'VIP Access',
    ].join(', '),
    inLanguage: lang === 'en' ? 'en' : 'zh-TW',
    audience: {
      '@type': 'Audience',
      audienceType: 'Digital Nomads, Remote Workers, Location Independent Entrepreneurs, Solopreneurs, Indie Hackers, Freelancers, Bootstrapped Founders, Online Business Owners',
    },
    about: {
      '@type': 'Thing',
      name: 'Digital Nomad Lifestyle, Remote Work, Location Independence, Geo-arbitrage, Async Work, Bootstrapping, Solopreneurship',
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

  // LocalBusiness Schema for locations (Local SEO optimization)
  const locationSchema = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: lang === 'en' ? 'Taitung & Hualien - Digital Nomad Destinations' : '台東與花蓮 - 數位遊牧目的地',
    description: lang === 'en' 
      ? 'Taitung and Hualien, Taiwan: Premier digital nomad destinations offering cost-effective living, fast internet, coworking spaces, and visa-free entry for remote workers.'
      : '台東與花蓮，台灣：頂級數位遊牧目的地，提供高性價比生活、快速網路、共創空間和免簽入境。',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Taitung & Hualien',
      addressRegion: 'Taiwan',
      addressCountry: 'TW',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '23.0',
      longitude: '121.2',
    },
    containsPlace: [
      {
        '@type': 'City',
        name: 'Taitung',
        description: 'Taitung, Taiwan: Best digital nomad destination with slow travel, indigenous culture, and cost-effective coliving options.',
      },
      {
        '@type': 'City',
        name: 'Hualien',
        description: 'Hualien, Taiwan: Digital nomad hub with coworking spaces, specialty coffee shops, and proximity to Taroko Gorge.',
      },
    ],
  };

  // AEO 優化：結構化數據腳本，Next.js 會自動將其放在 head 中
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(locationSchema) }}
      />
    </>
  );
}
