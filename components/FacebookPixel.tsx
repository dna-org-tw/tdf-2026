'use client';

import Script from 'next/script';

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1740357633585300';

export default function FacebookPixel() {
  return (
    <>
      {/* Facebook Pixel Code */}
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${FB_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      {/* Noscript fallback for users without JavaScript */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

function createEventId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Forward event to webhook (runs in parallel with Pixel, no await)
function forwardToWebhook(
  eventType: 'standard' | 'custom',
  eventName: string,
  parameters: Record<string, any> | undefined,
  eventId: string
) {
  if (typeof window === 'undefined') return;
  fetch('/api/events/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, eventName, parameters: parameters ?? {}, eventId }),
  }).catch(() => {});
}

// Export tracking function for use by other components
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  const eventId = createEventId();
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, parameters, { eventID: eventId });
  }
  forwardToWebhook('standard', eventName, parameters, eventId);
};

// Export custom event tracking function
export const trackCustomEvent = (eventName: string, parameters?: Record<string, any>) => {
  const eventId = createEventId();
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, parameters, { eventID: eventId });
  }
  forwardToWebhook('custom', eventName, parameters, eventId);
};
