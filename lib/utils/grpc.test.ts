import path from 'path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

import {DEFAULT_PROTO_LOADER_OPTIONS} from '../constants';

import {validateGrpcRequestBody} from './grpc';

function loadPackageObject(protoPath: string): grpc.GrpcObject {
    const definition = protoLoader.loadSync(protoPath, DEFAULT_PROTO_LOADER_OPTIONS);

    return grpc.loadPackageDefinition(definition);
}

describe('validateGrpcRequestBody', () => {
    const integrationProtoPath = path.join(
        __dirname,
        '../../integration-test/proto/test_service.proto',
    );
    const packageObject = loadPackageObject(integrationProtoPath);

    test('should return null for a valid nested message', () => {
        expect(
            validateGrpcRequestBody(packageObject, 'v1.MetaService', 'GetEntityWithNested', {
                item: {name: 'test'},
            }),
        ).toBeNull();
    });

    test('should return validation error when field types do not match proto', () => {
        expect(
            validateGrpcRequestBody(packageObject, 'v1.MetaService', 'GetEntityWithNested', {
                item: 'not-a-nested-object',
            }),
        ).toBe('.v1.GetEntityWithNestedRequest.item: object expected');
    });

    test('should accept values coercible by requestSerialize', () => {
        expect(
            validateGrpcRequestBody(packageObject, 'v1.MetaService', 'GetEntityUnary', {
                query: 123,
            }),
        ).toBeNull();
    });

    test('should return null when service is not loaded in package object', () => {
        expect(
            validateGrpcRequestBody(packageObject, 'v1.UnknownService', 'GetEntityWithNested', {}),
        ).toBeNull();
    });
});
