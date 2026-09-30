import React, { useState, useEffect } from 'react';
import { ScanResult } from '../types';
import { ScanTable } from '../components/ScanTable';
import { fetchScans } from '../services/api';

export const Scans: React.FC = () => {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchScans();
        setScans(data);
      } catch (err) {
        console.error('Failed to load scans:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <ScanTable scans={scans} loading={loading} />
    </div>
  );
};
