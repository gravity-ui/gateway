import axios, {AxiosRequestConfig} from 'axios';
import axiosRetry from 'axios-retry';
import _ from 'lodash';

import {DEFAULT_AXIOS_OPTIONS, DEFAULT_TIMEOUT} from '../constants';
import {AxiosInterceptorsConfig} from '../models/common';

export function getAxiosClient(
    timeout: number = DEFAULT_TIMEOUT,
    retries = 0,
    axiosConfig: AxiosRequestConfig = DEFAULT_AXIOS_OPTIONS,
    {request: reqInterceptors, response: resInterceptors}: AxiosInterceptorsConfig = {},
) {
    const client = axios.create({...axiosConfig, timeout});

    reqInterceptors?.forEach(({callback, errorCallback}) =>
        client.interceptors.request.use(callback, errorCallback),
    );
    resInterceptors?.forEach(({callback, errorCallback}) =>
        client.interceptors.response.use(callback, errorCallback),
    );

    axiosRetry(client, {
        retries,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error) => {
            if (!error.config) {
                return false;
            }

            return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error);
        },
        onRetry: (retryCount, _error, requestConfig) => {
            _.set(requestConfig, ['headers', 'x-request-attempt'], retryCount);
        },
    });

    return client;
}
