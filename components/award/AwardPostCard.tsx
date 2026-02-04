import { useState } from 'react';
import Image from 'next/image';
import { Trophy, Heart, MessageCircle, Play, Image as ImageIcon, Users, Hash } from 'lucide-react';
import { InstagramPost } from './types';
import { getPostImage, getPostLink, getPostUsername, formatNumber, formatDate } from './utils';
import { useTranslation } from '@/hooks/useTranslation';
import VoteEmailModal from './VoteEmailModal';

interface AwardPostCardProps {
  post: InstagramPost;
  index: number;
  votingPostId: string | null;
  onVoteClick: (post: InstagramPost, email: string) => void;
  onOpenFollowModal?: () => void;
}

export default function AwardPostCard({ post, index, votingPostId, onVoteClick, onOpenFollowModal }: AwardPostCardProps) {
  const { t, lang } = useTranslation();
  const [showEmailModal, setShowEmailModal] = useState(false);

  const postImage = getPostImage(post);
  const postLink = getPostLink(post);
  const postUsername = getPostUsername(post);
  const postType = post.type || post.post_type || 'Image';
  const childPosts = post.child_posts || post.childPosts || [];
  const hasMultipleImages = (post.images && post.images.length > 1) || childPosts.length > 0;
  const likesCount = post.likes_count ?? post.likesCount ?? 0;
  const commentsCount = post.comments_count ?? post.commentsCount ?? 0;
  const videoPlayCount = post.video_play_count ?? post.videoPlayCount ?? 0;
  const taggedUsers = post.tagged_users || post.taggedUsers || [];
  const coauthorProducers = post.coauthor_producers || post.coauthorProducers || [];
  const hashtags = post.hashtags || [];

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 hover:border-[#10B8D9]/50 transition-all duration-300 relative flex flex-col">
      {/* Rank Badge */}
      {index < 3 && (
        <div className="absolute top-4 left-4 z-10">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
          }`}>
            {index + 1}
          </div>
        </div>
      )}

      {/* Post Type Badge */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 text-white text-xs">
          {postType === 'Video' || postType === 'Reel' ? (
            <Play className="w-3 h-3" />
          ) : postType === 'Sidecar' ? (
            <ImageIcon className="w-3 h-3" />
          ) : (
            <ImageIcon className="w-3 h-3" />
          )}
          <span>{postType}</span>
        </div>
      </div>

      {/* Carousel Indicator */}
      {hasMultipleImages && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-white text-xs">
            {post.images?.length || childPosts.length || 0} {lang === 'en' ? 'photos' : '張照片'}
          </div>
        </div>
      )}

      {/* Post Image/Video */}
      <a
        href={postLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-square bg-white/5"
      >
        {postImage ? (
          <Image
            src={postImage}
            alt={post.caption || 'Instagram post'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}
      </a>

      {/* Post Info */}
      <div className="p-4 flex flex-col h-full min-h-[200px]">
        <div className="flex-1">
          {/* User Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <a
                href={`https://instagram.com/${postUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#10B8D9] hover:underline text-sm font-semibold truncate"
              >
                @{postUsername}
              </a>
              {(post.owner_full_name || post.ownerFullName) && (
                <span className="text-white/50 text-xs truncate">
                  ({post.owner_full_name || post.ownerFullName})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-white/60 text-sm flex-shrink-0">
              <Trophy className="w-4 h-4 text-[#10B8D9]" />
              <span className="font-semibold">{post.vote_count || 0}</span>
            </div>
          </div>

          {/* Co-authors */}
          {coauthorProducers.length > 0 && (
            <div className="mb-2 flex items-center gap-1 flex-wrap">
              <Users className="w-3 h-3 text-white/50" />
              <span className="text-white/50 text-xs">
                {lang === 'en' ? 'Co-authored with' : '共同創作：'}
              </span>
              {coauthorProducers.slice(0, 2).map((coauthor, idx) => (
                <a
                  key={coauthor.id}
                  href={`https://instagram.com/${coauthor.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#10B8D9] hover:underline text-xs"
                >
                  @{coauthor.username}
                  {idx < coauthorProducers.length - 1 && idx < 1 && ','}
                </a>
              ))}
              {coauthorProducers.length > 2 && (
                <span className="text-white/50 text-xs">+{coauthorProducers.length - 2}</span>
              )}
            </div>
          )}

          {/* Engagement Stats */}
          <div className="flex items-center gap-4 mb-3 text-white/60 text-xs">
            {likesCount > 0 && (
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                <span>{formatNumber(likesCount)}</span>
              </div>
            )}
            {commentsCount > 0 && (
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                <span>{formatNumber(commentsCount)}</span>
              </div>
            )}
            {videoPlayCount > 0 && (
              <div className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                <span>{formatNumber(videoPlayCount)}</span>
              </div>
            )}
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="text-white/70 text-sm mb-3 line-clamp-3">
              {post.caption}
            </p>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="mb-2 flex items-center gap-1 flex-wrap">
              <Hash className="w-3 h-3 text-white/50" />
              {hashtags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[#10B8D9] text-xs">
                  #{tag}
                </span>
              ))}
              {hashtags.length > 3 && (
                <span className="text-white/50 text-xs">+{hashtags.length - 3}</span>
              )}
            </div>
          )}

          {/* Tagged Users */}
          {taggedUsers.length > 0 && (
            <div className="mb-2 flex items-center gap-1 flex-wrap">
              <Users className="w-3 h-3 text-white/50" />
              <span className="text-white/50 text-xs">
                {lang === 'en' ? 'Tagged' : '標記：'}
              </span>
              {taggedUsers.slice(0, 2).map((user, idx) => (
                <a
                  key={user.id}
                  href={`https://instagram.com/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#10B8D9] hover:underline text-xs"
                >
                  @{user.username}
                  {idx < taggedUsers.length - 1 && idx < 1 && ','}
                </a>
              ))}
              {taggedUsers.length > 2 && (
                <span className="text-white/50 text-xs">+{taggedUsers.length - 2}</span>
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-white/40 text-xs mb-3">
            {formatDate(post.timestamp, lang)}
          </div>
        </div>

        {/* Vote Button */}
        <button
          onClick={() => setShowEmailModal(true)}
          disabled={votingPostId === post.id || post.has_voted}
          className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 mt-auto ${
            post.has_voted
              ? 'bg-white/10 text-white/50 cursor-not-allowed'
              : votingPostId === post.id
              ? 'bg-[#10B8D9]/50 text-white cursor-wait'
              : 'bg-[#10B8D9] hover:bg-[#0EA5C4] text-white'
          }`}
        >
          {votingPostId === post.id
            ? t.award?.posts?.voting || 'Voting...'
            : post.has_voted
            ? t.award?.posts?.voted || 'Voted'
            : t.award?.posts?.vote || 'Vote'}
        </button>
      </div>

      {/* Vote Email Modal */}
      <VoteEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onEmailSubmit={(email) => {
          setShowEmailModal(false);
          onVoteClick(post, email);
        }}
        onOpenFollowModal={onOpenFollowModal}
        postId={post.id}
      />
    </div>
  );
}
