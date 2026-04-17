'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface MemberQrPanelProps {
  memberNo: string;
  accent: string;
  surface: string;
  lang: 'en' | 'zh';
  labels: {
    qrHelper: string;
    qrExpiresIn: string;
    qrExpired: string;
    qrRegenerate: string;
  };
}

export default function MemberQrPanel({ memberNo, accent, surface, lang, labels }: MemberQrPanelProps) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/member/qr-token', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      console.error('[MemberQrPanel] fetch failed', err);
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const mm = Math.floor(msLeft / 60000).toString().padStart(2, '0');
  const ss = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0');
  const countdown = labels.qrExpiresIn.replace('{mm}', mm).replace('{ss}', ss);
  const isExpired = msLeft === 0 && !!expiresAt;

  useEffect(() => {
    if (isExpired && !loading) fetchToken();
  }, [isExpired, loading, fetchToken]);

  const qrUrl = useMemo(() => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/members/${memberNo}?t=${token}`;
  }, [token, memberNo]);

  return (
    <div className="mt-5 flex flex-col items-center gap-3">
      {qrUrl ? (
        <div className="bg-white p-3 rounded-xl">
          <QRCodeSVG value={qrUrl} size={160} level="M" bgColor="#FFFFFF" fgColor={surface} />
        </div>
      ) : (
        <div className="w-[184px] h-[184px] bg-white/10 rounded-xl animate-pulse" />
      )}

      <p className="text-[11px] text-white/55 text-center max-w-[240px]">{labels.qrHelper}</p>

      <div className="flex items-center gap-3 text-[11px] font-mono">
        <span className={isExpired ? 'text-red-300' : 'text-white/55'}>
          {isExpired ? labels.qrExpired : countdown}
        </span>
        <button
          type="button"
          onClick={fetchToken}
          disabled={loading}
          className="transition-colors disabled:opacity-40"
          style={{ color: accent }}
        >
          {labels.qrRegenerate}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-300">
          {lang === 'zh' ? '產生失敗，請重試。' : 'Failed to generate QR. Try again.'}
        </p>
      )}
    </div>
  );
}
