import {IncomingHttpHeaders} from 'http';

export interface GatewayContextParams {
    tags?: Record<string, string | number | boolean | undefined>;
}

export type Dict = {[key: string]: unknown};

export interface GatewayContext {
    create: (name: string, params?: GatewayContextParams) => this;
    log: (message: string, extra?: Dict) => void;
    logError: (message: string, error?: unknown, extra?: Dict) => void;
    end: () => void;
    stats: (data: {[name: string]: string | number}) => void;
    utils?: {
        redactSensitiveHeaders?: (headers?: IncomingHttpHeaders) => IncomingHttpHeaders;
        redactSensitiveKeys?: (headers: Dict) => Dict;
    };
    getMetadata: () => IncomingHttpHeaders;
    getTraceId?: () => string | undefined;
}
