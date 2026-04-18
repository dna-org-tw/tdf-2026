'use client';

import { useState } from 'react';

const IMAGE_HOST = 'https://taitung.nordenruder.com/upload';
const ROOM_IMAGES = [
  { id: 'ALL_room_20B10_kp7mjahe7k', captionKey: 'overall' },
  { id: 'ALL_room_24A04_hnss6gvq8y', captionKey: 'workspace' },
  { id: 'ALL_room_20C06_t4vqzakdrh', captionKey: 'overall' },
  { id: 'ALL_room_20C06_pb7qw79g4d', captionKey: 'overall' },
  { id: 'ALL_room_20C06_f32xrsxjd6', captionKey: 'bathroom' },
  { id: 'ALL_room_20C06_p3p9733idd', captionKey: 'keycard' },
  { id: 'ALL_room_20C06_62q28axhcg', captionKey: 'toiletries' },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayRoomDetails({ stay }: { stay: any }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = ROOM_IMAGES[activeIndex];
  const specs = [stay.roomSpecSize, stay.roomSpecCapacity, stay.roomSpecBed];

  return (
    <section className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
      <figure className="relative bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${IMAGE_HOST}/room_b/${active.id}.jpg`}
          alt={stay.roomName}
          className="h-72 w-full object-cover sm:h-96"
          loading="lazy"
        />
      </figure>

      <div className="grid grid-cols-5 gap-2 bg-white p-3 sm:grid-cols-9">
        {ROOM_IMAGES.map((img, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`relative aspect-square overflow-hidden rounded-lg transition ${
                isActive ? 'ring-2 ring-cyan-500 ring-offset-2' : 'opacity-80 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${IMAGE_HOST}/room_s/${img.id}.jpg`}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-6 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
          {stay.roomEyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">{stay.roomName}</h2>
        <p className="text-sm text-slate-500">{stay.roomSubname}</p>

        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          {stay.roomDescription.map((p: string) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-3">
          {specs.map((spec: { label: string; value: string }) => (
            <div key={spec.label}>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {spec.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{spec.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">{stay.roomAmenitiesTitle}</h3>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {stay.roomAmenities.map((item: string) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">{stay.roomNotesTitle}</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {stay.roomNotes.map((item: string) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1 w-1 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>{stay.roomAddress}</span>
          <a
            href="https://taitung.nordenruder.com/en/room-detail/66/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
          >
            {stay.roomLinkLabel}
            <span aria-hidden>↗</span>
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-400">{stay.roomSource}</p>
      </div>
    </section>
  );
}
