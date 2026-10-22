import path from 'path';

import {createRoot} from '../components/grpc';

import {loadBatchSafeProtoPaths} from './batch-proto-loading';

const protoRoot = path.resolve(__dirname, '../../testProto/batch');

const getBatchSafeProtoPaths = (actions: Record<string, string>) =>
    loadBatchSafeProtoPaths(
        createRoot([protoRoot]),
        Object.entries(actions).map(([protoPath, protoKey]) => ({protoPath, protoKey})),
    );

describe('loadBatchSafeProtoPaths', () => {
    test('returns paths which resolve types to imported files', () => {
        expect(
            getBatchSafeProtoPaths({
                'service.proto': 'batch.v1.Service',
                'other.proto': 'batch.other.OtherService',
            }),
        ).toEqual(['service.proto', 'other.proto']);
    });

    test('excludes path with type shadowed by a type from not imported file', () => {
        expect(
            getBatchSafeProtoPaths({
                'service.proto': 'batch.v1.Service',
                'shadow-direct.proto': 'batch.v1.DirectShadowService',
            }),
        ).toEqual(['shadow-direct.proto']);
    });

    test('excludes path with type shadowed by a nested type', () => {
        expect(
            getBatchSafeProtoPaths({
                'service.proto': 'batch.v1.Service',
                'shadow-nested.proto': 'batch.v1.NestedShadowService',
            }),
        ).toEqual(['shadow-nested.proto']);
    });

    test('excludes path with type extended in not imported file', () => {
        expect(
            getBatchSafeProtoPaths({
                'extendable.proto': 'batch.ext.ExtendableService',
                'extension.proto': 'batch.ext.ExtensionService',
            }),
        ).toEqual(['extension.proto']);
    });

    test('excludes path with service from not imported file', () => {
        expect(
            getBatchSafeProtoPaths({
                'service.proto': 'batch.other.OtherService',
                'other.proto': 'batch.other.OtherService',
            }),
        ).toEqual(['other.proto']);
    });

    test('throws on conflicting definitions like per-file loading', () => {
        expect(() =>
            getBatchSafeProtoPaths({
                'shadow-direct.proto': 'batch.v1.DirectShadowService',
                'common.proto': 'batch.Request',
                '../greeter.proto': 'test.v1.Greeter',
                '../greeter2.proto': 'test.v1.Greeter',
            }),
        ).toThrow(/duplicate name/);
    });
});
