import Ajv from 'ajv';

export function validateArgs<TParams>(args: TParams, schema: object) {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    return validate(args) ? false : ajv.errorsText(validate.errors);
}

export function encodePathParams<TParams extends {}>(params: TParams) {
    const encodedParams: Record<string, any> = {};

    Object.keys(params).forEach((key) => {
        const value = params[key as unknown as keyof TParams] as unknown as string | Buffer;

        if (value instanceof Buffer) {
            encodedParams[key] = value;
        } else if (typeof value === 'object' && value !== null) {
            encodedParams[key] = encodePathParams(value);
        } else {
            encodedParams[key] = encodeURIComponent(value);
        }
    });

    return encodedParams;
}

export function getPathParam(value: string) {
    return /^((?!(\.\.|\?|#|\\|\/)).)*$/i.test(value) ? value : '';
}

export function getPathArgsProxy<TParams extends {}>(
    args: TParams,
    encodePathArgs?: boolean,
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
                return getPathArgsProxy(value);
            }

            if (typeof value === 'string') {
                const pathParam = getPathParam(value);
                return encodePathArgs ? encodeURIComponent(pathParam) : pathParam;
            }

            return value; // TODO return error INVALID_PARAMS
        },
    }) as unknown as TParams;
}
