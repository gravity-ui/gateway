import _ from 'lodash';

import {ActionEndpoint, ExtendedActionEndpoint, SchemasByScope} from '../..';

export interface OverrideParams {
    [serviceKeyScope: string]: {
        [endpointName: string]: ActionEndpoint;
    };
}

interface OverrideEndpoint {
    scope: string;
    serviceKey: string;
    endpointName: string;
    config: ActionEndpoint;
}

function parseOverrideEndpointsParams(params: OverrideParams) {
    const parsedParams: OverrideEndpoint[] = [];

    for (const [serviceKeyScope, serviceKeyValues] of Object.entries(params)) {
        for (const [endpointName, config] of Object.entries(serviceKeyValues)) {
            let scope = 'root';
            let serviceKey = serviceKeyScope;
            const pointInd = serviceKey.indexOf('.');
            if (pointInd >= 0) {
                scope = serviceKey.slice(0, pointInd);
                serviceKey = serviceKey.slice(pointInd + 1);
            }

            parsedParams.push({
                scope,
                serviceKey,
                endpointName,
                config,
            });
        }
    }

    return parsedParams;
}

function getKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
}

function deepCopy<T extends Record<keyof T, T[keyof T]>>(obj: T) {
    const res = {...obj};
    getKeys(res).forEach((key) => {
        if (typeof res[key] === 'object' && !Array.isArray(res[key]) && res[key] !== null) {
            res[key] = deepCopy(res[key]);
        }
    });
    return res;
}

/**
 * Overrides endpoints in the schema according to overrideParams
 * @param originalSchema Schema for the gateway
 * @param overrideParams Definitions of endpoints for services in the format {[<scope>.<service key>]: {[<endpointName>]: ActionEndpoint}}
 * If <scope> is not specified, root is assumed.
 * Example: '{serviceName: {endpoint: "https://example.com"}}'
 * @param installation
 * @param env
 * @return new overridden schema
 */
export function overrideEndpoints<T extends SchemasByScope>(
    originalSchema: T,
    overrideParams: OverrideParams,
    installation: string | undefined,
    env: string | undefined,
) {
    if (!installation) {
        console.warn('overrideEndpoints: installation empty');
        return originalSchema;
    }
    if (!env) {
        console.warn('overrideEndpoints: env empty');
        return originalSchema;
    }

    const schema = deepCopy(originalSchema);
    const parsedParams = parseOverrideEndpointsParams(overrideParams);

    parsedParams.forEach((overrideConfig) => {
        const curService = schema[overrideConfig.scope]?.[overrideConfig.serviceKey];
        if (!curService || !curService.actions || !curService.endpoints) {
            console.warn(
                'overrideEndpoints: incorrect service ' +
                    overrideConfig.scope +
                    '.' +
                    overrideConfig.serviceKey,
            );
            return;
        }

        const endpoints = curService.endpoints;

        const envEndpoints = _.get(endpoints, [installation, env]);
        if (!envEndpoints) {
            console.warn(
                'overrideEndpoints: ' + [installation, env] + ' not exists in envEndpoints',
            );
            return;
        }

        if (overrideConfig.endpointName) {
            if (!envEndpoints[overrideConfig.endpointName]) {
                console.warn(
                    'overrideEndpoints: incorrect endpointName ' + overrideConfig.endpointName,
                );
            }
            overrideEndpoint(envEndpoints, overrideConfig.endpointName, overrideConfig);
        }
    });
    return schema;
}

function isExtendedEndpointConfig(config: ActionEndpoint): config is ExtendedActionEndpoint {
    return typeof config === 'object';
}

function overrideEndpoint(
    envEndpoints: Record<string, ActionEndpoint>,
    endpointName: string,
    overrideConfig: OverrideEndpoint,
) {
    const config = envEndpoints[endpointName];
    if (isExtendedEndpointConfig(config)) {
        if (typeof overrideConfig.config === 'string') {
            config.path = overrideConfig.config;
        } else {
            Object.assign(config, overrideConfig.config);
        }
        return;
    }
    envEndpoints[endpointName] = overrideConfig.config;
}
