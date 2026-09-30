"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.env = {
    PORT: parseInt(process.env.PORT || '5000', 10),
    HOST: process.env.HOST || '0.0.0.0',
    MOCK_DATA: process.env.MOCK_DATA === 'true' || process.env.MOCK_DATA === '1',
    MOCK_INTERVAL_MS: parseInt(process.env.MOCK_INTERVAL_MS || '3000', 10),
    MAX_STORED_EVENTS: parseInt(process.env.MAX_STORED_EVENTS || '10000', 10),
    MAX_STORED_SCANS: parseInt(process.env.MAX_STORED_SCANS || '500', 10),
    NODE_ENV: process.env.NODE_ENV || 'development'
};
