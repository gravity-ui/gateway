import {GATEWAY_INVALID_PARAM_VALUE} from '../constants';

import {getPathArgsProxy, validateArgs} from './validate';

describe('validate: getPathArgsProxy', () => {
    test('should escape path params', () => {
        const args = {
            fieldA: 123,
            fieldB: 'abc',
            fieldC: 'ac/ad',
            fieldD: {
                fieldE: 2,
                fieldF: 'long-long_field',
                fieldG: [{arrField: 123}, {arrField: null}, {arrField: 'empty/null'}],
                fieldH: 'localhost?p=1',
                fieldI: true,
            },
            fieldJ: false,
            fieldK: ['a', 1, true],
            fieldL: 'hello world',
            fieldM: 'test@example.com',
            fieldN: '\uDCE2',
        };

        const pathArgsProxy = getPathArgsProxy(args);

        expect(pathArgsProxy.fieldA).toBe(123);
        expect(pathArgsProxy.fieldB).toBe('abc');
        expect(pathArgsProxy.fieldC).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.fieldD.fieldE).toBe(2);
        expect(pathArgsProxy.fieldD.fieldF).toBe('long-long_field');
        expect(pathArgsProxy.fieldD.fieldG[0].arrField).toBe(123);
        expect(pathArgsProxy.fieldD.fieldG[1].arrField).toBe(null);
        expect(pathArgsProxy.fieldD.fieldG[2].arrField).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.fieldD.fieldH).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.fieldD.fieldI).toBe(true);
        expect(pathArgsProxy.fieldJ).toBe(false);
        expect(pathArgsProxy.fieldK[0]).toBe('a');
        expect(pathArgsProxy.fieldK[1]).toBe(1);
        expect(pathArgsProxy.fieldK[2]).toBe(true);
        expect(pathArgsProxy.fieldL).toBe('hello%20world');
        expect(pathArgsProxy.fieldM).toBe('test%40example.com');
        expect(pathArgsProxy.fieldN).toBe(GATEWAY_INVALID_PARAM_VALUE);
    });

    test('should not encode URI components when encodePathArgs is false', () => {
        const args = {
            fieldA: 'hello world',
            fieldB: 'test@example.com',
            fieldC: 'ac/ad',
            fieldD: '\uDCE2',
        };

        const pathArgsProxy = getPathArgsProxy(args, false);

        expect(pathArgsProxy.fieldA).toBe('hello world');
        expect(pathArgsProxy.fieldB).toBe('test@example.com');
        expect(pathArgsProxy.fieldC).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.fieldD).toBe('\uDCE2');
    });
});

describe('validate: validateArgs', () => {
    const args = {
        field1: 'test',
        field2: 15,
    };

    test('should return empty invalid params', () => {
        const schema = {
            type: 'object',
            required: ['field1', 'field2'],
            properties: {
                field1: {type: 'string'},
                field2: {type: 'number'},
            },
        };

        const invalidParams = validateArgs(args, schema);
        expect(invalidParams).toBeFalsy();
    });

    test('should return invalid params due to missing required field', () => {
        const schema = {
            type: 'object',
            required: ['field1', 'field2', 'field4'],
            properties: {
                field1: {type: 'string'},
                field2: {type: 'number'},
                field4: {type: 'string'},
            },
        };

        const invalidParams = validateArgs(args, schema);
        expect(invalidParams).toBeTruthy();
    });

    test('should return invalid params due to wrong field', () => {
        const schema = {
            type: 'object',
            properties: {
                field1: {type: 'string'},
                field2: {type: 'string'},
            },
        };

        const invalidParams = validateArgs(args, schema);
        expect(invalidParams).toBeTruthy();
    });
});
