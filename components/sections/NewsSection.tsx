'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { ExternalLink, Calendar, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

interface NewsPost {
  id: string;
  title: string;
  cover: string;
  summary: string;
  tag: string[];
  publishedTime: string;
  url: string;
  seoUrl: string;
  shortUrl: string;
  meta: {
    publisher: string;
  };
}

interface AotterResponse {
  totalElement: number;
  data: NewsPost[];
}

function formatDate(dateString: string, lang: string): string {
  const date = new Date(dateString);
  if (lang === 'zh') {
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function NewsCard({
  post,
  lang,
  readMore,
}: {
  post: NewsPost;
  lang: string;
  readMore: string;
}) {
  return (
    <a
      href={post.seoUrl || post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col md:flex-row md:h-[320px] rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-[#10B8D9]/50 hover:shadow-lg transition-all duration-300"
    >
      {post.cover && (
        <div className="relative w-full md:w-1/2 aspect-[1200/628] md:aspect-auto overflow-hidden bg-slate-100 flex-shrink-0">
          <Image
            src={post.cover}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      )}
      <div className="p-5 sm:p-6 md:p-8 flex flex-col justify-center md:overflow-y-auto">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <Calendar className="w-3.5 h-3.5" />
          <time dateTime={post.publishedTime}>
            {formatDate(post.publishedTime, lang)}
          </time>
          <span className="text-slate-300">·</span>
          <span>{post.meta.publisher}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 leading-snug mb-3 group-hover:text-[#10B8D9] transition-colors">
          {post.title}
        </h3>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4 line-clamp-3 md:line-clamp-4">
          {post.summary}
        </p>

        {post.tag && post.tag.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tag.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#10B8D9] group-hover:gap-2.5 transition-all">
          {readMore}
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </div>
    </a>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

function NewsCarousel({
  posts,
  lang,
  readMore,
}: {
  posts: NewsPost[];
  lang: string;
  readMore: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const total = posts.length;

  const scrollLeft = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const scrollRight = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goTo = useCallback(
    (i: number) => {
      setDirection(i > currentIndex ? 1 : -1);
      setCurrentIndex(i);
    },
    [currentIndex],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchDeltaX.current < -50) scrollRight();
    else if (touchDeltaX.current > 50) scrollLeft();
  }, [scrollLeft, scrollRight]);

  const showArrows = posts.length > 1;

  return (
    <div className="max-w-5xl mx-auto">
      {showArrows && (
        <div className="flex items-center justify-end mb-4 gap-1.5">
          <button
            onClick={scrollLeft}
            className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollRight}
            className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <NewsCard
              post={posts[currentIndex]}
              lang={lang}
              readMore={readMore}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {showArrows && (
        <div className="flex justify-center gap-1.5 mt-6">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'w-6 bg-[#10B8D9]'
                  : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewsSection() {
  const { t, lang } = useTranslation();
  useSectionTracking({ sectionId: 'news', sectionName: 'News' });
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchNews() {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error('Failed to fetch');
        const json: AotterResponse = await res.json();
        if (!cancelled) {
          setPosts(json.data || []);
        }
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNews();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && posts.length === 0) return null;

  return (
    <section
      id="news"
      className="bg-stone-50 py-20 md:py-28 lg:py-32 transition-colors duration-500"
    >
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-4">
            {t.news.title}
          </h2>
          <p className="text-lg md:text-xl text-[#1E1F1C]/80 max-w-3xl mx-auto leading-relaxed">
            {t.news.subtitle}
          </p>
        </motion.div>

        {loading ? (
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:h-[320px] rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
              <div className="w-full md:w-1/2 aspect-[1200/628] md:aspect-auto bg-slate-200" />
              <div className="p-5 sm:p-6 md:p-8 flex-1 space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-full" />
                <div className="h-6 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-200 rounded w-full" />
                <div className="h-4 bg-slate-200 rounded w-4/5" />
              </div>
            </div>
          </div>
        ) : (
          <NewsCarousel posts={posts} lang={lang} readMore={t.news.readMore} />
        )}
      </div>
    </section>
  );
}
