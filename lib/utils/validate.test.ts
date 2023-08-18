import {encodePathParams, getPathArgsProxy, validateArgs} from './validate';

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
        };

        const pathArgsProxy = getPathArgsProxy(args);

        expect(pathArgsProxy.fieldA).toBe(123);
        expect(pathArgsProxy.fieldB).toBe('abc');
        expect(pathArgsProxy.fieldC).toBe('');
        expect(pathArgsProxy.fieldD.fieldE).toBe(2);
        expect(pathArgsProxy.fieldD.fieldF).toBe('long-long_field');
        expect(pathArgsProxy.fieldD.fieldG[0].arrField).toBe(123);
        expect(pathArgsProxy.fieldD.fieldG[1].arrField).toBe(null);
        expect(pathArgsProxy.fieldD.fieldG[2].arrField).toBe('');
        expect(pathArgsProxy.fieldD.fieldH).toBe('');
        expect(pathArgsProxy.fieldD.fieldI).toBe(true);
        expect(pathArgsProxy.fieldJ).toBe(false);
        expect(pathArgsProxy.fieldK[0]).toBe('a');
        expect(pathArgsProxy.fieldK[1]).toBe(1);
        expect(pathArgsProxy.fieldK[2]).toBe(true);
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

describe('validate: encodePathParams', () => {
    test('should encode path params', () => {
        const args = {
            fieldA: 123,
            fieldB: 'abc',
            fieldC: 'ac/ad',
            fieldD: {
                fieldE: 2,
                fieldF: 'long-long_field',
                fieldG: [{arrField: 123}, {arrField: null}, {arrField: 'empty/null'}],
                fieldH: 'localhost?p=1',
            },
        };

        const encodedPathArgs = encodePathParams(args);

        expect(encodedPathArgs.fieldA).toBe('123');
        expect(encodedPathArgs.fieldB).toBe('abc');
        expect(encodedPathArgs.fieldC).toBe('ac%2Fad');
        expect(encodedPathArgs.fieldD.fieldE).toBe('2');
        expect(encodedPathArgs.fieldD.fieldF).toBe('long-long_field');
        expect(encodedPathArgs.fieldD.fieldG[0].arrField).toBe('123');
        expect(encodedPathArgs.fieldD.fieldG[1].arrField).toBe('null');
        expect(encodedPathArgs.fieldD.fieldG[2].arrField).toBe('empty%2Fnull');
        expect(encodedPathArgs.fieldD.fieldH).toBe('localhost%3Fp%3D1');
    });
});
