'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrShareModalProps {
  open: boolean;
  onClose: () => void;
  memberNo: string;
  lang: 'en' | 'zh';
  labels: {
    qrTitle: string;
    qrHelper: string;
    qrExpiresIn: string;
    qrExpired: string;
    qrRegenerate: string;
  };
}

export default function QrShareModal({ open, onClose, memberNo, lang, labels }: QrShareModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(false);
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
      console.error('[QrShareModal] fetch failed', err);
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchToken();
    } else {
      setToken(null);
      setExpiresAt(null);
      setError(null);
    }
  }, [open, fetchToken]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const msLeft = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const mm = Math.floor(msLeft / 60000).toString().padStart(2, '0');
  const ss = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0');
  const expiredMessage = labels.qrExpiresIn.replace('{mm}', mm).replace('{ss}', ss);
  const isExpired = msLeft === 0 && !!expiresAt;

  useEffect(() => {
    if (isExpired && !loading) fetchToken();
  }, [isExpired, loading, fetchToken]);

  const qrUrl = useMemo(() => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/members/${memberNo}?t=${token}`;
  }, [token, memberNo]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">{labels.qrTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center">
          {qrUrl ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <QRCodeSVG value={qrUrl} size={220} level="M" />
            </div>
          ) : (
            <div className="w-[220px] h-[220px] bg-stone-100 rounded-xl animate-pulse" />
          )}

          <p className="text-[12px] text-slate-500 mt-4 text-center">{labels.qrHelper}</p>
          <p
            className={`text-[11px] mt-2 font-mono ${
              isExpired ? 'text-red-500' : 'text-slate-400'
            }`}
          >
            {isExpired ? labels.qrExpired : expiredMessage}
          </p>

          <button
            type="button"
            onClick={fetchToken}
            disabled={loading}
            className="mt-4 text-[12px] text-[#10B8D9] hover:underline disabled:opacity-50"
          >
            {labels.qrRegenerate}
          </button>
          {error && (
            <p className="text-[11px] text-red-500 mt-2">
              {lang === 'zh' ? '產生失敗，請重試。' : 'Failed to generate QR. Try again.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
