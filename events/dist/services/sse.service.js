"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseService = exports.SSEService = void 0;
class SSEService {
    clients = new Map();
    heartbeatTimer = null;
    constructor() {
        this.startHeartbeat();
    }
    addClient(id, res) {
        // Set required headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*'
        });
        res.write(`: connected - zerotrust sse stream [${id}]\n\n`);
        const client = {
            id,
            res,
            connectedAt: new Date()
        };
        this.clients.set(id, client);
        res.on('close', () => {
            this.removeClient(id);
        });
    }
    removeClient(id) {
        const client = this.clients.get(id);
        if (client) {
            this.clients.delete(id);
            try {
                if (!client.res.writableEnded) {
                    client.res.end();
                }
            }
            catch {
                // Ignore closing errors
            }
        }
    }
    broadcast(event) {
        if (this.clients.size === 0)
            return;
        const payload = `event: security_event\ndata: ${JSON.stringify(event)}\n\n`;
        for (const [id, client] of this.clients.entries()) {
            try {
                if (client.res.writable) {
                    client.res.write(payload);
                }
                else {
                    this.removeClient(id);
                }
            }
            catch {
                this.removeClient(id);
            }
        }
    }
    getClientCount() {
        return this.clients.size;
    }
    startHeartbeat() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            if (this.clients.size === 0)
                return;
            const ping = `: ping ${Date.now()}\n\n`;
            for (const [id, client] of this.clients.entries()) {
                try {
                    if (client.res.writable) {
                        client.res.write(ping);
                    }
                    else {
                        this.removeClient(id);
                    }
                }
                catch {
                    this.removeClient(id);
                }
            }
        }, 15000);
        if (this.heartbeatTimer.unref) {
            this.heartbeatTimer.unref();
        }
    }
    closeAll() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        for (const [id, client] of this.clients.entries()) {
            try {
                client.res.end();
            }
            catch {
                // Ignore
            }
            this.clients.delete(id);
        }
    }
}
exports.SSEService = SSEService;
exports.sseService = new SSEService();
