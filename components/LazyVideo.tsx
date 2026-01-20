'use client';

import { useState, useEffect, useRef } from 'react';

interface LazyVideoProps {
  src: string;
  poster?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * 延遲載入視頻組件 - 使用 Intersection Observer 只在進入視窗時載入
 * 大幅減少初始頁面載入時間，特別適合慢速網路環境
 */
export default function LazyVideo({ src, poster, className, 'aria-label': ariaLabel }: LazyVideoProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 使用 Intersection Observer 檢測元素是否進入視窗
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 當元素進入視窗時才開始載入視頻
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        // 提前 100px 開始載入，提升 UX
        rootMargin: '100px',
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 當視頻進入視窗後，自動播放（如果用戶允許）
  useEffect(() => {
    if (shouldLoad && videoRef.current) {
      const video = videoRef.current;
      
      // 設置自動播放屬性
      video.autoplay = true;
      
      // 嘗試自動播放，但尊重用戶偏好
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // 自動播放被阻止，這是正常的
            // 用戶可以點擊播放
          });
      }
    }
  }, [shouldLoad]);

  return (
    <div ref={containerRef} className={className}>
      {shouldLoad ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={ariaLabel}
          className="w-full h-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      ) : (
        // 顯示 poster 圖片或佔位符，減少初始載入
        poster ? (
          <img
            src={poster}
            alt={ariaLabel || 'Video thumbnail'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-stone-200 animate-pulse" />
        )
      )}
    </div>
  );
}
