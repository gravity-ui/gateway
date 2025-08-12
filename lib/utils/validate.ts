import Ajv from 'ajv';

import {GATEWAY_INVALID_PARAM_VALUE} from '../constants';

export function validateArgs<TParams>(args: TParams, schema: object) {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    return validate(args) ? false : ajv.errorsText(validate.errors);
}

export function getPathParam(value: string) {
    return /^((?!(\.\.|\?|#|\\|\/)).)*$/i.test(value) ? value : GATEWAY_INVALID_PARAM_VALUE;
}

export function getPathArgsProxy<TParams extends {}>(
    args: TParams,
    encodePathArgs = true,
    validatePathArgs = true,
): TParams {
    if (!args) {
        return args;
    }

    return new Proxy(args, {
        get: (object, key) => {
            const value = object[key as keyof TParams] as unknown;

            if (value instanceof Buffer) {
                return value;
            }

            if (typeof value === 'object' && value !== null) {
                return getPathArgsProxy(value, encodePathArgs, validatePathArgs);
            }

            if (typeof value === 'string') {
                const pathParam = validatePathArgs ? getPathParam(value) : value;

                if (encodePathArgs) {
                    try {
                        return encodeURIComponent(pathParam);
                    } catch (error) {
                        return GATEWAY_INVALID_PARAM_VALUE;
                    }
                }

                return pathParam;
            }

            return value; // TODO return error INVALID_PARAMS
        },
    }) as unknown as TParams;
}
