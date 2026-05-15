// Voice agent embedded via iframe from beavermind.ai. The agent itself
// (ElevenLabs ConvAI) runs in the iframe's origin, so its CSP, microphone,
// and AudioWorklet requirements are handled there — this page only needs to
// allow the frame and delegate microphone permission via Permissions-Policy.

export default function ElevenLabsWidget() {
  return (
    <iframe
      src="https://beavermind.ai/taiwandigitalfest-voiceagent"
      allow="microphone"
      title="Taiwan Digital Fest Voice Agent"
      style={{ width: '100%', height: 700, border: 0 }}
    />
  );
}
