'use client';

import { useEffect } from 'react';

/**
 * Trigger the self-destructing /sw.js so previously-registered service
 * workers clean up on user's next visit. Any clients without a SW skip the
 * registration entirely.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const cleanup = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          // Ensure all existing registrations fetch the new sw.js (which
          // self-unregisters) or drop them directly if update is unavailable.
          await Promise.all(
            regs.map(async (reg) => {
              try {
                await reg.update();
              } catch {
                try { await reg.unregister(); } catch {}
              }
            }),
          );
        }
      } catch {}
    };

    void cleanup();
  }, []);

  return null;
}
