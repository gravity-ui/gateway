import {DEFAULT_LANG_HEADER, Lang} from '../constants.js';
import {
    ApiActionConfig,
    ApiByScope,
    ApiServiceMixedActionConfig,
    GatewayConfig,
    GatewayRequest,
    GatewayResponse,
    SchemasByScope,
} from '../models/common.js';
import {GatewayContext} from '../models/context.js';
import {AppErrorConstructor} from '../models/error.js';
import {handleError} from '../utils/common.js';
import {generateContextApi} from '../utils/create-context-api.js';
import {parseMixedError} from '../utils/parse-error.js';

import type {GrpcContext} from './grpc.js';

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
    extra: {config: GatewayConfig<Context, Req, Res>; grpcContext: GrpcContext},
    ErrorConstructor: AppErrorConstructor,
) {
    return async (actionConfig: ApiActionConfig<Context, any>) => {
        const {args, ...context} = actionConfig;

        const ctx = actionConfig.ctx.create(`Gateway ${serviceName} ${actionName} [mixed]`, {
            tags: {
                action: actionName,
                service: serviceName,
                type: 'mixed',
            },
        });
        const contextApi = generateContextApi(api, {...context, ctx});

        try {
            const responseData = await config(contextApi, args, {
                headers: actionConfig.headers,
                lang: actionConfig.headers[DEFAULT_LANG_HEADER] || Lang.Ru,
                ctx,
                ...extra,
                abortSignal: actionConfig.abortSignal,
            });

            ctx.log('Request completed');

            return {
                responseData,
                debugHeaders: {},
            };
        } catch (e) {
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
