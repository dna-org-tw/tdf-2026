'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GhostPagination } from '@/lib/ghost';

export default function Pagination({
  pagination,
}: {
  pagination: GhostPagination;
}) {
  const { page, pages } = pagination;

  if (pages <= 1) return null;

  const pageNumbers: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(pages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) {
    pageNumbers.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-12" aria-label="Pagination">
      {page > 1 && (
        <Link
          href={`/blog?page=${page - 1}`}
          className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
      )}

      {start > 1 && (
        <>
          <Link
            href="/blog?page=1"
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            1
          </Link>
          {start > 2 && (
            <span className="w-10 h-10 flex items-center justify-center text-slate-400">
              ...
            </span>
          )}
        </>
      )}

      {pageNumbers.map((num) => (
        <Link
          key={num}
          href={`/blog?page=${num}`}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
            num === page
              ? 'bg-[#10B8D9] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          aria-current={num === page ? 'page' : undefined}
        >
          {num}
        </Link>
      ))}

      {end < pages && (
        <>
          {end < pages - 1 && (
            <span className="w-10 h-10 flex items-center justify-center text-slate-400">
              ...
            </span>
          )}
          <Link
            href={`/blog?page=${pages}`}
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {pages}
          </Link>
        </>
      )}

      {page < pages && (
        <Link
          href={`/blog?page=${page + 1}`}
          className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      )}
    </nav>
  );
}
