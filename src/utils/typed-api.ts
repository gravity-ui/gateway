import {ContextApiWithRoot, SchemasByScope} from '../models/common.js';

export function getTypedApiFactory<TSchema extends SchemasByScope>() {
    return (api: unknown) => api as ContextApiWithRoot<TSchema>;
}
