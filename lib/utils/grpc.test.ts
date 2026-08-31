import path from 'path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as protobufjs from 'protobufjs';

import {DEFAULT_PROTO_LOADER_OPTIONS} from '../constants';

import {isGrpcRequestSerializationError, validateGrpcRequestBody} from './grpc';

function loadProtoArtifacts(protoPath: string) {
    const root = new protobufjs.Root();
    root.loadSync(protoPath);
    const definition = protoLoader.loadSync(protoPath, DEFAULT_PROTO_LOADER_OPTIONS);
    const packageObject = grpc.loadPackageDefinition(definition);

    return {root, packageObject};
}

describe('validateGrpcRequestBody', () => {
    const integrationProtoPath = path.join(
        __dirname,
        '../../integration-test/proto/test_service.proto',
    );
    const {root, packageObject} = loadProtoArtifacts(integrationProtoPath);

    test('should return null for a valid nested message', () => {
        expect(
            validateGrpcRequestBody(root, packageObject, 'v1.MetaService', 'GetEntityWithNested', {
                item: {name: 'test'},
            }),
        ).toBeNull();
    });

    test('should return validation error when field types do not match proto', () => {
        expect(
            validateGrpcRequestBody(root, packageObject, 'v1.MetaService', 'GetEntityWithNested', {
                item: 'not-a-nested-object',
            }),
        ).toBe('.v1.GetEntityWithNestedRequest.item: object expected');
    });

    test('should accept values coercible by fromObject', () => {
        const requestType = root.lookupType('v1.GetEntityRequest');

        expect(requestType.verify({query: 123})).toBe('query: string expected');
        expect(
            validateGrpcRequestBody(root, packageObject, 'v1.MetaService', 'GetEntityUnary', {
                query: 123,
            }),
        ).toBeNull();
    });

    test('should return null when service is not loaded in package object', () => {
        expect(
            validateGrpcRequestBody(
                root,
                packageObject,
                'v1.UnknownService',
                'GetEntityWithNested',
                {},
            ),
        ).toBeNull();
    });
});

describe('isGrpcRequestSerializationError', () => {
    test('should detect client-side request serialization failures', () => {
        expect(
            isGrpcRequestSerializationError({
                code: grpc.status.INTERNAL,
                details: 'Request message serialization failure: .v1.NestedItem: object expected',
            } as grpc.ServiceError),
        ).toBe(true);
    });

    test('should not treat unrelated internal errors as serialization failures', () => {
        expect(
            isGrpcRequestSerializationError({
                code: grpc.status.INTERNAL,
                details: 'Something went wrong on the server',
            } as grpc.ServiceError),
        ).toBe(false);
    });
});
