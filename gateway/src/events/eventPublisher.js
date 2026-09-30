const DEFAULT_EVENTS_URL = "http://localhost:5000/v1/events";

// In-memory event log for test assertions
let publishedEventsLog = [];
let forcePublisherFailure = false;

/**
 * Gets the list of published events captured in memory (for testing).
 *
 * @returns {Array<Object>} List of published security events.
 */
function getPublishedEvents() {
  return [...publishedEventsLog];
}

/**
 * Gets the last published event (for testing assertions).
 *
 * @returns {Object|null} Last published event or null.
 */
function getLastPublishedEvent() {
  return publishedEventsLog.length > 0 ? publishedEventsLog[publishedEventsLog.length - 1] : null;
}

/**
 * Clears in-memory published events log.
 */
function clearPublishedEvents() {
  publishedEventsLog = [];
}

/**
 * Sets simulated publisher failure mode for fail-isolation testing.
 *
 * @param {boolean} enabled
 */
function setPublisherFailureMode(enabled) {
  forcePublisherFailure = enabled;
}

/**
 * Asynchronously publishes a security event to the external Events Service.
 * Executed non-blockingly via setImmediate.
 * Network failures, 500 errors, or timeouts are isolated and ignored without affecting HTTP authorization responses.
 *
 * @param {Object} event - Privacy-safe security event object.
 */
function publishSecurityEvent(event) {
  if (!event) return;

  // Always record event in local memory buffer for testing/verification
  publishedEventsLog.push(event);

  if (forcePublisherFailure) {
    return;
  }

  // Detached asynchronous network dispatch using setImmediate
  setImmediate(async () => {
    const targetUrl = process.env.EVENTS_SERVICE_URL || DEFAULT_EVENTS_URL;
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(3000)
      });
      await res.text().catch(() => {});
    } catch (_) {
      // Intentionally suppress network delivery errors to isolate gateway execution
    }
  });
}

module.exports = {
  publishSecurityEvent,
  getPublishedEvents,
  getLastPublishedEvent,
  clearPublishedEvents,
  setPublisherFailureMode
};
