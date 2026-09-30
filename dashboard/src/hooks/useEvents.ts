import { useState, useEffect, useCallback } from 'react';
import { SecurityEvent } from '../types';
import { fetchEvents } from '../services/api';

export function useEvents(initialFilters: { decision?: string; tenant?: string; limit?: number } = {}) {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEvents(filters);
      setEvents(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const addEventIfMatches = useCallback((newEvent: SecurityEvent) => {
    setEvents((prev) => {
      // Check if matches filters
      if (filters.decision && newEvent.decision !== filters.decision) return prev;
      if (filters.tenant && newEvent.tenantId !== filters.tenant && newEvent.objectTenantId !== filters.tenant) return prev;

      // Avoid duplicates
      if (prev.some((e) => e.decisionId === newEvent.decisionId)) return prev;

      const limit = filters.limit || 50;
      return [newEvent, ...prev.slice(0, limit - 1)];
    });
  }, [filters]);

  return {
    events,
    filters,
    setFilters,
    loading,
    error,
    refetch: loadEvents,
    addEventIfMatches
  };
}
