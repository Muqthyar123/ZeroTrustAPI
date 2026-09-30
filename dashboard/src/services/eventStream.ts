import { SecurityEvent } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SSEListener {
  onEvent: (event: SecurityEvent) => void;
  onStatusChange?: (status: SSEStatus) => void;
}

export class EventStreamManager {
  private eventSource: EventSource | null = null;
  private listeners: Set<SSEListener> = new Set();
  private status: SSEStatus = 'disconnected';
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  public subscribe(listener: SSEListener): () => void {
    this.listeners.add(listener);
    listener.onStatusChange?.(this.status);

    if (this.listeners.size === 1) {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private setStatus(status: SSEStatus) {
    this.status = status;
    this.listeners.forEach((l) => l.onStatusChange?.(status));
  }

  public connect() {
    if (this.eventSource) return;

    this.setStatus('connecting');
    try {
      this.eventSource = new EventSource(`${API_BASE}/v1/events/stream`);

      this.eventSource.onopen = () => {
        this.setStatus('connected');
      };

      this.eventSource.addEventListener('security_event', (e: MessageEvent) => {
        try {
          const event: SecurityEvent = JSON.parse(e.data);
          this.listeners.forEach((l) => l.onEvent(event));
        } catch (err) {
          console.error('Failed to parse SSE security event:', err);
        }
      });

      this.eventSource.onerror = () => {
        this.setStatus('error');
        this.disconnect();
        // Auto-reconnect after 3 seconds
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.listeners.size > 0) {
              this.connect();
            }
          }, 3000);
        }
      };
    } catch {
      this.setStatus('error');
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.setStatus('disconnected');
    }
  }
}

export const eventStream = new EventStreamManager();
