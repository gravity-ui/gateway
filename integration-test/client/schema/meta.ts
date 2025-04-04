import {GrpcReflection} from '../../../lib';
import {protoPath, serverEndpoint} from '../../constants';

const config = {
    protoPath: protoPath,
    protoKey: 'v1.MetaService',
    endpoint: 'endpoint',
};

const commonReflectionOptions = {
    endpoint: 'endpoint',
    action: 'GetEntityUnary',
    params: (data: any) => ({body: data}),
    insecure: true,
};

const actions = {
    getFolderStatsReflectionEvery: {
        ...commonReflectionOptions,
        reflection: GrpcReflection.OnEveryRequest,
        protoKey: 'v1.MetaService',
    },
    getFolderStatsReflectionFirst: {
        ...commonReflectionOptions,
        reflection: GrpcReflection.OnFirstRequest,
        protoKey: 'v1.MetaService',
    },
    getFolderStatsReflectionRefresh: {
        ...commonReflectionOptions,
        reflection: GrpcReflection.OnFirstRequest,
        reflectionRefreshSec: 0.5,
        protoKey: 'v1.Meta3Service',
    },
    getFolderStatsReflectionFirst2: {
        ...commonReflectionOptions,
        reflection: GrpcReflection.OnFirstRequest,
        protoKey: 'v1.MetaService',
    },
    getEntityTestOptions: {
        ...commonReflectionOptions,
        action: 'GetEntityTestOptions',
        reflection: GrpcReflection.OnFirstRequest,
        protoKey: 'v1.MetaService',
    },
    getFolderStats: {
        ...config,
        action: 'GetEntityUnary',
        params: (data: any) => ({body: data}),
        insecure: true,
    },
    getLongRequest: {
        ...config,
        action: 'GetLongEntityUnary',
        params: (data: any) => ({body: data}),
        insecure: true,
    },
    getLongRequestAbort: {
        ...config,
        action: 'GetLongEntityUnary',
        params: (data: any) => ({body: data}),
        insecure: true,
        abortOnClientDisconnect: true,
    },
    methodWithError: {
        ...config,
        action: 'MethodWithError',
        insecure: true,
    },
    methodWithErrorAndRetries: {
        ...config,
        action: 'MethodWithError',
        insecure: true,
        retries: 2,
    },
    methodWithDeadline: {
        ...config,
        action: 'MethodWithDeadline',
        insecure: true,
        timeout: 2000,
    },
    unimplemented: {
        ...config,
        action: 'Unimplemented',
        insecure: true,
    },
    getEntityListServerStream: {
        ...config,
        action: 'GetEntityListServerStream',
        insecure: true,
        type: 'serverStream' as const,
    },
    getEntityListServerStreamWithError: {
        ...config,
        action: 'GetEntityListServerStreamWithError',
        insecure: true,
        type: 'serverStream' as const,
    },
    getEntityListClientStream: {
        ...config,
        action: 'GetEntityListClientStream',
        insecure: true,
        type: 'clientStream' as const,
    },
    getEntityListDuplexStream: {
        ...config,
        action: 'GetEntityListDuplexStream',
        insecure: true,
        type: 'bidi' as const,
    },
    getDataWithTimeout: {
        ...config,
        protoKey: 'v1.TimeoutService',
        action: 'GetDataWithTimeout',
        params: (data: any) => ({body: data}),
        insecure: true,
        timeout: 2000,
    },
};

export const schema = {
    meta: {
        serviceName: 'GatewayTesting',
        actions,
        endpoints: {
            external: {
                production: {
                    endpoint: serverEndpoint,
                },
            },
        },
    },
};

export const schemaWithOnStart = {
    meta: {
        serviceName: 'GatewayTesting',
        actions: {
            getFolderStatsReflectionFirst: {
                ...commonReflectionOptions,
                reflection: GrpcReflection.OnFirstRequest,
                protoKey: 'v1.Meta2Service',
            },
        },
        endpoints: {
            external: {
                production: {
                    endpoint: serverEndpoint,
                },
            },
        },
    },
};
