export class ApiClient {
    timeoutMs;
    constructor(timeoutMs = 10000) {
        this.timeoutMs = timeoutMs;
    }
    async get(url, token) {
        return this.request("GET", url, undefined, token);
    }
    async post(url, body, token) {
        return this.request("POST", url, body, token);
    }
    async put(url, body, token) {
        return this.request("PUT", url, body, token);
    }
    async patch(url, body, token) {
        return this.request("PATCH", url, body, token);
    }
    async delete(url, token) {
        return this.request("DELETE", url, undefined, token);
    }
    async request(method, url, body, token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, this.timeoutMs);
        try {
            const headers = {
                Accept: "application/json",
            };
            if (body !== undefined) {
                headers["Content-Type"] = "application/json";
            }
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
            const requestInit = {
                method,
                headers,
                signal: controller.signal,
            };
            if (body !== undefined) {
                requestInit.body = JSON.stringify(body);
            }
            const response = await fetch(url, requestInit);
            let data;
            const contentType = response.headers.get("content-type") ?? "";
            if (contentType.includes("application/json")) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            return {
                status: response.status,
                data: data,
                headers: response.headers,
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
//# sourceMappingURL=api-client.js.map