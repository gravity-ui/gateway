/* eslint-disable camelcase */

import fs from 'fs';
import path from 'path';

import * as grpc from '@grpc/grpc-js';
import {
    CallOptions,
    ClientDuplexStream,
    ClientReadableStream,
    ClientUnaryCall,
    ClientWritableStream,
    Metadata,
    requestCallback,
} from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import _ from 'lodash';
import sizeof from 'object-sizeof';
import * as protobufjs from 'protobufjs';
import type * as descriptor from 'protobufjs/ext/descriptor';
import {v4 as uuidv4} from 'uuid';

import {
    DEFAULT_GRPC_OPTIONS,
    DEFAULT_LANG_HEADER,
    DEFAULT_PROTO_LOADER_OPTIONS,
    DEFAULT_PROXY_HEADERS,
    DEFAULT_TIMEOUT,
    Lang,
    VERSION,
} from '../constants';
import {
    ActionEndpoint,
    ApiActionConfig,
    ApiServiceGrpcActionConfig,
    ApiServiceReflectGrpcActionConfig,
    EndpointsConfig,
    GRPCActionData,
    GatewayActionResponseData,
    GatewayApiOptions,
    GrpcReflection,
    Headers,
    ParamsOutput,
} from '../models/common';
import {Dict, GatewayContext} from '../models/context';
import {AppErrorConstructor} from '../models/error';
import {
    getHeadersFromMetadata,
    handleError,
    isExtendedActionEndpoint,
    isExtendedGrpcActionEndpoint,
    sanitizeDebugHeaders,
} from '../utils/common';
import {decodeAnyMessageRecursively, isRecreateServiceError, isRetryableError} from '../utils/grpc';
import {getCachedReflectionRoot, getReflectionRoot} from '../utils/grpc-reflection';
import {GrpcError, grpcErrorFactory, isGrpcError, parseGrpcError} from '../utils/parse-error';
import {patchProtoPathResolver} from '../utils/proto-path-resolver';
import {redactSensitiveHeaders} from '../utils/redact-sensitive-headers';
import {validateArgs} from '../utils/validate';

// https://github.com/protobufjs/protobuf.js/issues/1499
declare module 'protobufjs' {
    interface Root {
        toDescriptor(
            protoVersion: string,
        ): protobufjs.Message<descriptor.IFileDescriptorSet> & descriptor.IFileDescriptorSet;
    }
}

interface CredentialsMap {
    insecure: grpc.ChannelCredentials;
    secure: grpc.ChannelCredentials;
    secureWithoutRootCert: grpc.ChannelCredentials;
}

interface ServerStreamAction {
    <RequestType, ResponseType>(
        argument: RequestType,
        metadata: Metadata,
        options?: CallOptions,
    ): ClientReadableStream<ResponseType>;
}

interface ServerStreamAction {
    <RequestType, ResponseType>(
        argument: RequestType,
        options?: CallOptions,
    ): ClientReadableStream<ResponseType>;
}

interface ServerStreamAction {
    <RequestType, ResponseType>(
        argument: RequestType,
        metadata?: Metadata | CallOptions,
        options?: CallOptions,
    ): ClientReadableStream<ResponseType>;
}

interface ClientStreamAction {
    <RequestType, ResponseType>(
        metadata: Metadata,
        options: CallOptions,
        callback: requestCallback<ResponseType>,
    ): ClientWritableStream<RequestType>;
}

interface ClientStreamAction {
    <RequestType, ResponseType>(
        metadata: Metadata,
        callback: requestCallback<ResponseType>,
    ): ClientWritableStream<RequestType>;
}

interface ClientStreamAction {
    <RequestType, ResponseType>(
        options: CallOptions,
        callback: requestCallback<ResponseType>,
    ): ClientWritableStream<RequestType>;
}

interface ClientStreamAction {
    <RequestType, ResponseType>(
        callback: requestCallback<ResponseType>,
    ): ClientWritableStream<RequestType>;
}

interface BidiStreamAction {
    <RequestType, ResponseType>(metadata: Metadata, options?: CallOptions): ClientDuplexStream<
        RequestType,
        ResponseType
    >;
}

interface BidiStreamAction {
    <RequestType, ResponseType>(options?: CallOptions): ClientDuplexStream<
        RequestType,
        ResponseType
    >;
}

interface BidiStreamAction {
    <RequestType, ResponseType>(
        metadata?: Metadata | CallOptions,
        options?: CallOptions,
    ): ClientDuplexStream<RequestType, ResponseType>;
}

interface UnaryAction {
    <T>(
        data: GRPCActionData,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: grpc.requestCallback<T>,
    ): ClientUnaryCall;
}

type ServiceClient = grpc.Client & {
    [key: string]: UnaryAction | ServerStreamAction | ClientStreamAction | BidiStreamAction;
};

const grpcLoaderOptions = {
    ...DEFAULT_PROTO_LOADER_OPTIONS,
    includeDirs: [path.join(__dirname, '../../proto')],
};

export interface GrpcContext {
    root: protobufjs.Root;
    credentials: CredentialsMap;
}

export function createRoot(includeGrpcPaths?: string[]): protobufjs.Root {
    const root = new protobufjs.Root();
    root.loadSync(path.resolve(__dirname, '../../proto/google/rpc/code.proto'));
    root.loadSync(path.resolve(__dirname, '../../proto/google/rpc/error_details.proto'));
    root.loadSync(path.resolve(__dirname, '../../proto/google/rpc/status.proto'));
    // Load well-known internal protobufjs types
    root.loadSync('google/protobuf/struct.proto');
    root.loadSync('google/protobuf/wrappers.proto');

    grpcLoaderOptions.includeDirs = [...grpcLoaderOptions.includeDirs, ...(includeGrpcPaths ?? [])];
    patchProtoPathResolver(root, grpcLoaderOptions.includeDirs);

    return root;
}

export function getCredentialsMap(caCertificatePath?: string | null): CredentialsMap {
    let certificate: Buffer | undefined;

    if (caCertificatePath && fs.existsSync(caCertificatePath)) {
        certificate = fs.readFileSync(caCertificatePath);
    }

    return {
        secure: grpc.ChannelCredentials.createSsl(certificate),
        secureWithoutRootCert: grpc.ChannelCredentials.createSsl(),
        insecure: grpc.ChannelCredentials.createInsecure(),
    };
}

function decodeResponse<Context extends GatewayContext>(
    response: any,
    packageRoot: protobufjs.Root,
    ctx: Context,
    encodedFields: string[] = [],
    ErrorConstructor: AppErrorConstructor,
    decodeAnyMessageProtoLoaderOptions?: protobufjs.IConversionOptions,
) {
    const systemFields = ['metadata', 'response', 'error.details'];

    [...systemFields, ...encodedFields].forEach((fieldName) => {
        try {
            const parsedFieldName = fieldName.replace(/\.\*$/, '');
            const fieldValue = _.get(response, parsedFieldName);

            if (fieldValue) {
                _.set(
                    response,
                    parsedFieldName,
                    decodeAnyMessageRecursively(
                        packageRoot,
                        fieldValue,
                        decodeAnyMessageProtoLoaderOptions,
                    ),
                );
            }
        } catch (error) {
            handleError(ErrorConstructor, error, ctx, 'Message decoding failed', {fieldName});
        }
    });
}

function createMetadata<Context extends GatewayContext>({
    options,
    actionConfig,
    config,
    params,
    serviceName,
    ctx,
}: {
    options: GatewayApiOptions<Context>;
    actionConfig: ApiActionConfig<Context, any>;
    config: ApiServiceGrpcActionConfig<Context, any, any>;
    params: ParamsOutput | undefined;
    serviceName: string;
    ctx: Context;
}) {
    const {headers, requestId, authArgs} = actionConfig;
    const proxyHeaders = [...DEFAULT_PROXY_HEADERS];

    let metadata: Record<string, string> = {
        'x-request-id': requestId,
        'accept-language': headers[DEFAULT_LANG_HEADER] || Lang.Ru,
    };

    if (typeof options.proxyHeaders === 'function') {
        Object.assign(metadata, options.proxyHeaders({...headers}, 'grpc'));
    } else if (Array.isArray(options.proxyHeaders)) {
        proxyHeaders.push(...options.proxyHeaders);
    }

    if (typeof config.proxyHeaders === 'function') {
        Object.assign(metadata, config.proxyHeaders({...headers}, 'grpc'));
    } else if (Array.isArray(config.proxyHeaders)) {
        proxyHeaders.push(...config.proxyHeaders);
    }

    for (const headerName of proxyHeaders) {
        if (metadata[headerName] === undefined) {
            metadata[headerName] = headers[headerName];
        }
    }

    const authHeaders = (config.getAuthHeaders ?? options.getAuthHeaders)({
        actionType: 'grpc',
        serviceName,
        requestHeaders: headers,
        authArgs,
    });
    Object.assign(metadata, authHeaders);

    if (config.idempotency) {
        const idempotencyKey = headers['idempotency-key'] || uuidv4();
        Object.assign(metadata, {'idempotency-key': idempotencyKey});
    }

    const {headers: actionHeaders = null} = params ?? {};
    if (actionHeaders) {
        Object.keys(actionHeaders).forEach((key) => {
            metadata[key] = actionHeaders[key];
        });
    }

    metadata = _.omitBy({...ctx.getMetadata(), ...metadata}, _.isUndefined) as Record<
        string,
        string
    >;

    const serviceMetadata = new grpc.Metadata();
    Object.keys(metadata).forEach((key) => {
        if (key) {
            serviceMetadata.add(key, metadata[key]);
        }
    });
    return serviceMetadata;
}

function createActionEndpoint(endpointData: ActionEndpoint) {
    return isExtendedActionEndpoint(endpointData) ? endpointData.path : endpointData;
}

const packageObjectsMap: Map<protobufjs.Root, Record<string, grpc.GrpcObject>> = new Map();
const serviceInstancesMap: Record<string, Record<string, ServiceClient>> = {};
const reflectionServiceInstancesMap: Record<string, Record<string, Promise<ServiceClient>>> = {};

function clearInstancesCache<Context extends GatewayContext>(
    service: ServiceClient,
    instancesMap: typeof serviceInstancesMap | typeof reflectionServiceInstancesMap,
    cachePath: [string, string],
    closeTimeout: number,
    ctx: Context,
) {
    const cachedService = _.get(instancesMap, cachePath);

    if (cachedService !== service) {
        return;
    }

    // Remove cached service instance
    _.unset(instancesMap, cachePath);

    // Try to close service connection (prevent memory leak)
    // Bug in node >= 18.15.0 https://github.com/grpc/grpc-node/issues/2091
    // use setTimeout
    Promise.resolve(cachedService).then((client) => {
        setTimeout(() => {
            try {
                client?.close?.();
            } catch (error) {
                ctx.logError('Failed to close connection during clearing instances cache', error, {
                    cachePath,
                });
            }
        }, closeTimeout);
    });
}

function getChannelCredential(
    config: ApiServiceGrpcActionConfig<any, any, any>,
    endpointData: ActionEndpoint,
    credentials: CredentialsMap,
): grpc.ChannelCredentials {
    let endpointInsecure;
    let endpointSecureWithoutRootCert;
    if (isExtendedGrpcActionEndpoint(endpointData)) {
        endpointInsecure = endpointData?.insecure;
        endpointSecureWithoutRootCert = endpointData?.secureWithoutRootCert;
    }
    const isInsecure = config.insecure || endpointInsecure;
    const isSecureWithoutRootCert = config.secureWithoutRootCert || endpointSecureWithoutRootCert;

    let creds = credentials.secure;
    if (isInsecure) {
        creds = credentials.insecure;
    } else if (isSecureWithoutRootCert) {
        creds = credentials.secureWithoutRootCert;
    }

    return creds;
}

interface CacheStatus {
    time: number;
    isRefresh: boolean;
}
const reflectionCacheStatusMap: Record<string, Record<string, CacheStatus>> = {};

function needRefreshCache(actionEndpoint: string, protoKey: string, reflectionRefreshSec: number) {
    const cacheStatus = _.get(reflectionCacheStatusMap, [protoKey, actionEndpoint]);

    if (!cacheStatus) {
        _.set(reflectionCacheStatusMap, [protoKey, actionEndpoint], {
            time: Date.now() / 1000,
            isRefresh: false,
        });
        return false;
    }

    if (cacheStatus.isRefresh) {
        return false;
    }

    return cacheStatus.time + reflectionRefreshSec < Date.now() / 1000;
}

async function refreshCache(
    actionEndpoint: string,
    config: ApiServiceReflectGrpcActionConfig<any, unknown, unknown, unknown>,
    endpointData: ActionEndpoint,
    grpcOptions: object,
    credentials: CredentialsMap,
) {
    const cacheStatus = _.get(reflectionCacheStatusMap, [config.protoKey, actionEndpoint]);

    if (!cacheStatus) {
        return;
    }

    _.set(reflectionCacheStatusMap, [config.protoKey, actionEndpoint], {
        ...cacheStatus,
        isRefresh: true,
    });

    try {
        const res = await getServiceInstanceReflect(
            config,
            endpointData,
            grpcOptions,
            credentials,
            true,
        );
        _.set(
            reflectionServiceInstancesMap,
            [config.protoKey, actionEndpoint],
            Promise.resolve(res),
        );
        _.set(reflectionCacheStatusMap, [config.protoKey, actionEndpoint], {
            time: Date.now() / 1000,
            isRefresh: false,
        });
    } catch (e) {
        _.set(reflectionCacheStatusMap, [config.protoKey, actionEndpoint], {
            ...cacheStatus,
            isRefresh: false,
        });
    }
}

function getServiceInstanceReflectCached(
    config: ApiServiceReflectGrpcActionConfig<any, unknown, unknown, unknown>,
    endpointData: ActionEndpoint,
    grpcOptions: object,
    credentials: CredentialsMap,
) {
    if (config.reflection === GrpcReflection.OnEveryRequest) {
        return getServiceInstanceReflect(config, endpointData, grpcOptions, credentials);
    }

    const actionEndpoint = createActionEndpoint(endpointData);
    const cacheKey = [config.protoKey, actionEndpoint];
    const cachedServiceInstance = _.get(reflectionServiceInstancesMap, cacheKey);

    if (cachedServiceInstance) {
        if (
            config.reflectionRefreshSec &&
            needRefreshCache(actionEndpoint, config.protoKey, config.reflectionRefreshSec)
        ) {
            refreshCache(actionEndpoint, config, endpointData, grpcOptions, credentials);
        }

        return cachedServiceInstance;
    }

    const service = getServiceInstanceReflect(config, endpointData, grpcOptions, credentials);
    _.set(reflectionServiceInstancesMap, cacheKey, service);
    service.catch(() => {
        _.set(reflectionServiceInstancesMap, cacheKey, undefined);
    });
    return service;
}

async function getServiceInstanceReflect(
    config: ApiServiceReflectGrpcActionConfig<any, unknown, unknown, unknown>,
    endpointData: ActionEndpoint,
    grpcOptions: object,
    credentials: CredentialsMap,
    isRefreshCache?: boolean,
) {
    const actionEndpoint = createActionEndpoint(endpointData);
    const endpointInsecure = isExtendedGrpcActionEndpoint(endpointData)
        ? endpointData?.insecure
        : undefined;
    const isInsecure = config.insecure || endpointInsecure;
    const creds = isInsecure ? credentials.insecure : credentials.secure;

    const endpointGrpcOptions = isExtendedGrpcActionEndpoint(endpointData)
        ? endpointData.grpcOptions || {}
        : {};

    const combinedGrpcOptions = {
        ...DEFAULT_GRPC_OPTIONS,
        ...grpcOptions,
        ...endpointGrpcOptions,
    };

    let loadedRoot: protobufjs.Root;
    if (config.reflection === GrpcReflection.OnEveryRequest || isRefreshCache) {
        loadedRoot = await getReflectionRoot(
            actionEndpoint,
            config.protoKey,
            creds,
            combinedGrpcOptions,
            isRefreshCache,
        );
    } else {
        loadedRoot = await getCachedReflectionRoot(
            actionEndpoint,
            config.protoKey,
            creds,
            combinedGrpcOptions,
        );
    }

    const descriptor = loadedRoot.toDescriptor('proto3');

    const definition = protoLoader.loadFileDescriptorSetFromObject(
        descriptor,
        DEFAULT_PROTO_LOADER_OPTIONS,
    );

    const packageObject = grpc.loadPackageDefinition(definition);

    const Service = _.get(packageObject, config.protoKey) as typeof grpc.Client;

    const serviceInstance = new Service(
        actionEndpoint,
        creds,
        combinedGrpcOptions,
    ) as unknown as ServiceClient;

    return serviceInstance;
}

function loadAndCachePackageObject(root: protobufjs.Root, protoPath: string): grpc.GrpcObject {
    const cachedPackageObject = packageObjectsMap.get(root)?.[protoPath];

    if (cachedPackageObject) {
        return cachedPackageObject;
    }

    root.loadSync(protoPath);
    const definition = protoLoader.loadSync(protoPath, grpcLoaderOptions);
    const packageObject = grpc.loadPackageDefinition(definition);

    let packageObjectsByRoot = packageObjectsMap.get(root);
    if (!packageObjectsByRoot) {
        packageObjectsByRoot = {};
        packageObjectsMap.set(root, packageObjectsByRoot);
    }
    packageObjectsByRoot[protoPath] = packageObject;

    return packageObject;
}

async function getServiceInstance(
    root: protobufjs.Root,
    config: ApiServiceGrpcActionConfig<any, any, any>,
    endpointData: ActionEndpoint,
    grpcOptions: object,
    credentials: CredentialsMap,
) {
    if ('reflection' in config) {
        return getServiceInstanceReflectCached(config, endpointData, grpcOptions, credentials);
    }

    const actionEndpoint = createActionEndpoint(endpointData);
    const cacheKey = [config.protoKey, actionEndpoint];
    let serviceInstance = _.get(serviceInstancesMap, cacheKey);

    if (!serviceInstance) {
        const packageObject = loadAndCachePackageObject(root, config.protoPath);
        const Service = _.get(packageObject, config.protoKey) as typeof grpc.Client;
        const creds = getChannelCredential(config, endpointData, credentials);
        const endpointGrpcOptions = isExtendedGrpcActionEndpoint(endpointData)
            ? endpointData.grpcOptions || {}
            : {};

        serviceInstance = new Service(actionEndpoint, creds, {
            ...DEFAULT_GRPC_OPTIONS,
            ...grpcOptions,
            ...endpointGrpcOptions,
        }) as unknown as ServiceClient;
        // Save pointer to service in cache
        _.set(serviceInstancesMap, cacheKey, serviceInstance);
    }

    return serviceInstance;
}

async function getResponseData<T, R, Context extends GatewayContext>({
    config,
    response,
    ctx,
    packageRoot,
    args,
    ErrorConstructor,
    decodeAnyMessageProtoLoaderOptions,
}: {
    config: ApiServiceGrpcActionConfig<Context, any, any>;
    response: T;
    ctx: Context;
    packageRoot: protobufjs.Root;
    args: R;
    ErrorConstructor: AppErrorConstructor;
    decodeAnyMessageProtoLoaderOptions?: protobufjs.IConversionOptions;
}) {
    // Handle operation's runtime protocol buffers
    if (response) {
        const encodedFields = config.encodedFields;
        if (Array.isArray(response)) {
            response.forEach((responseItem) =>
                decodeResponse(
                    responseItem,
                    packageRoot,
                    ctx,
                    encodedFields,
                    ErrorConstructor,
                    decodeAnyMessageProtoLoaderOptions,
                ),
            );
        } else if (typeof response === 'object') {
            decodeResponse(
                response,
                packageRoot,
                ctx,
                encodedFields,
                ErrorConstructor,
                decodeAnyMessageProtoLoaderOptions,
            );
        }
    }

    let responseData = response;
    if (config.transformResponseData) {
        try {
            responseData = await config.transformResponseData(response, {
                args,
                ctx,
            });

            ctx.log('Transformed response data');
        } catch (error) {
            handleError(ErrorConstructor, error, ctx, 'Transform response data failed');
        }
    }
    return responseData;
}

export default function createGrpcAction<Context extends GatewayContext>(
    {root, credentials}: GrpcContext,
    endpoints: EndpointsConfig | undefined,
    config: ApiServiceGrpcActionConfig<Context, any, any>,
    serviceKey: string,
    actionName: string,
    options: GatewayApiOptions<Context>,
    ErrorConstructor: AppErrorConstructor,
) {
    const serviceName = options?.serviceName || serviceKey;

    let getService: (args: unknown) => Promise<ServiceClient>;
    let recreateService: (
        service: ServiceClient,
        closeTimeout: number,
        ctx: Context,
        args?: unknown,
    ) => void;
    let getActionEndpoint: (args: unknown) => string;
    const grpcOptions = options?.grpcOptions || {};

    if (!('reflection' in config)) {
        loadAndCachePackageObject(root, config.protoPath);
    }

    if (typeof config.endpoint === 'function') {
        // ToDo: memoize services in cache keys depends on args
        getActionEndpoint = (args) => {
            const endpointData = (
                config.endpoint as (endpoints: EndpointsConfig | undefined, args: unknown) => string
            )(endpoints, args);

            return createActionEndpoint(endpointData);
        };
        getService = (args: unknown) => {
            const endpointData = (
                config.endpoint as (endpoints: EndpointsConfig | undefined, args: unknown) => string
            )(endpoints, args);

            // Client will be created on first request because it depends on args
            return getServiceInstance(root, config, endpointData, grpcOptions, credentials);
        };
        recreateService = (service, closeTimeout, ctx, args) => {
            const actionEndpoint = getActionEndpoint(args);
            const serviceInstancesCache =
                'reflection' in config ? reflectionServiceInstancesMap : serviceInstancesMap;
            const cachePath = [config.protoKey, actionEndpoint] as [string, string];
            clearInstancesCache(service, serviceInstancesCache, cachePath, closeTimeout, ctx);
        };
    } else if (endpoints) {
        let endpointData = endpoints.grpcEndpoint || endpoints.endpoint;

        if (config.endpoint) {
            endpointData = endpoints[config.endpoint];
        }

        if (endpointData) {
            const actionEndpoint = createActionEndpoint(endpointData);

            if (
                'reflection' in config &&
                (config.reflection === GrpcReflection.OnEveryRequest ||
                    config.reflection === GrpcReflection.OnFirstRequest)
            ) {
                getService = () =>
                    getServiceInstanceReflectCached(config, endpointData, grpcOptions, credentials);
                recreateService = (service, closeTimeout, ctx) => {
                    const cachePath = [config.protoKey, actionEndpoint] as [string, string];
                    clearInstancesCache(
                        service,
                        reflectionServiceInstancesMap,
                        cachePath,
                        closeTimeout,
                        ctx,
                    );
                };
            } else {
                getService = () =>
                    getServiceInstance(root, config, endpointData, grpcOptions, credentials);
                recreateService = (service, closeTimeout, ctx) => {
                    const serviceInstancesCache =
                        'reflection' in config
                            ? reflectionServiceInstancesMap
                            : serviceInstancesMap;
                    const cachePath = [config.protoKey, actionEndpoint] as [string, string];
                    clearInstancesCache(
                        service,
                        serviceInstancesCache,
                        cachePath,
                        closeTimeout,
                        ctx,
                    );
                };
            }

            getActionEndpoint = () => actionEndpoint;
        }
    }

    return async function action(actionConfig: ApiActionConfig<Context, any, any>) {
        const {args, requestId, headers, ctx: parentCtx, userId} = actionConfig;
        const {action} = config;
        const lang = headers[DEFAULT_LANG_HEADER] || Lang.Ru; // header might be empty string

        const ctx = parentCtx.create(`Gateway ${serviceName} ${actionName} [grpc]`, {
            tags: {
                action: actionName,
                service: serviceName,
                type: 'grpc',
            },
        });

        const startRequestTime = Date.now();
        const requestData = {
            timestamp: startRequestTime,
            service: serviceName,
            action: actionName,
            requestTime: 0,
            requestId: actionConfig.requestId,
            requestMethod: action,
            requestUrl: config.protoKey,
            traceId: ctx.getTraceId?.() || '',
            userId: userId || '',
        };

        const debugHeaders: Headers = {
            'x-api-request-action': action,
            'x-api-request-protokey': config.protoKey,
            'x-api-request-lang': lang,
            'x-request-id': requestId,
            'x-gateway-version': VERSION,
        };

        if ('protoPath' in config) {
            debugHeaders['x-api-request-protopath'] = config.protoPath;
        }

        if (typeof options.proxyDebugHeaders === 'function') {
            Object.assign(debugHeaders, options.proxyDebugHeaders({...headers}, 'grpc'));
        } else if (Array.isArray(options.proxyDebugHeaders)) {
            for (const headerName of options.proxyDebugHeaders) {
                if (headers[headerName] !== undefined) {
                    debugHeaders[`x-gateway-${headerName}`] = headers[headerName];
                }
            }
        }

        ctx.log('Initiating request', {debugHeaders: sanitizeDebugHeaders(debugHeaders)});

        const sendStats = (status: number, data: any) => {
            if (options?.sendStats) {
                options.sendStats(
                    {
                        ...data,
                        restStatus: status,
                    },
                    redactSensitiveHeaders(parentCtx, headers),
                    parentCtx,
                    {debugHeaders: sanitizeDebugHeaders(debugHeaders)},
                );
            } else {
                ctx.stats({
                    ...requestData,
                    responseStatus: status,
                });
            }
        };

        function processError(grpcError: GrpcError) {
            const restStatus = _.get(grpcError.getGatewayError(), 'status', 500);

            sendStats(restStatus, {
                ...requestData,
                responseSize: grpcError.getRawError()?.metadata,
                grpcStatus: grpcError.getGatewayError().code,
            });
            ctx.logError(
                'Request failed',
                ErrorConstructor.wrap(grpcError.getAppError(ErrorConstructor)),
                {
                    serviceName,
                    actionName,
                    debugHeaders: sanitizeDebugHeaders(debugHeaders),
                    ...grpcError.getGatewayError(),
                },
            );
            ctx.end();
        }

        let params: ParamsOutput;

        if (config.params) {
            try {
                params = await config.params(args, headers, {ctx});
            } catch (error) {
                handleError(ErrorConstructor, error, ctx, 'Getting config params failed');
            }
        }

        let service: ServiceClient;
        try {
            service = await getService(args);
        } catch (error) {
            handleError(ErrorConstructor, error, ctx, 'getService failed');
            throw error;
        }

        // eslint-disable-next-line complexity
        return new Promise<GatewayActionResponseData<Context, any, any, any>>((resolve, reject) => {
            let endpointData = endpoints?.grpcEndpoint || endpoints?.endpoint;

            if (typeof config.endpoint === 'function') {
                endpointData = config.endpoint(endpoints, args);
            } else if (config.endpoint) {
                endpointData = _.get(endpoints, [config.endpoint]);
            }
            if (!endpointData) {
                const errorText = `Gateway config error. Endpoint has been not found in service "${serviceKey}"`;
                throw new GrpcError(errorText, {
                    status: 400,
                    code: 'ENDPOINT_NOT_FOUND',
                    message: errorText,
                });
            }

            const actionEndpoint = getActionEndpoint(args);
            debugHeaders['x-api-request-endpoint'] = actionEndpoint;

            const validationSchema = config.validationSchema || options.validationSchema;
            const invalidParams = validationSchema ? validateArgs(args, validationSchema) : false;

            if (invalidParams) {
                throw new GrpcError('Invalid params', {
                    status: 400,
                    code: 'INVALID_PARAMS',
                    message: 'Validation failed',
                    details: {
                        title: 'Invalid params',
                        description: invalidParams,
                    },
                });
            }
            const timeout =
                actionConfig?.timeout ?? config?.timeout ?? options?.timeout ?? DEFAULT_TIMEOUT;

            const serviceOptions: Partial<grpc.CallOptions> = {
                deadline: Date.now() + timeout,
            };

            const {body = null} = params ?? {body: args};

            const serviceMetadata = createMetadata({
                options,
                actionConfig,
                config,
                params,
                serviceName,
                ctx,
            });

            if (!service[action]) {
                reject(
                    new GrpcError('Not found action', {
                        status: 400,
                        code: 'GRPC_ACTION_NOT_FOUND',
                        message: `Not found action ${action} in ${serviceKey}`,
                    }),
                );
                return;
            }

            switch (config.type) {
                case 'serverStream': {
                    ctx.log('Creating serverStream request', {
                        debugHeaders: sanitizeDebugHeaders(debugHeaders),
                    });
                    const actionCall = service[action].bind(service) as ServerStreamAction;
                    const stream = actionCall(
                        body,
                        serviceMetadata as Metadata,
                        serviceOptions as CallOptions,
                    );

                    stream.on('error', (error) => {
                        ctx.log('ServerStream error', {
                            debugHeaders: sanitizeDebugHeaders(debugHeaders),
                        });
                        processError(
                            new GrpcError(
                                'ClientReadableStream error',
                                parseGrpcError(
                                    error as grpc.ServiceError,
                                    root,
                                    lang as Lang,
                                    config.decodeAnyMessageProtoLoaderOptions,
                                ),
                                error as grpc.ServiceError,
                            ),
                        );
                    });

                    stream.on('status', (status: Dict) => {
                        ctx.log('ServerStream status changed', status);
                    });

                    stream.on('end', () => {
                        ctx.log('ServerStream request completed', {
                            debugHeaders: sanitizeDebugHeaders(debugHeaders),
                        });
                        ctx.end();
                    });
                    resolve({debugHeaders, stream});
                    return;
                }
                case 'clientStream': {
                    ctx.log('Creating clientStream request', {
                        debugHeaders: sanitizeDebugHeaders(debugHeaders),
                    });
                    if (!actionConfig.callback) {
                        throw new GrpcError('Invalid action type', {
                            status: 400,
                            code: 'ACTION_CALLBACK_REQUIRED',
                            message: `Client stream actions require callback function`,
                        });
                    }
                    const actionCall = service[action].bind(service) as ClientStreamAction;
                    const stream = actionCall(
                        serviceMetadata as Metadata,
                        serviceOptions as CallOptions,
                        actionConfig.callback,
                    );
                    resolve({debugHeaders, stream});
                    return;
                }
                case 'bidi': {
                    ctx.log('Creating serverStream request', {
                        debugHeaders: sanitizeDebugHeaders(debugHeaders),
                    });
                    const actionCall = service[action].bind(service) as BidiStreamAction;
                    const stream = actionCall(
                        serviceMetadata as Metadata,
                        serviceOptions as CallOptions,
                    );

                    stream.on('error', (error) => {
                        ctx.log('BidiStream error', {
                            debugHeaders: sanitizeDebugHeaders(debugHeaders),
                        });
                        processError(
                            new GrpcError(
                                'BidiStream error',
                                parseGrpcError(
                                    error as grpc.ServiceError,
                                    root,
                                    lang as Lang,
                                    config.decodeAnyMessageProtoLoaderOptions,
                                ),
                                error as grpc.ServiceError,
                            ),
                        );
                    });

                    stream.on('status', (status: Dict) => {
                        ctx.log('BidiStream status changed', status);
                    });

                    stream.on('end', () => {
                        ctx.log('BidiStream request completed', {
                            debugHeaders: sanitizeDebugHeaders(debugHeaders),
                        });
                        ctx.end();
                    });

                    resolve({
                        debugHeaders,
                        stream,
                    });
                    return;
                }
                default: {
                    ctx.log('Starting unary request', {
                        debugHeaders: sanitizeDebugHeaders(debugHeaders),
                    });
                    let retries = config.retries ?? 0;
                    let actionCall = service[action].bind(service) as UnaryAction;
                    const callAction = () => {
                        let trailingMetadata: Record<string, grpc.MetadataValue[]> = {};

                        const call = actionCall(
                            body,
                            serviceMetadata,
                            serviceOptions,
                            async (error, response) => {
                                const endRequestTime = Date.now();
                                requestData.requestTime = endRequestTime - startRequestTime;

                                const shouldRecreateService =
                                    error &&
                                    options.grpcRecreateService &&
                                    isRecreateServiceError(error);
                                const shouldRetry =
                                    error &&
                                    retries &&
                                    (options.grpcRetryCondition?.(error) ??
                                        isRetryableError(error));
                                if (shouldRecreateService) {
                                    ctx.log(
                                        `Service client for ${config.protoKey} is going to be re-created`,
                                    );
                                    recreateService(service, timeout * 1.5, ctx, args);
                                }

                                if (shouldRetry) {
                                    ctx.logError(
                                        `Request failed, retrying ${retries--} more times`,
                                        ErrorConstructor.wrap(error),
                                        {
                                            serviceName,
                                            actionName,
                                            debugHeaders: sanitizeDebugHeaders(debugHeaders),
                                        },
                                    );
                                    // Update pointer to re-created client in local service variable
                                    try {
                                        service = await getService(args);
                                    } catch (error) {
                                        handleError(
                                            ErrorConstructor,
                                            error,
                                            ctx,
                                            'getService failed',
                                        );
                                        throw error;
                                    }
                                    // Update service
                                    actionCall = service[action].bind(service) as UnaryAction;
                                    callAction();
                                    return;
                                }

                                if (error) {
                                    reject(
                                        new GrpcError(
                                            'gRPC request error',
                                            parseGrpcError(
                                                error,
                                                root,
                                                lang as Lang,
                                                config.decodeAnyMessageProtoLoaderOptions,
                                            ),
                                            error,
                                        ),
                                    );
                                    return;
                                }

                                const responseData = await getResponseData({
                                    response,
                                    ctx,
                                    config,
                                    args,
                                    packageRoot: root,
                                    ErrorConstructor,
                                    decodeAnyMessageProtoLoaderOptions:
                                        config.decodeAnyMessageProtoLoaderOptions,
                                });
                                const responseHeaders: Headers = {};

                                if (config.proxyResponseHeaders) {
                                    const proxyResponseHeaders = [];
                                    const headersFromMetadata =
                                        getHeadersFromMetadata(trailingMetadata);

                                    if (typeof config.proxyResponseHeaders === 'function') {
                                        Object.assign(
                                            responseHeaders,
                                            config.proxyResponseHeaders(
                                                headersFromMetadata,
                                                'grpc',
                                            ),
                                        );
                                    } else if (Array.isArray(config.proxyResponseHeaders)) {
                                        proxyResponseHeaders.push(...config.proxyResponseHeaders);
                                    }

                                    for (const headerName of proxyResponseHeaders) {
                                        if (responseHeaders[headerName] === undefined) {
                                            responseHeaders[headerName] =
                                                headersFromMetadata[headerName];
                                        }
                                    }
                                }

                                Object.assign(
                                    debugHeaders,
                                    getHeadersFromMetadata(trailingMetadata, 'x-metadata-'),
                                );

                                sendStats(200, {
                                    ...requestData,
                                    responseSize: sizeof(response),
                                    grpcStatus: 0,
                                });

                                ctx.log('Request completed', {
                                    debugHeaders: sanitizeDebugHeaders(debugHeaders),
                                });
                                ctx.end();

                                return resolve({responseData, responseHeaders, debugHeaders});
                            },
                        );

                        call.on('status', (status) => {
                            trailingMetadata = status.metadata.toJSON();
                        });
                    };

                    callAction();
                }
            }
        }).catch((error: Error | GrpcError) => {
            const grpcError = isGrpcError(error) ? error : grpcErrorFactory(error);
            processError(grpcError);

            return Promise.reject({error: grpcError.getGatewayError(), debugHeaders});
        });
    };
}
