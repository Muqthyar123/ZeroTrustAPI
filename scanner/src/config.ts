export interface ScannerConfig {
  openapiUrl: string;
  fixturesUrl: string;
  targetUrl: string;
  reportUrl: string;
  timeoutMs: number;
}

export function createConfig(options: {
  openapi: string;
  fixtures: string;
  target: string;
  report: string;
}): ScannerConfig {
  return {
    openapiUrl: options.openapi,
    fixturesUrl: options.fixtures,
    targetUrl: options.target,
    reportUrl: options.report,
    timeoutMs: 10000,
  };
}