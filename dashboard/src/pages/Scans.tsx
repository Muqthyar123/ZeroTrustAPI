import React, { useState, useEffect } from 'react';
import { ScanResult } from '../types';
import { ScanTable } from '../components/ScanTable';
import { fetchScans } from '../services/api';

export const Scans: React.FC = () => {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const data = await fetchScans();
        if (isMounted) setScans(data);
      } catch (err) {
        console.error('Failed to load scans:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-6">
      <ScanTable scans={scans} loading={loading} />
    </div>
  );
};
