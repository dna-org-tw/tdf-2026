/**
 * Server component to add preconnect and dns-prefetch links for external domains
 * This improves loading performance by establishing connections early
 */
export default function PreconnectLinks() {
  return (
    <>
      <link rel="preconnect" href="https://www.instagram.com" />
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="dns-prefetch" href="https://img.youtube.com" />
    </>
  );
}
