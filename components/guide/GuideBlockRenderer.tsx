import type { GuideBlock } from '@/data/guide';

export default function GuideBlockRenderer({ block }: { block: GuideBlock }) {
  if (block.type === 'faq') {
    return (
      <div className="space-y-3">
        {block.items.map((item) => (
          <details key={item.question} className="group rounded-2xl border border-stone-200 bg-white">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 text-base font-semibold text-stone-900">
              <span>{item.question}</span>
              <svg
                className="mt-1 h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="px-5 pb-5 whitespace-pre-line text-sm leading-7 text-stone-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    );
  }

  if (block.type === 'feature-list' || block.type === 'steps') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {block.items.map((item) => (
          <article key={item.title} className="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-stone-900">{item.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-600">{item.body}</p>
          </article>
        ))}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              {block.columns.map((column) => (
                <th key={column} scope="col" className="border-b border-stone-200 px-4 py-3 text-left font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join('-')}`} className="border-t border-stone-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top text-stone-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'callout') {
    return (
      <div
        className={`rounded-2xl p-5 ${
          block.tone === 'warning'
            ? 'border border-amber-200 bg-amber-50 text-amber-950'
            : 'border border-cyan-200 bg-cyan-50 text-cyan-950'
        }`}
      >
        {block.title ? <h3 className="text-base font-semibold">{block.title}</h3> : null}
        <p className={block.title ? 'mt-2 text-sm leading-7' : 'text-sm leading-7'}>{block.body}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600">
      {block.items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-stone-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
