import _ from 'lodash';

import createGrpcAction, {GrpcContext, createRoot, getCredentialsMap} from './components/grpc';
import {createMixedAction} from './components/mixed';
import createRestAction from './components/rest';
import {ANY_ACTION_SYMBOL} from './constants';
import {
    ApiByScope,
    ApiServiceActionConfig,
    ApiServiceMixedActionConfig,
    ApiServiceRestActionConfig,
    ApiWithRoot,
    BaseSchema,
    GatewayApi,
    GatewayConfig,
    GatewayRequest,
    GatewayResponse,
    SchemasByScope,
} from './models/common';
import {GatewayContext} from './models/context';
import {getKeys, handleError} from './utils/common';
import overrideEndpoints from './utils/overrideEndpoints';

export * from './utils/typed-api';
export * from './utils/grpc-reflection';
export {isRetryableGrpcError} from './utils/grpc';
export * from './models/common';
export * from './models/context';
export * from './models/error';

type ControllerActions = Record<string, string | Record<string, string | Record<string, boolean>>>;

function isMixedActionConfig(
    actionConfig: ApiServiceActionConfig<any, any, any, any, any, any>,
): actionConfig is ApiServiceMixedActionConfig<any, any, any, any, any, any> {
    return typeof actionConfig === 'function';
}

function isRestActionConfig(
    actionConfig: ApiServiceActionConfig<any, any, any, any, any, any>,
): actionConfig is ApiServiceRestActionConfig<any, any, any> {
    return Boolean((actionConfig as ApiServiceRestActionConfig<any, any>).method);
}

function createApiAction<
    TSchema extends BaseSchema,
    TFullSchema extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(
    schema: TSchema,
    config: GatewayConfig<Context, Req, Res>,
    serviceKey: string,
    actionName: string,
    api: ApiByScope<TFullSchema, Context, Req, Res>,
    grpcContext: GrpcContext,
) {
    const serviceSchema = schema[serviceKey];
    if (!serviceSchema) {
        throw new config.ErrorConstructor(
            `Gateway config error. Service "${serviceKey}" have been not found.`,
            {
                code: 'SERVICE_NOT_FOUND',
            },
        );
    }

    const action = serviceSchema.actions[actionName];
    if (!action) {
        throw new config.ErrorConstructor(
            `Gateway config error. Action "${serviceKey}.${actionName}" have been not found.`,
            {
                code: 'ACTION_NOT_FOUND',
            },
        );
    }

    const serviceName = serviceSchema.serviceName || '';
    const installation = config.installation || '';
    const env = config.env || '';

    if (isMixedActionConfig(action)) {
        const resultServiceName = serviceName || serviceKey;

        return createMixedAction(
            action,
            api,
            resultServiceName,
            actionName,
            {config, grpcContext},
            config.ErrorConstructor,
        );
    }

    const endpointsConfig = _.get(serviceSchema.endpoints, [installation, env]);
    if (isRestActionConfig(action)) {
        return createRestAction(
            endpointsConfig,
            action,
            serviceKey,
            actionName,
            {
                serviceName,
                timeout: config.timeout,
                sendStats: config.sendStats,
                proxyHeaders: config.proxyHeaders,
                proxyDebugHeaders: config.proxyDebugHeaders,
                axiosConfig: config.axiosConfig,
                axiosInterceptors: config.axiosInterceptors,
                axiosRetryCondition: config.axiosRetryCondition,
                validationSchema: config.validationSchema,
                encodePathArgs: config.encodePathArgs,
                getAuthHeaders: config.getAuthHeaders,
            },
            config.ErrorConstructor,
        );
    }

    const grpcRecreateService = config.grpcRecreateService ?? true;

    return createGrpcAction(
        grpcContext,
        endpointsConfig,
        action,
        serviceKey,
        actionName,
        {
            serviceName,
            timeout: config.timeout,
            sendStats: config.sendStats,
            proxyHeaders: config.proxyHeaders,
            proxyDebugHeaders: config.proxyDebugHeaders,
            grpcRetryCondition: config.grpcRetryCondition,
            grpcOptions: config.grpcOptions,
            grpcRecreateService,
            getAuthHeaders: config.getAuthHeaders,
        },
        config.ErrorConstructor,
    );
}

function generateGatewayApi<
    TSchema extends BaseSchema,
    TFullSchema extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(
    schema: TSchema,
    config: GatewayConfig<Context, Req, Res>,
    grpcContext: GrpcContext,
    baseApi: ApiByScope<TFullSchema, Context, Req, Res>,
) {
    const {installation, env} = config;

    if (!installation) {
        throw new config.ErrorConstructor('Gateway config error', {
            code: 'EMPTY_GATEWAY_INSTALLATION',
        });
    }

    if (!env) {
        throw new config.ErrorConstructor('Gateway config error', {code: 'EMPTY_GATEWAY_ENV'});
    }

    return Object.keys(schema).reduce((api, serviceKey) => {
        return _.set(
            api,
            serviceKey,
            Object.keys(schema[serviceKey].actions).reduce(
                (serviceActions, actionName) => ({
                    ...serviceActions,
                    [actionName]: createApiAction(
                        schema,
                        config,
                        serviceKey,
                        actionName,
                        baseApi,
                        grpcContext,
                    ),
                }),
                {} as GatewayApi<TSchema, Context, Req, Res>[any],
            ),
        );
    }, {} as GatewayApi<TSchema, Context, Req, Res>);
}

function generateGatewayApiController<
    TSchema extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(
    schemasByScope: TSchema,
    Api: ApiWithRoot<TSchema, Context, Req, Res>,
    config: GatewayConfig<Context, Req, Res>,
    controllerActions: ControllerActions | undefined,
) {
    // eslint-disable-next-line complexity
    return async function gateway(req: Req, res: Res) {
        const {userId} = res.locals || {};
        const {service, action, scope = 'root'} = req.params;

        const withDebugHeaders =
            typeof config.withDebugHeaders === 'function'
                ? config.withDebugHeaders(req, res)
                : Boolean(config.withDebugHeaders);

        const onUnknownAction = config?.onUnknownAction;
        const onBeforeAction = config?.onBeforeAction;
        const onRequestSuccess = config?.onRequestSuccess;
        const onRequestFailed = config?.onRequestFailed;

        if (!Api || !Api[scope] || !Api[scope][service]) {
            if (onUnknownAction) {
                return onUnknownAction(req, res, {
                    service,
                });
            } else {
                return res.status(404).send({
                    status: 404,
                    code: 'UNKNOWN_SERVICE',
                    message: 'Unknown service',
                });
            }
        }

        if (!Api[scope][service][action]) {
            if (onUnknownAction) {
                return onUnknownAction(req, res, {
                    service,
                    action,
                });
            } else {
                return res.status(404).send({
                    status: 404,
                    code: 'UNKNOWN_SERVICE_ACTION',
                    message: 'Unknown service action',
                });
            }
        }

        // Validation of private endpoints, preventing their invocation through the controller.
        if (_.startsWith(action, '_')) {
            return res.status(404).send({
                status: 404,
                code: 'UNKNOWN_SERVICE_ACTION',
                message: 'Unknown service action',
            });
        }

        if (
            controllerActions &&
            _.get(controllerActions, [scope]) !== ANY_ACTION_SYMBOL &&
            _.get(controllerActions, [scope, service]) !== ANY_ACTION_SYMBOL &&
            !_.get(controllerActions, [scope, service, action])
        ) {
            return res.status(404).send({
                status: 404,
                code: 'UNKNOWN_SERVICE_ACTION',
                message: 'Unknown service action',
            });
        }

        const args = req.method === 'GET' ? req.query : req.body;

        try {
            const abortController = new AbortController();

            const handleCloseConnection = () => {
                abortController.abort();
            };

            req.connection.once('close', handleCloseConnection);

            const apiAction = Api[scope][service][action];

            if (onBeforeAction) {
                const actionConfig = schemasByScope[scope]?.[service]?.actions?.[action];
                try {
                    await onBeforeAction(req, res, scope, service, action, actionConfig);
                } catch (error) {
                    handleError(
                        config.ErrorConstructor,
                        error,
                        req.ctx,
                        'Before action handler error',
                    );
                    throw {error, debugHeaders: {}};
                }
            }

            const {responseData, responseHeaders, debugHeaders} = await apiAction({
                requestId: req.id,
                headers: req.headers,
                ctx: req.ctx,
                args,
                authArgs: config.getAuthArgs(req, res),
                userId,
                abortSignal: abortController.signal,
            });

            req.connection.removeListener('close', handleCloseConnection);

            if (withDebugHeaders) {
                res.set(debugHeaders);
            }

            if (responseHeaders) {
                res.set(responseHeaders);
            }

            if (onRequestSuccess) {
                return onRequestSuccess(req, res, responseData);
            } else {
                return res.send(responseData);
            }
        } catch (respError) {
            const {error, debugHeaders} = respError as any;
            let responseError = error;

            if (withDebugHeaders) {
                res.set(debugHeaders);
            } else {
                responseError = _.omit(error, ['debug']);

                // Remove DebugInfo
                if (responseError.details) {
                    _.forEach(responseError.details, function (value, key) {
                        const DEBUG_INFO_TYPE = 'type.googleapis.com/google.rpc.DebugInfo';

                        if (value?.['@type'] === DEBUG_INFO_TYPE) {
                            responseError.details[key] = undefined;
                        }
                    });
                }
            }

            if (onRequestFailed) {
                return onRequestFailed(req, res, error);
            } else {
                return res.status(_.get(error, 'status', 500)).send(responseError);
            }
        }
    };
}

export function getGatewayControllers<
    TSchema extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
>(schemasByScope: TSchema, config: GatewayConfig<Context, Req, Res>) {
    const apiByScope = {} as ApiByScope<TSchema, Context, Req, Res>;

    config.installation = config.installation || process.env.APP_INSTALLATION;
    config.env = config.env || process.env.APP_ENV;

    if (process.env.GATEWAY_ENDPOINTS_OVERRIDES) {
        try {
            // eslint-disable-next-line no-param-reassign
            schemasByScope = overrideEndpoints(
                schemasByScope,
                JSON.parse(process.env.GATEWAY_ENDPOINTS_OVERRIDES),
                config.installation,
                config.env,
            );
        } catch (err) {
            console.warn('Error when parse GATEWAY_ENDPOINTS_OVERRIDES', err);
        }
    }

    const credentials = getCredentialsMap(config.caCertificatePath);

    for (const scope of getKeys(schemasByScope)) {
        apiByScope[scope] = generateGatewayApi(
            schemasByScope[scope],
            config,
            {root: createRoot(config.includeProtoRoots), credentials},
            apiByScope,
        );
    }

    const api = {...apiByScope} as ApiWithRoot<TSchema, Context, Req, Res>;

    const rootScope = apiByScope.root;
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

    const controllerActions = config.actions
        ? config.actions.reduce((acc, item) => {
              const [scope, service, action] = item.split('.');

              // Ignore option '*' for scopes
              if (scope === ANY_ACTION_SYMBOL) {
                  return acc;
              }

              if (service === ANY_ACTION_SYMBOL) {
                  _.set(acc, [scope], ANY_ACTION_SYMBOL);
              } else if (action === ANY_ACTION_SYMBOL) {
                  if (acc[scope] !== ANY_ACTION_SYMBOL) {
                      _.set(acc, [scope, service], ANY_ACTION_SYMBOL);
                  }
              } else {
                  _.set(acc, [scope, service, action], true);
              }

              return acc;
          }, {} as ControllerActions)
        : undefined;

    const controller = generateGatewayApiController(schemasByScope, api, config, controllerActions);

    return {
        controller,
        api,
    };
}
