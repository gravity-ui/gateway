import {IncomingHttpHeaders} from 'http';

import {GatewayContext} from '../models/context.js';

export function redactSensitiveHeaders(
    ctx: GatewayContext,
    headers: IncomingHttpHeaders,
): IncomingHttpHeaders {
    if (ctx.utils?.redactSensitiveHeaders) {
        return ctx.utils.redactSensitiveHeaders(headers);
    } else if (ctx.utils?.redactSensitiveKeys) {
        return ctx.utils.redactSensitiveKeys(headers) as IncomingHttpHeaders;
    } else {
        return headers;
    }
}
