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
    // reflection action returning a `map<string, string>` field — exercises the
    // protobufjs ext/descriptor map-field patch (Root.fromDescriptor path)
    getEntityWithMapReflection: {
        ...commonReflectionOptions,
        action: 'GetEntityWithMap',
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
    // Request type has fields but the action is called without a body. On
    // protobufjs >=7.5.5 this fails serialization with ".<Type>: object expected"
    // unless the null body is coerced to an empty message {}.
    getEntityOptionalBody: {
        ...config,
        action: 'GetEntityOptionalBody',
        insecure: true,
    },
    // caller explicitly passes body: null — must be treated as an empty message.
    getEntityOptionalBodyExplicitNull: {
        ...config,
        action: 'GetEntityOptionalBody',
        params: () => ({body: null}),
        insecure: true,
    },
    // serverStream called without a body must not fail serialization either.
    getEntityListOptionalBodyServerStream: {
        ...config,
        action: 'GetEntityListOptionalBodyServerStream',
        insecure: true,
        type: 'serverStream' as const,
    },
    // google.protobuf.Empty request called without a body. A fieldless message is
    // tolerated by protobufjs 7.x but rejected by 8.x — guards the fix either way.
    getEntityWithEmptyRequest: {
        ...config,
        action: 'GetEntityWithEmptyRequest',
        insecure: true,
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
