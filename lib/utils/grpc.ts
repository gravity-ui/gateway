/* eslint-disable camelcase */

import * as grpc from '@grpc/grpc-js';
import * as protobufjs from 'protobufjs';

import {
    DEFAULT_PROTO_LOADER_OPTIONS,
    RECREATE_SERVICE_CODES,
    RETRYABLE_STATUS_CODES,
} from '../constants';

export function decodeAnyMessageRecursively(
    root: protobufjs.Root,
    message?: {type_url?: string; value?: Buffer},
) {
    if (!message || !message.type_url || !message.value) {
        return message;
    }

    const lastSlashIndex = message.type_url.lastIndexOf('/');

    if (lastSlashIndex < 0) {
        return message;
    }

    const typeName = message.type_url.substring(lastSlashIndex + 1);
    const type = root.lookupType(typeName);

    const data = type.toObject(type.decode(message.value), DEFAULT_PROTO_LOADER_OPTIONS);

    Object.keys(data).forEach((key) => {
        data[key] = decodeAnyMessageRecursively(root, data[key]);
    });

    return data;
}

export function traverseAnyMessage(root: protobufjs.Root, message?: any): any {
    if (!message) {
        return message;
    }

    if (Array.isArray(message)) {
        return message.map((item) => {
            return traverseAnyMessage(root, item);
        });
    }

    if (typeof message === 'object') {
        Object.keys(message).forEach((key) => {
            if (message[key]) {
                message[key] = traverseAnyMessage(root, message[key]);
            }
        });
    }

    return decodeAnyMessageRecursively(root, message);
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
