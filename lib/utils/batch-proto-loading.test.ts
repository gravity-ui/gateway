import path from 'path';

import {loadProtosWithOptionsSync} from '@grpc/proto-loader/build/src/util';
import * as protobufjs from 'protobufjs';

import {createRoot} from '../components/grpc';
import {DEFAULT_PROTO_LOADER_OPTIONS} from '../constants';

import {ProtoActionRef, loadBatchSafeProtoPaths} from './batch-proto-loading';

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

const diffProtoRoot = path.resolve(__dirname, '../../testProto/batch-diff');

function getServiceSignature(root: protobufjs.Root, protoKey: string) {
    const service = root.lookup(`.${protoKey}`);
    if (!(service instanceof protobufjs.Service)) {
        return 'missing';
    }

    const types = new Map<string, string>();
    const visit = (type: protobufjs.Type) => {
        if (types.has(type.fullName)) {
            return;
        }
        types.set(type.fullName, '');
        const fields = type.fieldsArray.map((field) => {
            field.resolve();
            if (field.resolvedType instanceof protobufjs.Type) {
                visit(field.resolvedType);
            }
            const keyType = field instanceof protobufjs.MapField ? field.keyType : '';
            const fieldType = field.resolvedType ? field.resolvedType.fullName : field.type;
            const label = (field.repeated && 'repeated') || (field.required && 'required') || '';
            return [field.id, field.name, label, keyType, fieldType].join(':');
        });
        types.set(type.fullName, fields.sort().join(','));
    };

    service.resolveAll();
    const methods = service.methodsArray.map((method) => {
        visit(method.resolvedRequestType as protobufjs.Type);
        visit(method.resolvedResponseType as protobufjs.Type);
        return [
            method.name,
            method.resolvedRequestType?.fullName,
            method.resolvedResponseType?.fullName,
            Boolean(method.requestStream),
            Boolean(method.responseStream),
        ].join(':');
    });

    return JSON.stringify({methods, types: [...types].sort()});
}

// Proto paths of the actions whose services differ in the batch and with per-file loading
function getBatchDifferences(dir: string, actions: ProtoActionRef[], batchPaths: string[]) {
    if (batchPaths.length < 2) {
        return [];
    }

    const options = {...DEFAULT_PROTO_LOADER_OPTIONS, includeDirs: [dir]};
    const batchRoot = loadProtosWithOptionsSync(batchPaths, options);

    return actions
        .filter(({protoPath}) => batchPaths.includes(protoPath))
        .filter(
            ({protoPath, protoKey}) =>
                getServiceSignature(loadProtosWithOptionsSync(protoPath, options), protoKey) !==
                getServiceSignature(batchRoot, protoKey),
        )
        .map(({protoPath}) => protoPath);
}

describe('batch loading keeps type resolution of per-file loading', () => {
    const cases: {
        name: string;
        actions: Record<string, string>;
        batchSafe: string[];
        // Batch without the check, it must break at least in one action order
        unsafeBatch: string[];
    }[] = [
        {
            name: 'fqn',
            actions: {
                'fqn-service.proto': 'fqn.Service',
                'fqn-root.proto': 'RootService',
            },
            batchSafe: ['fqn-root.proto'],
            unsafeBatch: ['fqn-service.proto', 'fqn-root.proto'],
        },
        {
            name: 'dotted',
            actions: {
                'dotted-service.proto': 'dotted.Service',
                'dotted-foo.proto': 'foo.FooService',
            },
            batchSafe: ['dotted-foo.proto'],
            unsafeBatch: ['dotted-service.proto', 'dotted-foo.proto'],
        },
        {
            name: 'extend',
            actions: {
                'extend-user.proto': 'ext.v1.Service',
                'extend-other.proto': 'ext.v1.OtherService',
            },
            batchSafe: [],
            unsafeBatch: ['extend-user.proto', 'extend-other.proto'],
        },
        {
            name: 'options',
            actions: {
                'options-service.proto': 'options.Service',
                'options-extension.proto': 'options.ext.ExtensionService',
                'options-other.proto': 'options.other.OtherService',
            },
            batchSafe: ['options-extension.proto', 'options-other.proto'],
            unsafeBatch: ['options-service.proto', 'options-extension.proto'],
        },
        {
            name: 'nested-path',
            actions: {
                'nested-service.proto': 'nested.Service',
                'nested-shadow.proto': 'nested.Request.x.ShadowService',
                'nested-partial.proto': 'nested.Request.MissingService',
            },
            batchSafe: ['nested-shadow.proto'],
            unsafeBatch: ['nested-service.proto', 'nested-shadow.proto'],
        },
        {
            name: 'absolute',
            actions: {
                'absolute-service.proto': 'absolute.Service',
                'absolute-y.proto': 'y.a.YService',
            },
            batchSafe: ['absolute-y.proto'],
            unsafeBatch: ['absolute-service.proto', 'absolute-y.proto'],
        },
        {
            name: 'same-name',
            actions: {
                'same-name-get.proto': 'same.Service',
                'same-name-other.proto': 'same.other.OtherService',
            },
            batchSafe: ['same-name-get.proto', 'same-name-other.proto'],
            unsafeBatch: [],
        },
    ];

    test.each(cases)('$name', ({name, actions, batchSafe, unsafeBatch}) => {
        const dir = path.join(diffProtoRoot, name);
        const actionRefs = Object.entries(actions).map(([protoPath, protoKey]) => ({
            protoPath,
            protoKey,
        }));
        const orders = [actionRefs, [...actionRefs].reverse()];

        for (const order of orders) {
            const paths = loadBatchSafeProtoPaths(createRoot([dir]), order);

            expect([...paths].sort()).toEqual([...batchSafe].sort());
            expect(getBatchDifferences(dir, order, paths)).toEqual([]);
        }

        if (unsafeBatch.length) {
            const differences = orders.flatMap((order) =>
                getBatchDifferences(
                    dir,
                    order,
                    order.map(({protoPath}) => protoPath).filter((p) => unsafeBatch.includes(p)),
                ),
            );
            expect(differences).not.toEqual([]);
        }
    });
});
