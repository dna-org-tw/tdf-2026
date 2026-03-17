'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react';
import type { GhostPost } from '@/lib/ghost';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PostCard({
  post,
  index = 0,
}: {
  post: GhostPost;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Link
        href={`/blog/${post.slug}`}
        className="group flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-[#10B8D9]/50 hover:shadow-lg transition-all duration-300"
      >
        {post.feature_image && (
          <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-100">
            <Image
              src={post.feature_image}
              alt={post.feature_image_alt || post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}

        <div className="p-5 sm:p-6 flex flex-col flex-1">
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <time dateTime={post.published_at}>
                {formatDate(post.published_at)}
              </time>
            </span>
            {post.reading_time > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {post.reading_time} min read
                </span>
              </>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug mb-2 group-hover:text-[#10B8D9] transition-colors line-clamp-2">
            {post.title}
          </h3>

          <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3 flex-1">
            {post.excerpt}
          </p>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                >
                  <Tag className="w-3 h-3" />
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#10B8D9] group-hover:gap-2.5 transition-all mt-auto">
            Read more
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
