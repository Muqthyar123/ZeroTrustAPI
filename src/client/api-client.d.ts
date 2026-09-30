export interface ApiResponse<T = unknown> {
    status: number;
    data: T;
    headers: Headers;
}
export declare class ApiClient {
    private readonly timeoutMs;
    constructor(timeoutMs?: number);
    get<T = unknown>(url: string, token?: string): Promise<ApiResponse<T>>;
    post<T = unknown>(url: string, body: unknown, token?: string): Promise<ApiResponse<T>>;
    put<T = unknown>(url: string, body: unknown, token?: string): Promise<ApiResponse<T>>;
    patch<T = unknown>(url: string, body: unknown, token?: string): Promise<ApiResponse<T>>;
    delete<T = unknown>(url: string, token?: string): Promise<ApiResponse<T>>;
    private request;
}
//# sourceMappingURL=api-client.d.ts.map