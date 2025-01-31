import _ from 'lodash';

import {
    ApiActionConfig,
    ApiByScope,
    BaseSchema,
    ContextApi,
    ContextApiByScope,
    ContextApiWithRoot,
    GatewayActionServerStreamResponse,
    GatewayApi,
    GatewayRequest,
    GatewayResponse,
    SchemasByScope,
} from '../models/common.js';
import {GatewayContext} from '../models/context.js';

import {getKeys} from './common.js';

export type RequestContext<Context extends GatewayContext> = Omit<
    ApiActionConfig<Context, never>,
    'args'
>;

function createContextApiForScope<
    TSchema extends BaseSchema,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(api: GatewayApi<TSchema, Context, Req, Res>, requestContext: RequestContext<Context>) {
    return _.reduce(
        api,
        (acc, service, serviceName: keyof ContextApi<TSchema>) => {
            acc[serviceName] = _.reduce(
                service,
                (accService, action, actionName: keyof ContextApi<TSchema>[typeof serviceName]) => {
                    accService[actionName] = (args: any) =>
                        action({
                            ...requestContext,
                            args,
                        }).then(
                            (response) =>
                                response.responseData ||
                                (response as unknown as GatewayActionServerStreamResponse<unknown>)
                                    .stream,
                        );
                    return accService;
                },
                {} as ContextApi<TSchema>[typeof serviceName],
            );
            return acc;
        },
        {} as ContextApi<TSchema>,
    );
}

export function generateContextApi<
    TFullSchema extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(baseApi: ApiByScope<TFullSchema, Context, Req, Res>, requestContext: RequestContext<Context>) {
    const contextApi = _.reduce(
        baseApi,
        (contextApi, scope, scopeName: keyof TFullSchema) => {
            contextApi[scopeName] = createContextApiForScope(scope, requestContext);
            return contextApi;
        },
        {} as ContextApiByScope<TFullSchema>,
    ) as ContextApiByScope<TFullSchema>;

    const api = contextApi as ContextApiWithRoot<TFullSchema>;

    const rootScope = contextApi.root;
    if (rootScope) {
        for (const rootService of getKeys(rootScope)) {
            const curScope = api[rootService] ?? ({} as (typeof api)[typeof rootService]);

            for (const rootAction of getKeys(rootScope[rootService])) {
                const rootServiceFunc = rootScope[rootService][rootAction] as any;

                if (curScope[rootAction]) {
                    for (const curScopeAction of getKeys(curScope[rootAction])) {
                        rootServiceFunc[curScopeAction] = curScope[rootAction][curScopeAction];
                    }
                }

                curScope[rootAction] = rootServiceFunc;
            }

            api[rootService] = curScope;
        }
    }

    return api;
}
