import axios, {AxiosRequestConfig} from 'axios';
import axiosRetry from 'axios-retry';
import _ from 'lodash';

import {DEFAULT_AXIOS_OPTIONS, DEFAULT_TIMEOUT} from '../constants';

export function getAxiosClient(
    timeout: number = DEFAULT_TIMEOUT,
    retries = 0,
    axiosConfig: AxiosRequestConfig = DEFAULT_AXIOS_OPTIONS,
) {
    const client = axios.create({...axiosConfig, timeout});

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
