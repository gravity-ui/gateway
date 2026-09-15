import Ajv from 'ajv';

export function validateArgs<TParams>(args: TParams, schema: object) {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    return validate(args) ? false : ajv.errorsText(validate.errors);
}

const PATH_PARAM_PATTERN = /^((?!(\.\.|\?|#|\\|\/)).)*$/i;

export function getPathArgsProxy<TParams extends {}>(
    args: TParams,
    encodePathArgs = true,
    validatePathArgs = true,
    onInvalidPathParam: (param: string) => never = (param) => {
        throw new Error(`Invalid path params: ${param}`);
    },
    parentPath = '',
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

            const paramPath = Array.isArray(object)
                ? `${parentPath}[${String(key)}]`
                : parentPath
                ? `${parentPath}.${String(key)}`
                : String(key);

            if (typeof value === 'object' && value !== null) {
                return getPathArgsProxy(
                    value,
                    encodePathArgs,
                    validatePathArgs,
                    onInvalidPathParam,
                    paramPath,
                );
            }

            if (typeof value === 'string') {
                if (validatePathArgs && !PATH_PARAM_PATTERN.test(value)) {
                    return onInvalidPathParam(paramPath);
                }

                if (encodePathArgs) {
                    try {
                        return encodeURIComponent(value);
                    } catch {
                        return onInvalidPathParam(paramPath);
                    }
                }

                return value;
            }

            return value;
        },
    }) as unknown as TParams;
}
