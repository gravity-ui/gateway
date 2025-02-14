import type {ChannelCredentials} from '@grpc/grpc-js';
import type {Client as GrpcReflectionClient} from 'grpc-reflection-js';
import _ from 'lodash';
import * as protobufjs from 'protobufjs';

import {patchProtoPathResolver} from './proto-path-resolver.js';

type ClientWithCache = {
    client: GrpcReflectionClient;
    reflectionRootPromiseMap: Record<string, Record<string, Promise<protobufjs.Root>>>;
};

const reflectionClientsMap: Record<string, Record<string, ClientWithCache>> = {};

type DescriptorExtensionProto =
    | string[]
    | {
          includeProtoRoots: string[];
          filenames: string[];
      };

async function getCachedClient(
    actionEndpoint: string,
    credentials: ChannelCredentials,
    grpcOptions?: object,
    descriptorExtensionProto?: DescriptorExtensionProto,
) {
    const cacheKey = [actionEndpoint, JSON.stringify([grpcOptions, descriptorExtensionProto])];
    let clientWithCache = _.get(reflectionClientsMap, cacheKey);

    if (!clientWithCache) {
        const grpcReflection = await import('grpc-reflection-js');
        let descriptorRoot: protobufjs.Root | undefined;

        if (descriptorExtensionProto) {
            descriptorRoot = protobufjs.Root.fromJSON(
                // @ts-expect-error no typings for default export
                (await import('protobufjs/ext/descriptor/index.js')).default,
            );
            if (Array.isArray(descriptorExtensionProto)) {
                descriptorRoot.loadSync(descriptorExtensionProto);
            } else {
                patchProtoPathResolver(descriptorRoot, descriptorExtensionProto.includeProtoRoots);
                descriptorRoot.loadSync(descriptorExtensionProto.filenames);
            }
        }

        const client = new grpcReflection.Client(
            actionEndpoint,
            credentials,
            grpcOptions,
            undefined,
            // @ts-ignore this parameter is present only in the patched version
            descriptorRoot,
        );

        clientWithCache = {client, reflectionRootPromiseMap: {}};
        _.set(reflectionClientsMap, cacheKey, clientWithCache);
    }

    return clientWithCache;
}

/**
 * @param actionEndpoint
 * @param protoKey
 * @param credentials
 * @param grpcOptions
 * @param descriptorExtensionProto
 * @returns Promise<protobufjs.Root>.
 * use toDescriptor for use with protoLoader.
 * use toJSON for get a JSON descriptor.
 */
export async function getCachedReflectionRoot(
    actionEndpoint: string,
    protoKey: string,
    credentials: ChannelCredentials,
    grpcOptions?: object,
    descriptorExtensionProto?: DescriptorExtensionProto,
) {
    const {client, reflectionRootPromiseMap} = await getCachedClient(
        actionEndpoint,
        credentials,
        grpcOptions,
        descriptorExtensionProto,
    );
    const cacheKey = [actionEndpoint, protoKey];
    let cachedRootPromise = _.get(reflectionRootPromiseMap, cacheKey);
    if (!cachedRootPromise) {
        cachedRootPromise = client.fileContainingSymbol(protoKey);
        _.set(reflectionRootPromiseMap, cacheKey, cachedRootPromise);
        cachedRootPromise.catch(() => {
            _.set(reflectionRootPromiseMap, cacheKey, undefined);
        });
    }
    const loadedRoot = await cachedRootPromise;
    return loadedRoot;
}

/**
 * @param actionEndpoint
 * @param protoKey
 * @param credentials
 * @param grpcOptions
 * @param addToCache
 * @returns Promise<protobufjs.Root>.
 * use toDescriptor for use with protoLoader.
 * use toJSON for get a JSON descriptor.
 */
export async function getReflectionRoot(
    actionEndpoint: string,
    protoKey: string,
    credentials: ChannelCredentials,
    grpcOptions?: object,
    addToCache?: boolean,
) {
    const {client, reflectionRootPromiseMap} = await getCachedClient(
        actionEndpoint,
        credentials,
        grpcOptions,
    );
    const loadedRoot = await client.fileContainingSymbol(protoKey);
    if (addToCache) {
        _.set(reflectionRootPromiseMap, [actionEndpoint, protoKey], Promise.resolve(loadedRoot));
    }
    return loadedRoot;
}
