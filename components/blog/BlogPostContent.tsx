'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, Tag } from 'lucide-react';
import type { GhostPost } from '@/lib/ghost';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogPostContent({ post }: { post: GhostPost }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto px-4 sm:px-6"
    >
      {/* Back link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#10B8D9] hover:text-[#0EA5C4] transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Blog
      </Link>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#10B8D9]/10 text-[#10B8D9] font-medium"
            >
              <Tag className="w-3 h-3" />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#1E1F1C] leading-tight mb-6">
        {post.title}
      </h1>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-8 pb-8 border-b border-slate-200">
        {post.primary_author && (
          <div className="flex items-center gap-2">
            {post.primary_author.profile_image && (
              <Image
                src={post.primary_author.profile_image}
                alt={post.primary_author.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="font-medium text-slate-700">
              {post.primary_author.name}
            </span>
          </div>
        )}
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <time dateTime={post.published_at}>
            {formatDate(post.published_at)}
          </time>
        </span>
        {post.reading_time > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {post.reading_time} min read
          </span>
        )}
      </div>

      {/* Feature image */}
      {post.feature_image && (
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-10">
          <Image
            src={post.feature_image}
            alt={post.feature_image_alt || post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
          {post.feature_image_caption && (
            <p
              className="text-center text-xs text-slate-500 mt-3"
              dangerouslySetInnerHTML={{ __html: post.feature_image_caption }}
            />
          )}
        </div>
      )}

      {/* Content */}
      <div
        className="ghost-content prose prose-slate prose-lg max-w-none
          prose-headings:font-display prose-headings:text-[#1E1F1C]
          prose-a:text-[#10B8D9] prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-xl
          prose-blockquote:border-[#10B8D9]
          prose-code:text-[#10B8D9] prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-slate-200">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#10B8D9] hover:text-[#0EA5C4] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
      </div>
    </motion.article>
  );
}
