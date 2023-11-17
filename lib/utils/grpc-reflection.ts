import type {ChannelCredentials} from '@grpc/grpc-js';
import type {Client as GrpcReflectionClient} from 'grpc-reflection-js';
import _ from 'lodash';
import * as protobufjs from 'protobufjs';

const reflectionClientsMap: Record<string, GrpcReflectionClient> = {};
const reflectionRootPromiseMap: Record<string, Record<string, Promise<protobufjs.Root>>> = {};

function getCachedClient(
    actionEndpoint: string,
    credentials: ChannelCredentials,
    descriptorExtensionProto?: string[],
) {
    let client = reflectionClientsMap[actionEndpoint];
    if (!client) {
        const grpcReflection = require('grpc-reflection-js');
        client = new grpcReflection.Client(
            actionEndpoint,
            credentials,
            undefined,
            undefined,
            descriptorExtensionProto,
        );
        reflectionClientsMap[actionEndpoint] = client;
    }

    return client;
}

/**
 * @param actionEndpoint
 * @param protoKey
 * @param credentials
 * @param descriptorExtensionProto
 * @returns Promise<protobufjs.Root>.
 * use toDescriptor for use with protoLoader.
 * use toJSON for get a JSON descriptor.
 */
export async function getCachedReflectionRoot(
    actionEndpoint: string,
    protoKey: string,
    credentials: ChannelCredentials,
    descriptorExtensionProto?: string[],
) {
    const client = getCachedClient(actionEndpoint, credentials, descriptorExtensionProto);

    let cachedRootPromise = _.get(reflectionRootPromiseMap, [actionEndpoint, protoKey]);
    if (!cachedRootPromise) {
        cachedRootPromise = client.fileContainingSymbol(protoKey);
        _.set(reflectionRootPromiseMap, [actionEndpoint, protoKey], cachedRootPromise);
    }
    const loadedRoot = await cachedRootPromise;
    return loadedRoot;
}

/**
 * @param actionEndpoint
 * @param protoKey
 * @param credentials
 * @param addToCache
 * @returns Promise<protobufjs.Root>.
 * use toDescriptor for use with protoLoader.
 * use toJSON for get a JSON descriptor.
 */
export async function getReflectionRoot(
    actionEndpoint: string,
    protoKey: string,
    credentials: ChannelCredentials,
    addToCache?: boolean,
) {
    const client = getCachedClient(actionEndpoint, credentials);
    const loadedRoot = await client.fileContainingSymbol(protoKey);
    if (addToCache) {
        _.set(reflectionRootPromiseMap, [actionEndpoint, protoKey], Promise.resolve(loadedRoot));
    }
    return loadedRoot;
}
