export interface ParsedEndpoint {
    method: string;
    path: string;
    operationId?: string;
    summary?: string;
    parameters: string[];
}
export declare function parseEndpoints(openApi: any): ParsedEndpoint[];
//# sourceMappingURL=parser.d.ts.map