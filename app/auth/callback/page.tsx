'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import { Suspense } from 'react';
import Link from 'next/link';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const isInvalid = !tokenHash || type !== 'magiclink';

  useEffect(() => {
    if (isInvalid || attempted.current) return;
    attempted.current = true;

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError('Auth service not available.');
      return;
    }
    supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: 'magiclink',
    }).then(({ error: verifyError }: { error: { message: string } | null }) => {
      if (verifyError) {
        console.error('[Auth] OTP verification failed:', verifyError);
        setError(verifyError.message);
      } else {
        router.replace('/member');
      }
    });
  }, [isInvalid, tokenHash, router]);

  if (isInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Login Failed</h1>
          <p className="text-slate-600 mb-6">Invalid or missing login link.</p>
          <Link
            href="/"
            className="inline-block bg-[#10B8D9] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0EA5C4] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Login Failed</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block bg-[#10B8D9] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0EA5C4] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full mx-4 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-600">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
