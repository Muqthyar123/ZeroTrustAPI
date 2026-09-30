export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

export class ApiClient {
  constructor(private readonly timeoutMs: number = 10000) {}

  async get<T = unknown>(
    url: string,
    token?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", url, undefined, token);
  }

  async post<T = unknown>(
    url: string,
    body: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", url, body, token);
  }

  async put<T = unknown>(
    url: string,
    body: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", url, body, token);
  }

  async patch<T = unknown>(
    url: string,
    body: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", url, body, token);
  }

  async delete<T = unknown>(
    url: string,
    token?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", url, undefined, token);
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

     const requestInit: RequestInit = {
  method,
  headers,
  signal: controller.signal,
};

if (body !== undefined) {
  requestInit.body = JSON.stringify(body);
}

const response = await fetch(url, requestInit);
      let data: unknown;

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        data: data as T,
        headers: response.headers,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}