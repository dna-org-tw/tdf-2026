'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ConfirmVotePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const token = searchParams.get('token');

    if (success === 'true') {
      setStatus('success');
      setMessage(t.award?.confirm?.success || 'Your vote has been confirmed! Thank you for participating.');
      return;
    }

    if (error) {
      setStatus('error');
      let errorMessage = t.award?.confirm?.error || 'Failed to confirm vote';
      
      switch (error) {
        case 'invalid_token':
          errorMessage = 'Invalid or expired confirmation link.';
          break;
        case 'already_confirmed':
          errorMessage = t.award?.confirm?.alreadyConfirmed || 'This vote has already been confirmed.';
          break;
        case 'already_voted_today':
          errorMessage = 'You have already voted today. Come back tomorrow!';
          break;
        case 'voting_ended':
          errorMessage = 'Voting has ended.';
          break;
        case 'not_found':
          errorMessage = 'Vote not found.';
          break;
        case 'missing_token':
          errorMessage = 'Missing confirmation token.';
          break;
        default:
          errorMessage = t.award?.confirm?.error || 'Failed to confirm vote.';
      }
      
      setMessage(errorMessage);
      return;
    }

    // If token exists, it was redirected from the API and should already be handled
    if (token) {
      setStatus('loading');
    } else {
      setStatus('error');
      setMessage('Missing confirmation token');
    }
  }, [searchParams, t]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#1E1F1C] via-[#1E1F1C] to-[#2A2B26] text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-[#10B8D9] animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">
              {t.award?.confirm?.title || 'Confirming Your Vote...'}
            </h1>
            <p className="text-white/60">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4 text-green-400">
              {t.award?.confirm?.title || 'Vote Confirmed!'}
            </h1>
            <p className="text-white/80 mb-8">{message}</p>
            <Link
              href="/award"
              className="inline-block bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Back to Award Page
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4 text-red-400">
              {t.award?.confirm?.title || 'Confirmation Failed'}
            </h1>
            <p className="text-white/80 mb-8">{message}</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/award"
                className="inline-block bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Back to Award Page
              </Link>
              <Link
                href="/"
                className="inline-block bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Go to Homepage
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
