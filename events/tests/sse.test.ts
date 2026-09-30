import { describe, it, expect, vi } from 'vitest';
import { SSEService } from '../src/services/sse.service.js';
import { EventEmitter } from 'node:events';

describe('SSE Service', () => {
  it('should register client, send header/greeting, broadcast event, and clean up on close', () => {
    const sse = new SSEService();

    const mockRes: any = new EventEmitter();
    mockRes.written = [];
    mockRes.writeHead = vi.fn();
    mockRes.write = vi.fn((data: string) => mockRes.written.push(data));
    mockRes.end = vi.fn();
    mockRes.writable = true;

    sse.addClient('test-client-1', mockRes);
    expect(sse.getClientCount()).toBe(1);
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream'
    }));

    // Broadcast event
    const sampleEvent: any = {
      decisionId: 'dec_123',
      decision: 'BLOCK',
      reason: 'TENANT_MISMATCH'
    };
    sse.broadcast(sampleEvent);

    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('event: security_event')
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"decisionId":"dec_123"')
    );

    // Simulate client disconnect
    mockRes.emit('close');
    expect(sse.getClientCount()).toBe(0);

    sse.closeAll();
  });
});
