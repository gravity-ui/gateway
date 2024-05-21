import http from 'http';
import https from 'https';

import * as grpc from '@grpc/grpc-js';

const packageJson = require('../package.json');

export const VERSION = packageJson.version;

export enum Lang {
    Ru = 'ru',
    En = 'en',
}

export const DEFAULT_TIMEOUT = 25 * 1000;

export const DEFAULT_LANG_HEADER = 'accept-language';

export const DEFAULT_PROXY_HEADERS = [
    'origin',
    'user-agent',
    'referer',
    'x-real-ip',
    'x-forwarded-for',
];

export const DEFAULT_AXIOS_OPTIONS = {
    maxContentLength: 1024 * 1024 * 100, // 100 Mb
    httpAgent: new http.Agent({
        //@ts-ignore https://github.com/nodejs/node/blob/master/lib/_http_agent.js#L233
        family: 6,
    }),
    httpsAgent: new https.Agent({
        //@ts-ignore https://github.com/nodejs/node/blob/master/lib/_http_agent.js#L233
        family: 6,
    }),
};

export const DEFAULT_GRPC_OPTIONS = {
    'grpc.max_receive_message_length': 1024 * 1024 * 100, // 100 Mb
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 1000,
    'grpc.keepalive_permit_without_calls': 1,
};

/**
 * Byte sizes are taken from ECMAScript Language Specification
 * http://www.ecma-international.org/ecma-262/5.1/
 */
export const ECMA_STRING_SIZE = 2;

export const ANY_ACTION_SYMBOL = '*';

export const RETRYABLE_STATUS_CODES: Array<grpc.status | undefined> = [
    grpc.status.UNAVAILABLE,
    grpc.status.CANCELLED,
    grpc.status.ABORTED,
    grpc.status.UNKNOWN,
];

export const RECREATE_SERVICE_CODES: Array<grpc.status | undefined> = [
    grpc.status.DEADLINE_EXCEEDED,
];

/**
 * Common validation schema for action's parameters. You can use it in GatewayConfig as validationSchema
 * Validates the parameter type: only number, object, or string are allowed.
 * For strings, disallows characters: ".", "?", "#", "/", "\"
 */
export const DEFAULT_VALIDATION_SCHEMA = {
    additionalProperties: {
        oneOf: [
            {
                type: 'number',
            },
            {
                type: 'string',
                pattern: '^((?!(\\.\\.|\\?|#|\\\\|\\/)).)*$',
            },
            {
                type: 'object',
            },
        ],
    },
};

export const AXIOS_RETRY_NAMESPACE = 'axios-retry';
