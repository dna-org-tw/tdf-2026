import { Metadata } from 'next';
import { getPosts } from '@/lib/ghost';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BlogList from '@/components/blog/BlogList';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blog | Taiwan Digital Fest 2026',
  description:
    'Latest stories, guides, and insights from Taiwan Digital Fest 2026.',
  openGraph: {
    title: 'Blog | Taiwan Digital Fest 2026',
    description:
      'Latest stories, guides, and insights from Taiwan Digital Fest 2026.',
  },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const { posts, pagination } = await getPosts(page);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-stone-50 pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#1E1F1C] mb-4 text-center">
            Blog
          </h1>
          <p className="text-lg text-[#1E1F1C]/80 max-w-3xl mx-auto text-center mb-12">
            Stories, guides, and insights from the Taiwan Digital Fest community.
          </p>
          <BlogList posts={posts} pagination={pagination} />
        </div>
      </main>
      <Footer />
    </>
  );
}
