export interface EnvConfig {
    PORT: number;
    HOST: string;
    MOCK_DATA: boolean;
    MOCK_INTERVAL_MS: number;
    MAX_STORED_EVENTS: number;
    MAX_STORED_SCANS: number;
    NODE_ENV: string;
}
export declare const env: EnvConfig;
