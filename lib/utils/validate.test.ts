import {GATEWAY_INVALID_PARAM_VALUE} from '../constants';

import {getPathArgsProxy, validateArgs} from './validate';

describe('validate: getPathArgsProxy', () => {
    test('should escape path params', () => {
        const args = {
            numberId: 123,
            validPath: 'abc',
            pathWithSlash: 'ac/ad',
            nestedObject: {
                numberId: 2,
                validNestedPath: 'long-long_field',
                arrayWithPaths: [{pathId: 123}, {pathId: null}, {pathId: 'empty/null'}],
                urlWithQuery: 'localhost?p=1',
                booleanFlag: true,
            },
            booleanValue: false,
            mixedArray: ['a', 1, true],
            pathWithSpaces: 'hello world',
            emailPath: 'test@example.com',
            invalidUnicode: '\uDCE2',
        };

        const pathArgsProxy = getPathArgsProxy(args);

        expect(pathArgsProxy.numberId).toBe(123);
        expect(pathArgsProxy.validPath).toBe('abc');
        expect(pathArgsProxy.pathWithSlash).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.nestedObject.numberId).toBe(2);
        expect(pathArgsProxy.nestedObject.validNestedPath).toBe('long-long_field');
        expect(pathArgsProxy.nestedObject.arrayWithPaths[0].pathId).toBe(123);
        expect(pathArgsProxy.nestedObject.arrayWithPaths[1].pathId).toBe(null);
        expect(pathArgsProxy.nestedObject.arrayWithPaths[2].pathId).toBe(
            GATEWAY_INVALID_PARAM_VALUE,
        );
        expect(pathArgsProxy.nestedObject.urlWithQuery).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.nestedObject.booleanFlag).toBe(true);
        expect(pathArgsProxy.booleanValue).toBe(false);
        expect(pathArgsProxy.mixedArray[0]).toBe('a');
        expect(pathArgsProxy.mixedArray[1]).toBe(1);
        expect(pathArgsProxy.mixedArray[2]).toBe(true);
        expect(pathArgsProxy.pathWithSpaces).toBe('hello%20world');
        expect(pathArgsProxy.emailPath).toBe('test%40example.com');
        expect(pathArgsProxy.invalidUnicode).toBe(GATEWAY_INVALID_PARAM_VALUE);
    });

    test('should not encode URI components when encodePathArgs is false', () => {
        const args = {
            pathWithSpaces: 'hello world',
            emailPath: 'test@example.com',
            pathWithSlash: 'ac/ad',
            invalidUnicode: '\uDCE2',
            nestedObject: {
                pathWithSpaces: 'hello world',
                emailPath: 'test@example.com',
                pathWithSlash: 'ac/ad',
                invalidUnicode: '\uDCE2',
            },
        };

        const pathArgsProxy = getPathArgsProxy(args, false);

        expect(pathArgsProxy.pathWithSpaces).toBe('hello world');
        expect(pathArgsProxy.emailPath).toBe('test@example.com');
        expect(pathArgsProxy.pathWithSlash).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.invalidUnicode).toBe('\uDCE2');
        expect(pathArgsProxy.nestedObject.pathWithSpaces).toBe('hello world');
        expect(pathArgsProxy.nestedObject.emailPath).toBe('test@example.com');
        expect(pathArgsProxy.nestedObject.pathWithSlash).toBe(GATEWAY_INVALID_PARAM_VALUE);
        expect(pathArgsProxy.nestedObject.invalidUnicode).toBe('\uDCE2');
    });

    test('should not validate path arguments when validatePathArgs is false', () => {
        const args = {
            normalPath: 'normal-path_123',
            pathWithSlash: 'path/with/slash',
            pathWithQuestion: 'path?query=value',
            pathWithHash: 'path#fragment',
            pathWithBackslash: 'path\\backslash',
            pathWithDotDot: 'path/../parent',
            spaceInPath: 'hello world',
            specialChars: 'test@example.com',
            normalNumber: 123,
            booleanValue: true,
            nullValue: null,
            nestedObject: {
                nestedPath: 'nested/path',
                nestedSpecial: 'nested?value',
            },
        };

        const pathArgsProxy = getPathArgsProxy(args, true, false);

        // When validatePathArgs = false, all strings should be encoded but NOT replaced with INVALID_PARAM_VALUE
        expect(pathArgsProxy.normalPath).toBe('normal-path_123');
        expect(pathArgsProxy.pathWithSlash).toBe('path%2Fwith%2Fslash');
        expect(pathArgsProxy.pathWithQuestion).toBe('path%3Fquery%3Dvalue');
        expect(pathArgsProxy.pathWithHash).toBe('path%23fragment');
        expect(pathArgsProxy.pathWithBackslash).toBe('path%5Cbackslash');
        expect(pathArgsProxy.pathWithDotDot).toBe('path%2F..%2Fparent');
        expect(pathArgsProxy.spaceInPath).toBe('hello%20world');
        expect(pathArgsProxy.specialChars).toBe('test%40example.com');

        // Non-string values should remain unchanged
        expect(pathArgsProxy.normalNumber).toBe(123);
        expect(pathArgsProxy.booleanValue).toBe(true);
        expect(pathArgsProxy.nullValue).toBe(null);

        // Nested objects should also be encoded without validation
        expect(pathArgsProxy.nestedObject.nestedPath).toBe('nested%2Fpath');
        expect(pathArgsProxy.nestedObject.nestedSpecial).toBe('nested%3Fvalue');
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
