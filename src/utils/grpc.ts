/* eslint-disable camelcase */

import * as grpc from '@grpc/grpc-js';
import * as protobufjs from 'protobufjs';

import {
    DEFAULT_PROTO_LOADER_OPTIONS,
    RECREATE_SERVICE_CODES,
    RETRYABLE_STATUS_CODES,
} from '../constants.js';

type EncodedMessage = {type_url: string; value: Buffer};

function isEncodedMessage(
    message: Record<string, any> | EncodedMessage,
): message is EncodedMessage {
    return Boolean(message.type_url && message.value);
}

export function decodeAnyMessageRecursively(
    root: protobufjs.Root,
    message?: unknown,
    decodeAnyMessageProtoLoaderOptions?: protobufjs.IConversionOptions,
): unknown {
    if (!message || typeof message !== 'object') {
        return message;
    }

    if (Array.isArray(message)) {
        return message.map((innerMessage: unknown) =>
            decodeAnyMessageRecursively(root, innerMessage, decodeAnyMessageProtoLoaderOptions),
        );
    }

    if (typeof message === 'object' && !isEncodedMessage(message)) {
        return Object.entries(message as Record<string, unknown>).reduce((res, [key, value]) => {
            res[key] = decodeAnyMessageRecursively(root, value, decodeAnyMessageProtoLoaderOptions);
            return res;
        }, {} as Record<string, unknown>);
    }

    const lastSlashIndex = message.type_url.lastIndexOf('/');

    if (lastSlashIndex < 0) {
        return message;
    }

    const typeName = message.type_url.substring(lastSlashIndex + 1);
    const type = root.lookupType(typeName);
    const decodedMessage = type.toObject(type.decode(message.value), {
        ...DEFAULT_PROTO_LOADER_OPTIONS,
        ...decodeAnyMessageProtoLoaderOptions,
    });

    return decodeAnyMessageRecursively(root, decodedMessage, decodeAnyMessageProtoLoaderOptions);
}

export function isRetryableError(error?: grpc.ServiceError) {
    if (!error) {
        return false;
    }

    return RETRYABLE_STATUS_CODES.includes(error.code);
}

export function isRecreateServiceError(error?: grpc.ServiceError) {
    if (!error) {
        return false;
    }

    return RECREATE_SERVICE_CODES.includes(error.code);
}
