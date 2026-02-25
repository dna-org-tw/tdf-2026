'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { trackEvent } from '@/components/FacebookPixel';
import Navbar from '@/components/Navbar';
import FollowModalWithForm from '@/components/FollowModalWithForm';
import AwardHeader from '@/components/award/AwardHeader';
import AwardsInfo from '@/components/award/AwardsInfo';
import VotingInstructions from '@/components/award/VotingInstructions';
import AwardRules from '@/components/award/AwardRules';
import AwardError from '@/components/award/AwardError';
import AwardPostsGrid from '@/components/award/AwardPostsGrid';
import { InstagramPost } from '@/components/award/types';

// 動態導入 Footer 以優化性能
const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null,
});

export default function AwardPage() {
  const { t, lang } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('vote');
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingPostId, setVotingPostId] = useState<string | null>(null);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ postId: string; email: string } | null>(null);

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Nomad Award Page',
      content_category: 'Award',
    });

    // 每次載入頁面時都抓取 Instagram Reels
    // 先抓取 Reels，抓取完成後再載入貼文列表
    const initializePage = async () => {
      await fetchReels();
      // 抓取完成後載入貼文（fetchReels 內部也會調用 loadPosts，這裡作為備用）
      loadPosts();
    };

    initializePage();
  }, []);

  const fetchReels = async () => {
    try {
      // 調用 API 來抓取 Instagram Reels（每次都會執行，無緩存）
      const response = await fetch('/api/award/fetch-reels', {
        method: 'GET',
        cache: 'no-store', // 確保不使用緩存
      });

      if (response.ok) {
        // 抓取完成後重新載入貼文列表以顯示最新內容
        await loadPosts();
      } else {
        const errorText = await response.text();
        console.warn('[Award Page] Failed to fetch reels:', response.status, errorText);
        // 即使抓取失敗，也繼續載入現有貼文
      }
    } catch (err) {
      console.error('[Award Page] Error fetching reels:', err);
      // 即使抓取失敗，也繼續載入現有貼文
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/award/posts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t.award?.posts?.error || 'Failed to load posts');
      }

      if (!data.posts) {
        console.warn('[Award Page] No posts in response data:', data);
      }

      // 處理所有貼文數據，統一格式並計算投票數（不進行任何過濾）
      const processedPosts = (data.posts || []).map((post: InstagramPost) => {
        // 統一欄位名稱（處理不同的命名風格）
        const processedPost: InstagramPost = {
          ...post,
          // 统一 permalink/url
          permalink: post.permalink || post.url || `https://www.instagram.com/p/${post.short_code || ''}/`,
          // 统一 media_url/display_url
          media_url: post.media_url || post.display_url || post.displayUrl || (post.images && post.images[0]) || '',
          // 统一 username
          username: post.username || post.owner_username || post.ownerUsername || '',
          // 统一 caption
          caption: post.caption || '',
          // 统一 timestamp
          timestamp: post.timestamp || new Date().toISOString(),
          // 统一类型
          type: post.type || post.post_type || 'Image',
          // 統一互動數據
          likes_count: post.likes_count ?? post.likesCount ?? 0,
          comments_count: post.comments_count ?? post.commentsCount ?? 0,
          video_play_count: post.video_play_count ?? post.videoPlayCount ?? 0,
          // 統一用戶資訊
          owner_username: post.owner_username || post.ownerUsername || post.username || '',
          owner_full_name: post.owner_full_name || post.ownerFullName || '',
          // 统一 childPosts
          child_posts: post.child_posts || post.childPosts || [],
          // 统一 taggedUsers
          tagged_users: post.tagged_users || post.taggedUsers || [],
          // 统一 coauthorProducers
          coauthor_producers: post.coauthor_producers || post.coauthorProducers || [],
          // 投票數（從 vote_count 獲取，如果沒有則預設為 0）
          vote_count: post.vote_count || 0,
        };
        return processedPost;
      });

      // 確保顯示所有貼文，不做任何過濾
      if (processedPosts.length === 0) {
        console.warn('[Award Page] No posts to display. Check if ig_posts table has data.');
      }

      setPosts(processedPosts);
    } catch (err) {
      console.error('Failed to load posts:', err);
      setError(err instanceof Error ? err.message : t.award?.posts?.error || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (postId: string, email: string) => {
    if (!email.trim()) {
      setError(lang === 'en' ? 'Please enter your email address to vote!' : '請輸入 Email 才能投票！');
      return;
    }

    setVotingPostId(postId);
    setError(null);

    try {
      // Execute reCAPTCHA
      const recaptchaToken = await executeRecaptcha();
      if (!recaptchaToken) {
        throw new Error(t.award?.posts?.recaptchaError || 'reCAPTCHA verification failed');
      }

      const response = await fetch('/api/award/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          email: email.trim(),
          recaptchaToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 檢查是否需要先關注
        if (data.requiresFollow) {
          setPendingVote({ postId, email: email.trim() });
          setShowFollowModal(true);
          setVotingPostId(null);
          return;
        }

        // 顯示詳細的錯誤資訊
        const errorMessage = data.details
          ? `${data.error || 'Failed to submit vote'}: ${data.details}`
          : data.error || t.award?.posts?.voteError || 'Failed to submit vote';

        console.error('[Award Page] Vote error:', {
          status: response.status,
          error: data.error,
          details: data.details,
          code: data.code,
        });

        throw new Error(errorMessage);
      }

      trackEvent('Lead', {
        content_name: 'Award Vote',
        content_category: 'Award',
        post_id: postId,
      });

      // Show success message (already handled by translation)
      // Success message is shown via translation in t.award?.posts?.voteSuccess

      // Reload posts to update vote counts
      loadPosts();
    } catch (err) {
      console.error('Failed to vote:', err);
      setError(err instanceof Error ? err.message : t.award?.posts?.voteError || 'Failed to submit vote');
    } finally {
      setVotingPostId(null);
    }
  };

  // 處理關注成功後的回調
  const handleFollowSuccess = async (email: string) => {
    if (!pendingVote) return;

    // 關閉 modal
    setShowFollowModal(false);

    // 自動重新發送投票請求
    await handleVote(pendingVote.postId, email);

    // 清除待處理的投票
    setPendingVote(null);
  };

  const handleVoteClick = (post: InstagramPost, email: string) => {
    handleVote(post.id, email);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#1E1F1C] via-[#1E1F1C] to-[#2A2B26] text-white pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6">
          <AwardHeader />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            <VotingInstructions />
            <div className="space-y-6">
              <AwardsInfo />
              <AwardRules />
            </div>
          </div>
          <AwardError error={error || ''} />
          <AwardPostsGrid
            posts={posts}
            loading={loading}
            votingPostId={votingPostId}
            onVoteClick={handleVoteClick}
            onOpenFollowModal={() => setShowFollowModal(true)}
          />
        </div>
      </main>
      <Footer />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <h1 className="text-3xl font-semibold tracking-wide text-white sm:text-4xl">Coming Soon</h1>
      </div>

      {/* Follow Modal for voting */}
      <FollowModalWithForm
        isOpen={showFollowModal}
        onClose={() => {
          setShowFollowModal(false);
          setPendingVote(null);
          setVotingPostId(null);
        }}
        onSuccess={handleFollowSuccess}
        initialEmail={pendingVote?.email || ''}
      />
    </>
  );
}
