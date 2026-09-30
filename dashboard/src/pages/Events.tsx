import React from 'react';
import { SecurityEvent } from '../types';
import { EventTable } from '../components/EventTable';

interface EventsProps {
  events: SecurityEvent[];
  loading: boolean;
  onSelectEvent: (event: SecurityEvent) => void;
  filterDecision: string;
  onFilterDecisionChange: (val: string) => void;
  filterTenant: string;
  onFilterTenantChange: (val: string) => void;
  limit: number;
  onLimitChange: (val: number) => void;
}

export const Events: React.FC<EventsProps> = ({
  events,
  loading,
  onSelectEvent,
  filterDecision,
  onFilterDecisionChange,
  filterTenant,
  onFilterTenantChange,
  limit,
  onLimitChange
}) => {
  return (
    <div className="space-y-6">
      <EventTable
        events={events}
        loading={loading}
        onSelectEvent={onSelectEvent}
        filterDecision={filterDecision}
        onFilterDecisionChange={onFilterDecisionChange}
        filterTenant={filterTenant}
        onFilterTenantChange={onFilterTenantChange}
        limit={limit}
        onLimitChange={onLimitChange}
        title="All Security Decisions Log"
      />
    </div>
  );
};
