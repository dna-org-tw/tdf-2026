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

// Dynamically import Footer for performance optimization
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

    // Fetch Instagram Reels on every page load
    // Fetch Reels first, then load the posts list after completion
    const initializePage = async () => {
      await fetchReels();
      // Load posts after fetching (fetchReels also calls loadPosts internally; this is a fallback)
      loadPosts();
    };

    initializePage();
  }, []);

  const fetchReels = async () => {
    try {
      // Call API to fetch Instagram Reels (runs every time, no cache)
      const response = await fetch('/api/award/fetch-reels', {
        method: 'GET',
        cache: 'no-store', // Ensure no caching
      });

      if (response.ok) {
        // Reload posts list after fetching to display the latest content
        await loadPosts();
      } else {
        const errorText = await response.text();
        console.warn('[Award Page] Failed to fetch reels:', response.status, errorText);
        // Continue loading existing posts even if fetching fails
      }
    } catch (err) {
      console.error('[Award Page] Error fetching reels:', err);
      // Continue loading existing posts even if fetching fails
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

      // Process all post data, unify format, and calculate vote counts (no filtering)
      const processedPosts = (data.posts || []).map((post: InstagramPost) => {
        // Unify field names (handle different naming conventions)
        const processedPost: InstagramPost = {
          ...post,
          // Unify permalink/url
          permalink: post.permalink || post.url || `https://www.instagram.com/p/${post.short_code || ''}/`,
          // Unify media_url/display_url
          media_url: post.media_url || post.display_url || post.displayUrl || (post.images && post.images[0]) || '',
          // Unify username
          username: post.username || post.owner_username || post.ownerUsername || '',
          // Unify caption
          caption: post.caption || '',
          // Unify timestamp
          timestamp: post.timestamp || new Date().toISOString(),
          // Unify type
          type: post.type || post.post_type || 'Image',
          // Unify engagement data
          likes_count: post.likes_count ?? post.likesCount ?? 0,
          comments_count: post.comments_count ?? post.commentsCount ?? 0,
          video_play_count: post.video_play_count ?? post.videoPlayCount ?? 0,
          // Unify user info
          owner_username: post.owner_username || post.ownerUsername || post.username || '',
          owner_full_name: post.owner_full_name || post.ownerFullName || '',
          // Unify childPosts
          child_posts: post.child_posts || post.childPosts || [],
          // Unify taggedUsers
          tagged_users: post.tagged_users || post.taggedUsers || [],
          // Unify coauthorProducers
          coauthor_producers: post.coauthor_producers || post.coauthorProducers || [],
          // Vote count (from vote_count, defaults to 0 if absent)
          vote_count: post.vote_count || 0,
        };
        return processedPost;
      });

      // Ensure all posts are displayed without any filtering
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
        // Check if follow is required first
        if (data.requiresFollow) {
          setPendingVote({ postId, email: email.trim() });
          setShowFollowModal(true);
          setVotingPostId(null);
          return;
        }

        // Display detailed error information
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

  // Handle callback after successful follow
  const handleFollowSuccess = async (email: string) => {
    if (!pendingVote) return;

    // Close modal
    setShowFollowModal(false);

    // Automatically resend the vote request
    await handleVote(pendingVote.postId, email);

    // Clear the pending vote
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
