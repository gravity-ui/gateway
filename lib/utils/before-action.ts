import {GatewayBeforeActionResponse} from '../models/common';

const BEFORE_ACTION_RESPONSE = Symbol.for('@gravity-ui/gateway/before-action-response');

type MarkedBeforeActionResponse = GatewayBeforeActionResponse & {
    [BEFORE_ACTION_RESPONSE]: true;
};

// Marks a value returned from onBeforeAction as a response that replaces the action call.
export function createBeforeActionResponse<TData>(
    response: GatewayBeforeActionResponse<TData>,
): GatewayBeforeActionResponse<TData> {
    return {
        responseData: response.responseData,
        responseHeaders: response.responseHeaders,
        debugHeaders: response.debugHeaders,
        [BEFORE_ACTION_RESPONSE]: true,
    } as MarkedBeforeActionResponse as GatewayBeforeActionResponse<TData>;
}

export function isBeforeActionResponse(value: unknown): value is GatewayBeforeActionResponse {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as Partial<MarkedBeforeActionResponse>)[BEFORE_ACTION_RESPONSE] === true
    );
}
