import getGatewayControllers from '../../lib';

import {ErrorConctructor, createCoreContext} from './create-core-context';
import {schema} from './schema/meta';

export function gatewayCall(request: any) {
    const controllers = getGatewayControllers(
        {local: schema},
        {
            installation: 'external',
            env: 'production',
            caCertificatePath: null,
            ErrorConctructor,
            getAuthArgs: () => ({}),
            getAuthHeaders: () => undefined,
            proxyHeaders: [],
            withDebugHeaders: false,
        },
    );

    const coreContextStub = createCoreContext(() => {});

    return new Promise((resolve, reject) => {
        controllers.api.local.meta
            .getFolderStats({
                requestId: 'test',
                headers: {},
                args: request,
                ctx: coreContextStub,
            })
            .then((result) => {
                resolve(result.responseData);
            })
            .catch(reject);
    });
}
