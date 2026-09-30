import { useState, useEffect, useCallback } from 'react';
import { SecurityStats } from '../types';
import { fetchStats } from '../services/api';

export function useStats(refreshIntervalMs = 5000) {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const timer = setInterval(loadStats, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [loadStats, refreshIntervalMs]);

  return { stats, loading, error, refetch: loadStats };
}
