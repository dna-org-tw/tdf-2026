import Script from 'next/script';

// ElevenLabs Conversational AI floating widget. The custom element is
// hydrated by the embed script at runtime — until the script loads, the
// element is an inert no-op, so SSR is unaffected.

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { 'agent-id': string },
        HTMLElement
      >;
    }
  }
}

const AGENT_ID = 'agent_0001kr0tqx6cf6ysrgkwdeysg38x';

export default function ElevenLabsWidget() {
  return (
    <>
      <elevenlabs-convai agent-id={AGENT_ID} />
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
      />
    </>
  );
}
