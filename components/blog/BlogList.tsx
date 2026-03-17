'use client';

import PostCard from './PostCard';
import Pagination from './Pagination';
import type { GhostPost, GhostPagination } from '@/lib/ghost';

export default function BlogList({
  posts,
  pagination,
}: {
  posts: GhostPost[];
  pagination: GhostPagination;
}) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-slate-500">No posts yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
      </div>
      <Pagination pagination={pagination} />
    </>
  );
}
