import { Fragment, type ReactNode } from 'react';

const PATTERN = /(https?:\/\/[^\s)]+)|([\w.+-]+@[\w.-]+\.[a-z]{2,})|(@taiwandigitalfest\b)/gi;

const LIGHT = 'text-cyan-700 underline underline-offset-2 hover:text-cyan-900';
const DARK = 'text-cyan-300 underline underline-offset-2 hover:text-cyan-200';

export function autolink(text: string, variant: 'light' | 'dark' = 'light'): ReactNode {
  if (!text) return text;
  const cls = variant === 'dark' ? DARK : LIGHT;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PATTERN)) {
    const [raw, url, email, ig] = match;
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(<Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</Fragment>);
    }

    if (url) {
      const trimmed = raw.replace(/[.,;!?)]+$/, '');
      const trailing = raw.slice(trimmed.length);
      nodes.push(
        <a key={`u-${start}`} href={trimmed} target="_blank" rel="noopener noreferrer" className={cls}>
          {trimmed}
        </a>,
      );
      if (trailing) nodes.push(<Fragment key={`u-${start}-t`}>{trailing}</Fragment>);
    } else if (email) {
      nodes.push(
        <a key={`e-${start}`} href={`mailto:${email}`} className={cls}>
          {email}
        </a>,
      );
    } else if (ig) {
      nodes.push(
        <a
          key={`i-${start}`}
          href="https://instagram.com/taiwandigitalfest"
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {ig}
        </a>,
      );
    }

    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}
