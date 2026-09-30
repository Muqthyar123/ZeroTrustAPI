import { useState, useEffect } from 'react';
import { SecurityEvent } from '../types';
import { eventStream, SSEStatus } from '../services/eventStream';

export function useEventStream(maxBuffer = 50) {
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([]);
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const [latestEvent, setLatestEvent] = useState<SecurityEvent | null>(null);

  useEffect(() => {
    const unsubscribe = eventStream.subscribe({
      onEvent: (event) => {
        setLatestEvent(event);
        setLiveEvents((prev) => [event, ...prev.slice(0, maxBuffer - 1)]);
      },
      onStatusChange: (s) => {
        setStatus(s);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [maxBuffer]);

  return { liveEvents, status, latestEvent };
}
