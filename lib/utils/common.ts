import * as grpc from '@grpc/grpc-js';
import _ from 'lodash';

import {
    ActionEndpoint,
    ApiServiceGrpcActionConfig,
    ExtendedActionEndpoint,
    ExtendedGrpcActionEndpoint,
    ExtendedRestActionEndpoint,
    Headers,
    ProxyHeadersFunctionExtra,
} from '../models/common';
import {Dict, GatewayContext} from '../models/context';
import {AppErrorConstructor} from '../models/error';

export function isExtendedActionEndpoint(
    endpoint: ActionEndpoint,
): endpoint is ExtendedActionEndpoint {
    return (endpoint as ExtendedActionEndpoint)?.path !== undefined;
}

export function isExtendedGrpcActionEndpoint(
    endpoint: ActionEndpoint,
): endpoint is ExtendedGrpcActionEndpoint {
    return (
        (endpoint as ExtendedGrpcActionEndpoint)?.grpcOptions !== undefined ||
        (endpoint as ExtendedGrpcActionEndpoint)?.insecure !== undefined ||
        (endpoint as ExtendedGrpcActionEndpoint)?.secureWithoutRootCert !== undefined
    );
}

export function isExtendedRestActionEndpoint(
    endpoint: ActionEndpoint,
): endpoint is ExtendedRestActionEndpoint {
    return (endpoint as ExtendedRestActionEndpoint)?.axiosConfig !== undefined;
}

export function getKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
}

/**
 * This function should only use to sanitize debugHeaders that are creating in our code
 */
export function sanitizeDebugHeaders(debugHeaders: Headers) {
    return _.omit(debugHeaders, ['x-api-request-body']);
}

export function getHeadersFromMetadata(
    metadata: Record<string, grpc.MetadataValue[]>,
    prefix = '',
) {
    return Object.entries(metadata).reduce((headers, [key, values]) => {
        headers[`${prefix}${key}`] = values.filter((value) => typeof value === 'string').join(' ');
        return headers;
    }, {} as Record<string, string>);
}

export function handleError<Context extends GatewayContext>(
    ErrorConstructor: AppErrorConstructor,
    error: unknown,
    ctx: Context,
    message: string,
    extra?: Dict,
) {
    if (error instanceof Error) {
        ctx.logError(message, ErrorConstructor.wrap(error), extra);
    } else if (typeof error === 'string') {
        ctx.logError(message, {error}, extra);
    } else {
        ctx.logError(message, error, extra);
    }
}

export const getProxyHeadersArgs = <Context extends GatewayContext>(
    serviceName: string,
    actionName: string,
    grpcConfig?: ApiServiceGrpcActionConfig<Context, any, any>,
): ProxyHeadersFunctionExtra => {
    const protopath = grpcConfig && 'protoPath' in grpcConfig ? grpcConfig.protoPath : undefined;
    const protokey = grpcConfig?.protoKey;

    return {
        service: serviceName,
        action: actionName,
        protopath,
        protokey,
    };
};
