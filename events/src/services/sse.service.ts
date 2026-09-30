import { ServerResponse } from 'node:http';
import { SecurityEvent } from '../models/event.js';

export interface SSEClient {
  id: string;
  res: ServerResponse;
  connectedAt: Date;
}

export class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  public addClient(id: string, res: ServerResponse): void {
    // Set required headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`: connected - zerotrust sse stream [${id}]\n\n`);

    const client: SSEClient = {
      id,
      res,
      connectedAt: new Date()
    };

    this.clients.set(id, client);

    res.on('close', () => {
      this.removeClient(id);
    });
  }

  public removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      this.clients.delete(id);
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      } catch {
        // Ignore closing errors
      }
    }
  }

  public broadcast(event: SecurityEvent): void {
    if (this.clients.size === 0) return;

    const payload = `event: security_event\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        if (client.res.writable) {
          client.res.write(payload);
        } else {
          this.removeClient(id);
        }
      } catch {
        this.removeClient(id);
      }
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      const ping = `: ping ${Date.now()}\n\n`;
      for (const [id, client] of this.clients.entries()) {
        try {
          if (client.res.writable) {
            client.res.write(ping);
          } else {
            this.removeClient(id);
          }
        } catch {
          this.removeClient(id);
        }
      }
    }, 15000);
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  public closeAll(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.end();
      } catch {
        // Ignore
      }
      this.clients.delete(id);
    }
  }
}

export const sseService = new SSEService();
