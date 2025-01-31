import {IncomingHttpHeaders} from 'http';

import {ClientDuplexStream, ClientReadableStream, ClientWritableStream} from '@grpc/grpc-js';
import type {HandlerType} from '@grpc/grpc-js/build/src/server-call.js';
import {
    AxiosInterceptorManager,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';
import type {Request, Response} from 'express';
import * as protobufjs from 'protobufjs';

import type {GrpcContext} from '../components/grpc.js';
import {Lang} from '../constants.js';

import {GatewayContext} from './context.js';
import {AppErrorConstructor} from './error.js';

export interface GatewayRequest<Context extends GatewayContext> extends Request {
    id: string;
    ctx: Context;
}

export interface GatewayResponse extends Response {}

export interface Headers {
    [key: string]: any;
}

export interface EndpointsConfig {
    [key: string]: ActionEndpoint;
}

export type AuthHeadersFunc = (serviceName: string) => Record<string, string> | undefined;

export interface ApiActionConfig<
    Context extends GatewayContext,
    TRequestData,
    TResponseData = any,
> {
    requestId: string;
    headers: Headers;
    args: TRequestData;
    ctx: Context;
    timeout?: number;
    callback?: (response: TResponseData) => void;
    authArgs?: Record<string, unknown>;
    userId?: string;
}

export interface GRPCActionData {
    [key: string]: unknown;
}

export type SendStats<Context extends GatewayContext> = (
    stats: Stats,
    headers: IncomingHttpHeaders,
    ctx: Context,
    meta: {debugHeaders: Headers},
) => void;

export interface Stats {
    service: string;
    action: string;
    restStatus: number;
    grpcStatus?: number;
    responseSize: number;
    requestId: string;
    requestTime: number;
    requestMethod: string;
    requestUrl: string;
    timestamp: number;
    userId?: string;
    traceId: string;
}

export type ControllerType = 'rest' | 'grpc';

export interface GatewayError {
    status: number;
    message: string;
    code: string;
    details?: {
        title?: string;
        description?: string;
    } & Record<string, unknown>;
    debug?: any;
    requestId?: string;
}

export type ProxyHeadersFunction = (
    headers: IncomingHttpHeaders,
    type: ControllerType,
) => IncomingHttpHeaders;
export type ProxyHeaders = string[] | ProxyHeadersFunction;

export type ProxyResponseHeadersFunction = (headers: Headers, type: ControllerType) => Headers;
export type ProxyResponseHeaders = string[] | ProxyResponseHeadersFunction;

export type GetAuthHeadersParams<AuthArgs = Record<string, unknown>> = {
    actionType: ControllerType;
    serviceName: string;
    requestHeaders: Headers;
    authArgs: AuthArgs | undefined;
};

export type GetAuthHeaders<AuthArgs = Record<string, unknown>> = (
    params: GetAuthHeadersParams<AuthArgs>,
) => Record<string, string> | undefined;

export type ResponseContentType = AxiosResponse['headers']['Content-Type'];

export interface GatewayApiOptions<Context extends GatewayContext> {
    serviceName: string;
    timeout?: number;
    sendStats?: SendStats<Context>;
    grpcOptions?: object;
    grpcRecreateService?: boolean;
    axiosConfig?: AxiosRequestConfig;
    axiosInterceptors?: AxiosInterceptorsConfig;
    proxyHeaders?: ProxyHeaders;
    proxyDebugHeaders?: ProxyHeaders;
    validationSchema?: object;
    encodePathArgs?: boolean;
    expectedResponseContentType?: ResponseContentType | ResponseContentType[];
    getAuthHeaders: GetAuthHeaders;
}

export interface ParamsOutput {
    body?: any;
    query?: {[key: string]: any};
    headers?: Headers;
}

export interface ResponseError extends AxiosResponse<unknown> {}

export interface ExtendedBaseActionEndpoint {
    path: string;
}
export interface ExtendedGrpcActionEndpoint extends ExtendedBaseActionEndpoint {
    insecure?: boolean;
    secureWithoutRootCert?: boolean;
    grpcOptions?: object;
}
export interface ExtendedRestActionEndpoint extends ExtendedBaseActionEndpoint {
    axiosConfig?: AxiosRequestConfig;
}
export type ExtendedActionEndpoint = ExtendedGrpcActionEndpoint | ExtendedRestActionEndpoint;
export type ActionEndpoint = string | ExtendedActionEndpoint;

export interface ApiServiceBaseActionConfig<
    Context extends GatewayContext,
    TOutput,
    TParams = undefined,
    TTransformed = TOutput,
> {
    getAuthHeaders?: GetAuthHeaders;
    params?: (
        args: TParams,
        headers: Headers,
        config: ApiParamsConfig<Context>,
    ) => Promise<ParamsOutput> | ParamsOutput;
    endpoint?: string | ((endpoints: EndpointsConfig | undefined, args: TParams) => string);
    transformResponseData?: (
        data: TOutput,
        config: ApiTransformResponseDataConfig<TParams, Context>,
    ) => Promise<TTransformed> | TTransformed;
    transformResponseError?: (
        error: ResponseError,
        config: ApiTransformResponseErrorConfig<TParams, Context>,
    ) => Promise<GatewayError> | GatewayError;
    validationSchema?: object;
    timeout?: number;
    retries?: number;
    idempotency?: boolean;
    proxyHeaders?: ProxyHeaders;
    proxyResponseHeaders?: ProxyResponseHeaders;
    metadata?: Record<string, string | number | boolean>;
}

export interface ApiServiceRestActionConfig<
    Context extends GatewayContext,
    TOutput,
    TParams = undefined,
    TTransformed = TOutput,
> extends ApiServiceBaseActionConfig<Context, TOutput, TParams, TTransformed> {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    path: (args: TParams) => string;
    paramsSerializer?: AxiosRequestConfig['paramsSerializer'];
    responseType?: AxiosRequestConfig['responseType'];
    expectedResponseContentType?: ResponseContentType | ResponseContentType[];
    maxRedirects?: number;
}

export interface ApiServiceBaseGrpcActionConfig<
    Context extends GatewayContext,
    TOutput,
    TParams = undefined,
    TTransformed = TOutput,
> extends ApiServiceBaseActionConfig<Context, TOutput, TParams, TTransformed> {
    action: string;
    protoKey: string;
    insecure?: boolean;
    secureWithoutRootCert?: boolean;
    encodedFields?: string[];
    type?: HandlerType;
    decodeAnyMessageProtoLoaderOptions?: protobufjs.IConversionOptions;
}

export interface ApiServiceFileGrpcActionConfig<
    Context extends GatewayContext,
    TOutput,
    TParams,
    TTransformed,
> extends ApiServiceBaseGrpcActionConfig<Context, TOutput, TParams, TTransformed> {
    protoPath: string;
}

export enum GrpcReflection {
    OnFirstRequest,
    OnEveryRequest,
}

export interface ApiServiceReflectGrpcActionConfig<
    Context extends GatewayContext,
    TOutput,
    TParams,
    TTransformed,
> extends ApiServiceBaseGrpcActionConfig<Context, TOutput, TParams, TTransformed> {
    reflection: GrpcReflection;
    reflectionRefreshSec?: number;
}

export type ApiServiceGrpcActionConfig<
    Context extends GatewayContext,
    TOutput,
    TParams = undefined,
    TTransformed = TOutput,
> =
    | ApiServiceFileGrpcActionConfig<Context, TOutput, TParams, TTransformed>
    | ApiServiceReflectGrpcActionConfig<Context, TOutput, TParams, TTransformed>;

export interface ApiServiceMixedExtra<
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
> {
    headers: Headers;
    lang: Lang;
    ctx: Context;
    config: GatewayConfig<Context, Req, Res>;
    grpcContext: GrpcContext;
}

export type ApiServiceMixedActionConfig<
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
    TOutput,
    TParams = undefined,
    TTransformed = TOutput,
> = (
    api: unknown,
    args: TParams,
    extra: ApiServiceMixedExtra<Context, Req, Res>,
) => Promise<TTransformed>;

export type ApiServiceActionConfig<
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
    TOutput,
    TParams = undefined,
    TTransformed = TOutput,
> =
    | ApiServiceRestActionConfig<Context, TOutput, TParams, TTransformed>
    | ApiServiceGrpcActionConfig<Context, TOutput, TParams, TTransformed>
    | ApiServiceMixedActionConfig<Context, Req, Res, TOutput, TParams, TTransformed>;

export type ApiActionResponseType<T> = T extends ApiServiceActionConfig<
    any,
    any,
    any,
    any,
    any,
    infer R
>
    ? R
    : never;
export type ApiActionParams<T> = T extends ApiServiceActionConfig<any, any, any, any, infer R, any>
    ? R
    : never;

export interface ApiParamsConfig<Context extends GatewayContext> {
    ctx: Context;
}

export interface ApiTransformResponseDataConfig<TParams, Context extends GatewayContext> {
    args: TParams;
    ctx: Context;
    headers?: Headers;
}

export interface ApiTransformResponseErrorConfig<TParams, Context extends GatewayContext> {
    args: TParams;
    ctx: Context;
}

export interface BaseSchema {
    [key: string]: {
        actions: Record<string, ApiServiceActionConfig<any, any, any, any, any, any>>;
        serviceName?: string;
        endpoints?: Record<string, Record<string, EndpointsConfig>>;
    };
}

export interface SchemasByScope {
    [scope: string]: BaseSchema;
}

export type ApiByScope<
    R extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
> = {
    [scope in keyof R]: GatewayApi<R[scope], Context, Req, Res>;
};

export type ApiWithRoot<
    R extends SchemasByScope,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
> = ApiByScope<R, Context, Req, Res>['root'] & ApiByScope<R, Context, Req, Res>;

export interface GatewayActionHeaders {
    debugHeaders: Headers;
}

export interface GatewayActionUnaryResponse<TAction> extends GatewayActionHeaders {
    responseData: ApiActionResponseType<TAction>;
    responseHeaders?: Headers;
}

export interface GatewayActionClientStreamResponse<TAction> extends GatewayActionHeaders {
    stream: ClientWritableStream<ApiActionResponseType<TAction>>;
    responseData?: never;
    responseHeaders?: never;
}

export interface GatewayActionServerStreamResponse<TAction> extends GatewayActionHeaders {
    stream: ClientReadableStream<ApiActionResponseType<TAction>>;
    responseData?: never;
    responseHeaders?: never;
}

export interface GatewayActionDuplexStreamResponse<TAction> extends GatewayActionHeaders {
    stream: ClientDuplexStream<ApiActionParams<TAction>, ApiActionResponseType<TAction>>;
    responseData?: never;
    responseHeaders?: never;
}

export type GatewayActionResponseData<
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
    TAction extends ApiServiceActionConfig<Context, Req, Res, unknown, unknown, unknown>,
> = TAction extends ApiServiceGrpcActionConfig<Context, unknown, unknown, unknown>
    ? TAction['type'] extends 'clientStream'
        ? GatewayActionClientStreamResponse<TAction>
        : TAction['type'] extends 'serverStream'
        ? GatewayActionServerStreamResponse<TAction>
        : TAction['type'] extends 'bidi'
        ? GatewayActionDuplexStreamResponse<TAction>
        : GatewayActionUnaryResponse<TAction>
    : GatewayActionUnaryResponse<TAction>;

type GatewayAction<
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
    TAction extends ApiServiceActionConfig<Context, Req, Res, unknown, unknown, unknown>,
> = undefined extends ApiActionParams<TAction>
    ? (
          params?: ApiActionConfig<
              Context,
              ApiActionParams<TAction>,
              ApiActionResponseType<TAction>
          >,
      ) => Promise<GatewayActionResponseData<Context, Req, Res, TAction>>
    : (
          params: ApiActionConfig<
              Context,
              ApiActionParams<TAction>,
              ApiActionResponseType<TAction>
          >,
      ) => Promise<GatewayActionResponseData<Context, Req, Res, TAction>>;

export type GatewayApi<
    T extends BaseSchema,
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
> = {
    [S in keyof T]: {
        [A in keyof T[S]['actions']]: GatewayAction<Context, Req, Res, T[S]['actions'][A]>;
    };
};

type ContextAction<TAction> = undefined extends ApiActionParams<TAction>
    ? (params?: ApiActionParams<TAction>) => Promise<ApiActionResponseType<TAction>>
    : (params: ApiActionParams<TAction>) => Promise<ApiActionResponseType<TAction>>;

export type ContextApi<T extends BaseSchema> = {
    [S in keyof T]: {
        [A in keyof T[S]['actions']]: ContextAction<T[S]['actions'][A]>;
    };
};

export type ContextApiByScope<R extends SchemasByScope> = {
    [scope in keyof R]: ContextApi<R[scope]>;
};

export type ContextApiWithRoot<R extends SchemasByScope> = ContextApiByScope<R>['root'] &
    ContextApiByScope<R>;

interface OnUnknownActionData {
    service?: string;
    action?: string;
}

type AxiosInterceptorUseParams<T> = Parameters<AxiosInterceptorManager<T>['use']>;

interface AxiosInterceptorConfig<T> {
    callback: AxiosInterceptorUseParams<T>[0];
    errorCallback?: AxiosInterceptorUseParams<T>[1];
}

export interface AxiosInterceptorsConfig {
    request?: AxiosInterceptorConfig<InternalAxiosRequestConfig<any>>[];
    response?: AxiosInterceptorConfig<AxiosResponse<any>>[];
}

export interface GatewayConfig<
    Context extends GatewayContext,
    Req extends GatewayRequest<Context>,
    Res extends GatewayResponse,
> {
    installation?: string;
    env?: string;
    actions?: string[];
    timeout?: number;
    grpcOptions?: object;
    grpcRecreateService?: boolean;
    axiosConfig?: AxiosRequestConfig;
    axiosInterceptors?: AxiosInterceptorsConfig;
    onUnknownAction?: (req: Req, res: Res, data: OnUnknownActionData) => any;
    onBeforeAction?: (
        req: Req,
        res: Res,
        scope: string,
        service: string,
        action: string,
        config?: ApiServiceActionConfig<Context, Req, Res, unknown>,
    ) => any;
    onRequestSuccess?: (req: Req, res: Res, data: any) => any;
    onRequestFailed?: (req: Req, res: Res, error: any) => any;
    sendStats?: SendStats<Context>;
    includeProtoRoots?: string[];
    caCertificatePath: string | null;
    proxyHeaders: ProxyHeaders;
    proxyDebugHeaders?: ProxyHeaders;
    withDebugHeaders?: boolean | ((req: Req, res: Res) => boolean);
    validationSchema?: object;
    encodePathArgs?: boolean;
    getAuthArgs: (req: Req, res: Res) => Record<string, unknown> | undefined;
    getAuthHeaders: GetAuthHeaders;
    ErrorConstructor: AppErrorConstructor;
}
