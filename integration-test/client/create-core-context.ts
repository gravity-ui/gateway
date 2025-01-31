import {Console} from 'console';

import {Dict, GatewayContext, GatewayContextParams} from '../../src/index.js';

const logger = new Console({stdout: process.stdout});
const logFactory = (type: string) => (message: string, _params: any) => {
    logger.log(type, message);
};

type Params = GatewayContextParams & {
    utils: GatewayContext['utils'] & {
        stats?: CoreContext['stats'];
        log?: GatewayContext['log'];
        logError?: GatewayContext['logError'];
    };
    parentContext?: CoreContext;
};

export const ROOT_CONTEXT_NAME = 'root';

export class CoreContext implements GatewayContext {
    name: string;
    params: Params;
    utils: Params['utils'];
    stats: (data: {[name: string]: string | number}) => void;
    private logPrefix: string;

    constructor(name: string, params: Params) {
        this.name = name;
        this.params = params;
        const parent = params?.parentContext;
        this.utils = params?.utils || parent?.utils;
        this.stats = this.utils?.stats ?? (() => {});
        const parentLogPrefix = parent?.name === ROOT_CONTEXT_NAME ? '' : parent?.logPrefix || '';
        this.logPrefix = this.name === ROOT_CONTEXT_NAME ? '' : `${parentLogPrefix}[${name}]`;
        if (this.logPrefix) {
            this.logPrefix += ' ';
        }
    }

    create(name: string, params?: GatewayContextParams) {
        return new CoreContext(name, {
            ...params,
            parentContext: this,
        } as any) as this;
    }

    log(message: string, extra?: Dict) {
        this.utils.log?.(this.logPrefix + message, extra);
    }

    logError(message: string, error?: unknown, extra?: Dict) {
        this.utils.logError?.(this.logPrefix + message, error, extra);
    }

    end() {}
    getMetadata() {
        return {};
    }
}

export function createCoreContext(stats: () => void) {
    return new CoreContext('test', {
        utils: {
            stats,
            log: logFactory('log'),
            logError: logFactory('logError'),
        },
    });
}

export class ErrorConstructor extends Error {
    static wrap(error: Error) {
        return error;
    }
}
