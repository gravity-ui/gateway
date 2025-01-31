import * as grpc from '@grpc/grpc-js';
import _ from 'lodash';
import * as protobufjs from 'protobufjs';

import {Lang} from '../constants.js';
import {GatewayError} from '../models/common.js';
import {AppErrorConstructor} from '../models/error.js';

import {decodeAnyMessageRecursively} from './grpc.js';

const DEFAULT_GATEWAY_CODE = 'GATEWAY_REQUEST_ERROR';
const DEFAULT_GATEWAY_MESSAGE = 'Gateway request error';

export function parseMixedError(e: Error & {code?: string}) {
    return {
        status: 500,
        message: String(e.message || DEFAULT_GATEWAY_MESSAGE),
        code: String(e.code || DEFAULT_GATEWAY_CODE),
        debug: {
            originalError: e,
            stack: e.stack,
        },
    };
}

function getErrorTitle(error: any) {
    const prop = _.propertyOf(error);
    const details = prop('details[0]');

    if (details) {
        return prop('details[0].type') || prop('details[0].code') || prop('code');
    }

    return prop('type') || prop('code');
}

function getErrorMessage(error: any) {
    const prop = _.propertyOf(error);
    const message = prop('message');
    const detail = prop('detail');
    const detailsMessage = prop('details[0].message');

    if (message) {
        return message;
    }

    if (detailsMessage) {
        return detailsMessage;
    }

    if (detail) {
        return prop('detail.Description') || prop('detail.Body') || detail;
    }

    return '';
}

function getStatusByGrpcCode(code?: number) {
    switch (code) {
        case 0:
            return 200;
        case 1:
            return 499;
        case 2:
            return 500;
        case 3:
            return 400;
        case 4:
            return 504;
        case 5:
            return 404;
        case 6:
            return 409;
        case 7:
            return 403;
        case 8:
            return 429;
        case 9:
            return 400;
        case 10:
            return 409;
        case 11:
            return 400;
        case 12:
            return 501;
        case 13:
            return 500;
        case 14:
            return 503;
        case 15:
            return 500;
        case 16:
            return 401;
        default:
            return 500;
    }
}

export function parseRestError(error: any, lang?: string): GatewayError {
    const prop = _.propertyOf(error);

    let status = 500;
    let title;
    let description;
    let details;
    let type;
    let code;
    let debug;

    if (prop('response')) {
        const responseData = prop('response.data');
        const statusTitle = `${prop('response.status')} ${prop('response.statusText')}`;
        const errorTitle = getErrorTitle(responseData);

        status = prop('response.status');
        code = prop('response.data.code');
        type = prop('response.data.type');
        details = prop('response.data.details');
        debug = prop('response.data.debug');

        title = errorTitle ? errorTitle : statusTitle;
        description = getErrorMessage(responseData);

        if (status === 403) {
            title = lang === Lang.Ru ? 'Доступ запрещен' : 'Access denied';
        }
    } else {
        code = prop('code');
        title = lang === Lang.Ru ? 'Ошибка' : 'Error';

        if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
            status = 504;
            description = lang === Lang.Ru ? 'Превышено время ожидания ответа' : 'Timeout exceeded';
        } else if (code === 'ERR_CANCELED') {
            status = 499;
            description = lang === Lang.Ru ? 'Запрос был отменен.' : 'Request was cancelled.';
        } else {
            status = 500;
            description =
                lang === Lang.Ru
                    ? 'Произошла непредвиденная ошибка. Попробуйте обновить страницу через некоторое время.'
                    : 'An unexpected error has occurred. Try to refresh the page in a few moments.';
        }
    }

    return {
        status,
        message: String(description || DEFAULT_GATEWAY_MESSAGE),
        code: String(code || DEFAULT_GATEWAY_CODE),
        details: {
            type,
            title,
            description,
            ...(typeof details === 'object' && !Array.isArray(details) ? details : {details}), // we want to spread objects only
        },
        debug,
    };
}

interface StatusMessage {
    code: number;
    message: string;
    details: any[];
}

function decodeGrpcStatusMessage(
    metadata: grpc.Metadata,
    packageRoot: protobufjs.Root,
    decodeAnyMessageProtoLoaderOptions?: protobufjs.IConversionOptions,
) {
    const statusMessageBin = metadata.get('grpc-status-details-bin')[0] as Buffer;

    if (!statusMessageBin) {
        return undefined;
    }

    return decodeAnyMessageRecursively(
        packageRoot,
        {
            type_url: 'type.googleapis.com/google.rpc.Status',
            value: statusMessageBin,
        },
        decodeAnyMessageProtoLoaderOptions,
    ) as StatusMessage;
}

export function parseGrpcError(
    error: grpc.ServiceError,
    packageRoot: protobufjs.Root,
    lang = Lang.Ru,
    decodeAnyMessageProtoLoaderOptions?: protobufjs.IConversionOptions,
): GatewayError {
    let title = lang === Lang.Ru ? 'Ошибка' : 'Error';

    if (error.code === 7) {
        // Always redefine title for Access denied errors
        title = lang === Lang.Ru ? 'Доступ запрещен' : 'Access denied';
    }

    let code = error.code;
    let description = error.details;
    let details;

    if (error.metadata) {
        try {
            const statusMessage = decodeGrpcStatusMessage(
                error.metadata,
                packageRoot,
                decodeAnyMessageProtoLoaderOptions,
            );

            if (statusMessage) {
                code = statusMessage.code;
                description = statusMessage.message;
                details = statusMessage.details;
            }
        } catch (e) {}
    }

    // Always redefine description for Timeout exceeded errors
    if (error.code === 4) {
        description = lang === Lang.Ru ? 'Превышено время ожидания ответа' : 'Timeout exceeded';
    }

    // Use default description if description is undefined, but not for Access denied errors
    if (!description) {
        description =
            lang === Lang.Ru
                ? 'Произошла непредвиденная ошибка. Попробуйте обновить страницу через некоторое время.'
                : 'An unexpected error has occurred. Try to refresh the page in a few moments.';
    }

    const status = getStatusByGrpcCode(error.code);

    return {
        status,
        message: String(description || DEFAULT_GATEWAY_MESSAGE),
        code: DEFAULT_GATEWAY_CODE,
        details: {
            title,
            description,
            grpcCode: code,
            ...(typeof details === 'object' && !Array.isArray(details) ? details : {details}), // we want to spread objects only,
        },
    };
}

export class GrpcError extends Error {
    private parsedError: GatewayError;
    private rawError: grpc.ServiceError | undefined;

    constructor(message: string, parsedError: GatewayError, rawError?: grpc.ServiceError) {
        super(message);

        this.parsedError = parsedError;
        this.rawError = rawError;
    }

    getGatewayError() {
        return this.parsedError;
    }

    getRawError() {
        return this.rawError;
    }

    getAppError(ErrorConstructor: AppErrorConstructor) {
        return new ErrorConstructor(this.parsedError.message, {
            code: this.parsedError.code,
            details: this.parsedError.details,
            debug: this.parsedError.debug,
        });
    }
}

export function isGrpcError(error: Error | GrpcError): error is GrpcError {
    return (error as GrpcError).getGatewayError !== undefined;
}

export function grpcErrorFactory(error: Error) {
    return new GrpcError(error.message, {
        status: 500,
        code: '',
        message: error.message,
        details: {},
    });
}
