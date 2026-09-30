export interface ScannerConfig {
    openapiUrl: string;
    fixturesUrl: string;
    targetUrl: string;
    reportUrl: string;
    timeoutMs: number;
}
export declare function createConfig(options: {
    openapi: string;
    fixtures: string;
    target: string;
    report: string;
}): ScannerConfig;
//# sourceMappingURL=config.d.ts.map