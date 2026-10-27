import MockAdapter from 'axios-mock-adapter';

import {getAxiosClient} from './axios';

describe('getAxiosClient retries', () => {
    let mock: MockAdapter;

    function createClient(...args: Parameters<typeof getAxiosClient>) {
        const client = getAxiosClient(...args);
        mock = new MockAdapter(client);
        return client;
    }

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        mock.restore();
        jest.useRealTimers();
    });

    test.each(['GET', 'POST'])('retries a 429 response for %s', async (method) => {
        const client = createClient(10_000, 2);
        const attempts: unknown[] = [];
        mock.onAny('/retry').reply(({headers}) => {
            attempts.push(headers?.['x-request-attempt']);
            return attempts.length === 1 ? [429] : [200, 'success'];
        });

        const response = expect(client.request({url: '/retry', method})).resolves.toMatchObject({
            data: 'success',
        });
        await Promise.all([response, jest.runAllTimersAsync()]);

        expect(attempts).toEqual([undefined, '1']);
    });

    test('does not retry by default', async () => {
        const client = createClient();
        mock.onGet('/retry').reply(429);

        await expect(client.get('/retry')).rejects.toMatchObject({response: {status: 429}});
        expect(mock.history.get).toHaveLength(1);
    });

    test('does not retry other client errors', async () => {
        const client = createClient(10_000, 2);
        mock.onGet('/retry').reply(400);

        await expect(client.get('/retry')).rejects.toMatchObject({response: {status: 400}});
        expect(mock.history.get).toHaveLength(1);
    });

    test.each([false, true])('respects a custom condition (async: %s)', async (asyncCondition) => {
        const condition = jest.fn(() => (asyncCondition ? Promise.resolve(false) : false));
        const client = createClient(10_000, 2, condition);
        mock.onGet('/retry').reply(429);

        await expect(client.get('/retry')).rejects.toMatchObject({response: {status: 429}});

        expect(condition).toHaveBeenCalledTimes(1);
        expect(mock.history.get).toHaveLength(1);
    });

    test('waits for Retry-After before retrying', async () => {
        const client = createClient(10_000, 2);
        mock.onGet('/retry')
            .replyOnce(429, undefined, {'retry-after': '2'})
            .onGet('/retry')
            .reply(200, 'success');

        const response = expect(client.get('/retry')).resolves.toMatchObject({data: 'success'});
        await Promise.all([
            response,
            (async () => {
                await jest.advanceTimersByTimeAsync(1999);
                expect(mock.history.get).toHaveLength(1);
                await jest.runAllTimersAsync();
            })(),
        ]);

        expect(mock.history.get).toHaveLength(2);
    });

    test('does not retry when Retry-After exceeds the remaining timeout', async () => {
        const client = createClient(1000, 2);
        mock.onGet('/retry').reply(429, undefined, {'retry-after': '2'});

        await expect(client.get('/retry')).rejects.toMatchObject({response: {status: 429}});
        expect(mock.history.get).toHaveLength(1);
    });

    test('does not send another request when aborted during the retry delay', async () => {
        const client = createClient(10_000, 2);
        const controller = new AbortController();
        mock.onGet('/retry').reply(429, undefined, {'retry-after': '2'});

        const response = expect(
            client.get('/retry', {signal: controller.signal}),
        ).rejects.toMatchObject({code: 'ERR_CANCELED'});
        await Promise.all([
            response,
            (async () => {
                await jest.advanceTimersByTimeAsync(0);
                expect(mock.history.get).toHaveLength(1);
                controller.abort();
                await jest.runAllTimersAsync();
            })(),
        ]);

        expect(mock.history.get).toHaveLength(1);
    });
});
