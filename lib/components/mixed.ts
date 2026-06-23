import {DEFAULT_LANG_HEADER, ECMA_STRING_SIZE, Lang} from '../constants';
import {
    ApiActionConfig,
    ApiByScope,
    ApiServiceMixedActionConfig,
    GatewayConfig,
    GatewayRequest,
    GatewayResponse,
    SchemasByScope,
    SendStats,
    Stats,
} from '../models/common';
import {GatewayContext} from '../models/context';
import {AppErrorConstructor} from '../models/error';
import {handleError} from '../utils/common';
import {generateContextApi} from '../utils/create-context-api';
import {parseMixedError} from '../utils/parse-error';
import {redactSensitiveHeaders} from '../utils/redact-sensitive-headers';

import type {GrpcContext} from './grpc';

function getMixedResponseSize<Context extends GatewayContext>(
    data: unknown,
    ctx: Context,
    ErrorConstructor: AppErrorConstructor,
) {
    let responseSize = 0;
    try {
        responseSize = ECMA_STRING_SIZE * JSON.stringify(data)?.length;
    } catch (error) {
        handleError(ErrorConstructor, error, ctx, 'Calculate response size failed');
    }

    return responseSize;
}

export function createMixedAction<
    TSchema extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(
    config: ApiServiceMixedActionConfig<Context, Req, Res, any, any, any>,
    api: ApiByScope<TSchema, Context, Req, Res>,
    serviceName: string,
    actionName: string,
    extra: {
        config: GatewayConfig<Context, Req, Res>;
        grpcContext: GrpcContext;
        sendStats?: SendStats<Context>;
    },
    ErrorConstructor: AppErrorConstructor,
) {
    return async (actionConfig: ApiActionConfig<Context, any>) => {
        const {args, ...context} = actionConfig;
        const {requestId, headers: requestHeaders, ctx: parentCtx, userId} = actionConfig;

        const ctx = actionConfig.ctx.create(`Gateway ${serviceName} ${actionName} [mixed]`, {
            tags: {
                action: actionName,
                service: serviceName,
                type: 'mixed',
            },
        });
        const contextApi = generateContextApi(api, {...context, ctx});

        const startRequestTime = Date.now();
        const requestData: Record<string, string | number> = {
            timestamp: startRequestTime,
            service: serviceName,
            action: actionName,
            requestId: requestId || '',
            requestMethod: '',
            requestUrl: '',
            traceId: ctx.getTraceId?.() || '',
            userId: userId || '',
        };

        try {
            const responseData = await config(contextApi, args, {
                headers: actionConfig.headers,
                lang: actionConfig.headers[DEFAULT_LANG_HEADER] || Lang.Ru,
                ctx,
                ...extra,
                abortSignal: actionConfig.abortSignal,
            });

            ctx.log('Request completed');

            extra.sendStats?.(
                {
                    ...requestData,
                    requestTime: Date.now() - startRequestTime,
                    responseSize: getMixedResponseSize(responseData, ctx, ErrorConstructor),
                    restStatus: 200,
                } as Stats,
                redactSensitiveHeaders(parentCtx, requestHeaders),
                parentCtx,
                {debugHeaders: {}},
            );

            return {
                responseData,
                debugHeaders: {},
            };
        } catch (e) {
            const errorData = e instanceof Object && 'error' in e ? e.error : e;
            const restStatus = (errorData as any)?.status || 500;
            extra.sendStats?.(
                {
                    ...requestData,
                    requestTime: Date.now() - startRequestTime,
                    responseSize: getMixedResponseSize(errorData, ctx, ErrorConstructor),
                    restStatus,
                } as Stats,
                redactSensitiveHeaders(parentCtx, requestHeaders),
                parentCtx,
                {debugHeaders: {}},
            );

            if (e instanceof Object && 'error' in e) {
                handleError(ErrorConstructor, e, ctx, 'Request failed', {
                    actionName,
                    serviceName,
                });

                throw e;
            }
            if (e instanceof Error) {
                const parsedError = parseMixedError(e);
                handleError(ErrorConstructor, e, ctx, 'Request failed', {
                    actionName,
                    serviceName,
                });

                throw {
                    error: parsedError,
                };
            }

            handleError(ErrorConstructor, e, ctx, 'Request failed');

            throw {
                error: e,
            };
        } finally {
            ctx.end();
        }
    };
}
