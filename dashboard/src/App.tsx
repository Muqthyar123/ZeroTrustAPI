import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Overview } from './pages/Overview';
import { Events } from './pages/Events';
import { Scans } from './pages/Scans';
import { DemoControl } from './pages/DemoControl';
import { EventDetailsModal } from './components/EventDetailsModal';
import { useStats } from './hooks/useStats';
import { useEvents } from './hooks/useEvents';
import { useEventStream } from './hooks/useEventStream';
import { SecurityEvent } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('demo');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  // Filters state
  const [filterDecision, setFilterDecision] = useState<string>('');
  const [filterTenant, setFilterTenant] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);

  // Hooks
  const { stats, loading: statsLoading, refetch: refetchStats } = useStats();
  const {
    events,
    loading: eventsLoading,
    refetch: refetchEvents,
    setFilters,
    addEventIfMatches
  } = useEvents({ decision: filterDecision, tenant: filterTenant, limit });

  const { liveEvents, status: sseStatus, latestEvent } = useEventStream(50);

  // Update event filters when local state changes
  useEffect(() => {
    setFilters({
      decision: filterDecision || undefined,
      tenant: filterTenant || undefined,
      limit
    });
  }, [filterDecision, filterTenant, limit, setFilters]);

  // When a live event arrives via SSE, inject into events list and refresh stats
  useEffect(() => {
    if (latestEvent) {
      addEventIfMatches(latestEvent);
      refetchStats();
    }
  }, [latestEvent, addEventIfMatches, refetchStats]);

  const handleRefreshAll = () => {
    refetchStats();
    refetchEvents();
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'demo':
        return 'Interactive Live Evaluation & Attack Hub';
      case 'overview':
        return 'Zero-Trust Security Command Center';
      case 'events':
        return 'Policy Enforcement & Telemetry Logs';
      case 'scans':
        return 'Vulnerability & Authorization Scan Results';
      default:
        return 'ZeroTrustAPI Security Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (currentTab) {
      case 'demo':
        return 'Execute real-time BOLA attacks, run automated security scans, switch enforcement modes, and reset seed data with a single click.';
      case 'overview':
        return 'Real-time monitoring of BOLA/IDOR mitigation, gateway telemetry, and authorization decisions';
      case 'events':
        return 'Search, filter, and inspect anonymized SHA-256 access decisions';
      case 'scans':
        return 'Targeted vulnerability assessments against sample multi-tenant API routes';
      default:
        return undefined;
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-950 text-slate-100 font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        sseStatus={sseStatus}
        stats={stats}
        latestEvent={latestEvent}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          onRefresh={handleRefreshAll}
          isRefreshing={statsLoading || eventsLoading}
        />

        <main className="p-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'demo' && <DemoControl />}

          {currentTab === 'overview' && (
            <Overview
              stats={stats}
              events={events}
              liveEvents={liveEvents}
              loading={eventsLoading}
              onSelectEvent={setSelectedEvent}
            />
          )}

          {currentTab === 'events' && (
            <Events
              events={events}
              loading={eventsLoading}
              onSelectEvent={setSelectedEvent}
              filterDecision={filterDecision}
              onFilterDecisionChange={setFilterDecision}
              filterTenant={filterTenant}
              onFilterTenantChange={setFilterTenant}
              limit={limit}
              onLimitChange={setLimit}
            />
          )}

          {currentTab === 'scans' && <Scans />}
        </main>
      </div>

      {/* Forensic Inspection Modal */}
      <EventDetailsModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

export default App;
