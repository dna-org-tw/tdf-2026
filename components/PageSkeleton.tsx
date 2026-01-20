export default function PageSkeleton() {
  return (
    <div className="min-h-screen w-full bg-stone-50">
      {/* Navbar Skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo skeleton */}
          <div className="h-10 w-32 bg-stone-200 rounded animate-pulse" />
          
          {/* Navigation links skeleton */}
          <div className="hidden md:flex items-center gap-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-16 bg-stone-200 rounded animate-pulse" />
            ))}
          </div>
          
          {/* Language toggle skeleton */}
          <div className="h-8 w-8 bg-stone-200 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Hero Section Skeleton */}
      <div className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-[#1E1F1C]">
        {/* Background overlay */}
        <div className="absolute inset-0 bg-[#1E1F1C]/70 z-10" />
        
        {/* Content skeleton */}
        <div className="relative z-20 text-center px-6 max-w-5xl mx-auto">
          {/* Date/Location skeleton */}
          <div className="mb-4">
            <div className="h-6 md:h-8 w-64 md:w-96 bg-stone-700/50 rounded mx-auto animate-pulse" />
          </div>
          
          {/* Title skeleton */}
          <div className="mb-6 space-y-3">
            <div className="h-12 md:h-20 w-full max-w-4xl bg-stone-700/50 rounded mx-auto animate-pulse" />
            <div className="h-12 md:h-20 w-3/4 max-w-3xl bg-stone-700/50 rounded mx-auto animate-pulse" />
          </div>
          
          {/* Subtitle skeleton */}
          <div className="mb-12 space-y-2">
            <div className="h-6 md:h-8 w-full max-w-2xl bg-stone-700/40 rounded mx-auto animate-pulse" />
            <div className="h-6 md:h-8 w-4/5 max-w-xl bg-stone-700/40 rounded mx-auto animate-pulse" />
          </div>
          
          {/* CTA buttons skeleton */}
          <div className="flex flex-col items-center gap-4">
            <div className="h-14 w-64 bg-[#10B8D9]/30 rounded-full animate-pulse" />
            <div className="h-14 w-48 bg-white/20 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
