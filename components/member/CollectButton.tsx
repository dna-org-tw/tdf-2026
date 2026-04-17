'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CollectButtonProps {
  memberNo: string;
  token?: string | null;
  lang: 'en' | 'zh';
  labels: {
    collect: string;
    collected: string;
    collecting: string;
    loginToCollect: string;
    privacyHint: string;
    qrError: string;
  };
}

type Status = 'idle' | 'collecting' | 'collected' | 'error';

export default function CollectButton({ memberNo, token, lang, labels }: CollectButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [alreadyCollected, setAlreadyCollected] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/member/collections')
      .then((r) => {
        if (r.status === 401) { setHasSession(false); return null; }
        setHasSession(true);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const found = (data.collected ?? []).some((c: { member_no: string }) => c.member_no === memberNo);
        if (found) { setAlreadyCollected(true); setStatus('collected'); }
      })
      .catch(() => { setHasSession(false); });
  }, [memberNo]);

  const handleClick = async () => {
    if (hasSession === false) {
      router.push('/me');
      return;
    }
    if (status === 'collecting' || status === 'collected') return;
    setStatus('collecting');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/member/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: memberNo, token: token ?? undefined }),
      });
      if (res.status === 401) {
        setErrorMessage(labels.qrError);
        setStatus('error');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(lang === 'zh' ? '收藏失敗，請稍後再試。' : 'Failed to collect. Try again.');
        return;
      }
      setAlreadyCollected(true);
      setStatus('collected');
    } catch {
      setStatus('error');
      setErrorMessage(lang === 'zh' ? '網路錯誤，請稍後再試。' : 'Network error. Try again.');
    }
  };

  const label =
    hasSession === false ? labels.loginToCollect :
    status === 'collecting' ? labels.collecting :
    alreadyCollected || status === 'collected' ? labels.collected :
    labels.collect;

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'collecting' || status === 'collected' || alreadyCollected}
        className={`w-full max-w-xs rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
          alreadyCollected || status === 'collected'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
            : 'bg-[#10B8D9] text-white hover:bg-[#0EA5C4] disabled:opacity-50'
        }`}
      >
        {label}
      </button>
      {!alreadyCollected && status !== 'collected' && hasSession !== false && (
        <p className="text-[11px] text-slate-400 text-center max-w-xs">
          {labels.privacyHint}
        </p>
      )}
      {errorMessage && (
        <p className="text-[11px] text-red-500 text-center">{errorMessage}</p>
      )}
    </div>
  );
}
