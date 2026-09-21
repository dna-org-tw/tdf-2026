import { InstagramPost } from './types';
import AwardPostCard from './AwardPostCard';
import { useTranslation } from '@/hooks/useTranslation';

interface AwardPostsGridProps {
  posts: InstagramPost[];
  loading: boolean;
  votingPostId: string | null;
  onVoteClick: (post: InstagramPost, email: string) => void;
  onOpenFollowModal?: () => void;
}

export default function AwardPostsGrid({ posts, loading, votingPostId, onVoteClick, onOpenFollowModal }: AwardPostsGridProps) {
  const { t } = useTranslation();

  // Sort posts by vote count (descending)
  const sortedPosts = [...posts].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#10B8D9] border-t-transparent"></div>
        <p className="mt-4 text-white/60">{t.award?.posts?.loading || 'Loading posts...'}</p>
      </div>
    );
  }

  if (sortedPosts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60 text-lg">{t.award?.posts?.empty || 'No posts found'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedPosts.map((post, index) => (
        <AwardPostCard
          key={post.id}
          post={post}
          index={index}
          votingPostId={votingPostId}
          onVoteClick={onVoteClick}
          onOpenFollowModal={onOpenFollowModal}
        />
      ))}
    </div>
  );
}
