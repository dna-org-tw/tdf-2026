'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { trackEvent } from '@/components/FacebookPixel';

interface LazyYouTubeEmbedProps {
  videoId: string;
  title: string;
  thumbnailQuality?: 'default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault';
  autoPlayMuted?: boolean;
  loop?: boolean;
}

export default function LazyYouTubeEmbed({ 
  videoId, 
  title,
  thumbnailQuality = 'hqdefault', // Use hqdefault (480x360) instead of maxresdefault (1280x720) for better performance
  autoPlayMuted = false,
  loop = false,
}: LazyYouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Auto-play muted: load iframe and play when entering viewport (complies with browser autoplay-requires-mute policy)
  useEffect(() => {
    if (autoPlayMuted && isInView && !isLoaded) {
      setIsLoaded(true);
      trackEvent('ViewContent', {
        content_name: title,
        content_category: 'Video',
        content_type: 'video',
        content_ids: [videoId],
        video_id: videoId,
      });
    }
  }, [autoPlayMuted, isInView, isLoaded, title, videoId]);

  const handleClick = () => {
    setIsLoaded(true);
    trackEvent('ViewContent', {
      content_name: title,
      content_category: 'Video',
      content_type: 'video',
      content_ids: [videoId],
      video_id: videoId,
    });
  };

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${thumbnailQuality}.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&mute=${autoPlayMuted ? 1 : 0}&playsinline=1${loop ? `&loop=1&playlist=${videoId}` : ''}`;

  return (
    <div ref={containerRef} className="relative aspect-video w-full overflow-hidden">
      {!isLoaded && !autoPlayMuted ? (
        <button
          onClick={handleClick}
          className="relative w-full h-full group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:ring-offset-2"
          aria-label={`Play ${title}`}
        >
          {/* Thumbnail Image - Using unoptimized for external YouTube images */}
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 412px, (max-width: 1200px) 50vw, 600px"
            loading={isInView ? 'eager' : 'lazy'}
            unoptimized
          />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#10B8D9] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg
                className="w-10 h-10 md:w-12 md:h-12 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      ) : isLoaded ? (
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
