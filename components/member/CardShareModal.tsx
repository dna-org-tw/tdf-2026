'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareModalLabels {
  qrHelper: string;
  qrExpiresIn: string;
  qrExpired: string;
  qrRegenerate: string;
}

interface CardShareModalProps {
  open: boolean;
  onClose: () => void;
  memberNo: string;
  displayName: string;
  tierCode: string;
  tierName: string;
  accent: string;
  surface: string;
  lang: 'en' | 'zh';
  labels: ShareModalLabels;
}

export default function CardShareModal({
  open,
  onClose,
  memberNo,
  displayName,
  tierCode,
  tierName,
  accent,
  surface,
  lang,
  labels,
}: CardShareModalProps) {
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
      console.error('[CardShareModal] fetch failed', err);
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !token) fetchToken();
  }, [open, token, fetchToken]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const msLeft = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const mm = Math.floor(msLeft / 60000).toString().padStart(2, '0');
  const ss = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0');
  const countdown = labels.qrExpiresIn.replace('{mm}', mm).replace('{ss}', ss);
  const isExpired = msLeft === 0 && !!expiresAt;

  useEffect(() => {
    if (open && isExpired && !loading) fetchToken();
  }, [open, isExpired, loading, fetchToken]);

  const qrUrl = useMemo(() => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/members/${memberNo}?t=${token}`;
  }, [token, memberNo]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'zh' ? '出示會員卡' : 'Show member card'}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative flex flex-col items-center gap-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Identity line */}
            <div className="text-center">
              <p className="text-[11px] font-mono tracking-[0.25em] uppercase text-white/55">
                TDF 2026 · {memberNo}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{displayName}</p>
              <p
                className="mt-1 text-[12px] font-mono tracking-[0.15em] uppercase"
                style={{ color: accent }}
              >
                {tierCode} · {tierName}
              </p>
            </div>

            {/* Big QR */}
            <div
              className="relative rounded-2xl bg-white p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]"
              style={{ boxShadow: `0 0 0 2px ${accent}33, 0 24px 60px -12px rgba(0,0,0,0.7)` }}
            >
              {qrUrl ? (
                <QRCodeSVG value={qrUrl} size={280} level="M" bgColor="#FFFFFF" fgColor={surface} />
              ) : (
                <div className="w-[280px] h-[280px] bg-neutral-100 animate-pulse rounded" />
              )}
            </div>

            <p className="text-[12px] text-white/60 text-center max-w-[280px]">
              {labels.qrHelper}
            </p>

            {/* Countdown + regenerate */}
            <div className="flex items-center gap-4 text-[12px] font-mono">
              <span className={isExpired ? 'text-red-300' : 'text-white/55'}>
                {isExpired ? labels.qrExpired : countdown}
              </span>
              <button
                type="button"
                onClick={fetchToken}
                disabled={loading}
                className="transition-colors disabled:opacity-40 tracking-[0.1em] uppercase"
                style={{ color: accent }}
              >
                {labels.qrRegenerate}
              </button>
            </div>

            {error && (
              <p className="text-[12px] text-red-300">
                {lang === 'zh' ? '產生失敗，請重試。' : 'Failed to generate. Try again.'}
              </p>
            )}

            {/* Close hint */}
            <button
              type="button"
              onClick={onClose}
              className="mt-2 text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 hover:text-white/70 transition-colors"
            >
              {lang === 'zh' ? '點此或按 ESC 關閉' : 'Tap outside or ESC to close'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
