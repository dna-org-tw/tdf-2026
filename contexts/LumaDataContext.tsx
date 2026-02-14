'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { CalendarEvent } from '@/lib/lumaSchedule';
import type { SpeakerGrouped } from '@/lib/lumaSpeakers';

interface LumaDataContextValue {
  events: CalendarEvent[];
  speakers: SpeakerGrouped[];
  eventsLoading: boolean;
  speakersLoading: boolean;
  error: string | null;
}

const LumaDataContext = createContext<LumaDataContextValue | null>(null);

export function LumaDataProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerGrouped[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [speakersLoading, setSpeakersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setEventsLoading(true);
      setSpeakersLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/luma-data');
        if (!response.ok) throw new Error('Failed to fetch Luma data');
        const data = await response.json();
        if (cancelled) return;
        setEvents(data.events || []);
        setSpeakers(data.speakers || []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error');
          setEvents([]);
          setSpeakers([]);
        }
      } finally {
        if (!cancelled) {
          setEventsLoading(false);
          setSpeakersLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LumaDataContextValue>(
    () => ({
      events,
      speakers,
      eventsLoading,
      speakersLoading,
      error,
    }),
    [events, speakers, eventsLoading, speakersLoading, error]
  );

  return (
    <LumaDataContext.Provider value={value}>
      {children}
    </LumaDataContext.Provider>
  );
}

const DEFAULT_LUMA_VALUE: LumaDataContextValue = {
  events: [],
  speakers: [],
  eventsLoading: false,
  speakersLoading: false,
  error: null,
};

export function useLumaData(): LumaDataContextValue {
  const ctx = useContext(LumaDataContext);
  return ctx ?? DEFAULT_LUMA_VALUE;
}
