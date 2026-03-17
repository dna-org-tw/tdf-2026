import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPostSlugs } from '@/lib/ghost';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BlogPostContent from '@/components/blog/BlogPostContent';

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await getAllPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.meta_title || post.title} | Taiwan Digital Fest 2026`,
    description: post.meta_description || post.excerpt,
    openGraph: {
      title: post.og_title || post.title,
      description: post.og_description || post.excerpt,
      images: post.og_image || post.feature_image
        ? [{ url: (post.og_image || post.feature_image)! }]
        : [],
      type: 'article',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: post.authors?.map((a) => a.name),
      tags: post.tags?.map((t) => t.name),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.twitter_title || post.title,
      description: post.twitter_description || post.excerpt,
      images: post.twitter_image || post.feature_image
        ? [(post.twitter_image || post.feature_image)!]
        : [],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-28 pb-16">
        <BlogPostContent post={post} />
      </main>
      <Footer />
    </>
  );
}
