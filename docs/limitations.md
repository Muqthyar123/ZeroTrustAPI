# ZeroTrustAPI System Limitations & Future Considerations

## 1. Storage Backend Scalability
- **Current State**: The Events Service utilizes an in-memory buffer (`InMemoryEventStore`, default capacity 10,000 events) for zero-dependency standalone operation during hackathon evaluation.
- **Production Recommendation**: Transition to a distributed time-series or document datastore (e.g., ClickHouse, Elasticsearch, or PostgreSQL with TimescaleDB) with Redis Pub/Sub for multi-instance SSE load balancing.

---

## 2. In-Flight Token Revocation
- **Current State**: Stateless token evaluation relies on cryptographic signature verification and ownership validation.
- **Production Recommendation**: Integrate real-time distributed token revocation lists or bloom filters in Redis to enforce immediate session termination.

---

## 3. High-Volume SSE Fan-Out
- **Current State**: SSE clients are maintained directly in Node.js process memory via persistent HTTP connections.
- **Production Recommendation**: Introduce a message broker (Kafka or Redis Streams) behind an edge WebSocket/SSE gateway (e.g. Envoy or Cloudflare Workers) to support thousands of concurrent SOC analyst dashboard instances.

---

## 4. Cold Start & Gateway Warmup
- **Current State**: The first request through a freshly started service may experience minor JIT/DNS warmup latency.
- **Production Recommendation**: Pre-warm connection pools and cache ownership metadata schemas.
