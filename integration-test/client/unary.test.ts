const originalGrpcReflection = jest.requireActual('grpc-reflection-js');

let mockFileContainingSymbol = jest.fn();
jest.mock('grpc-reflection-js', () => ({
    __esModule: true,
    Client: jest.fn().mockImplementation((actionEndpoint, creds) => {
        mockFileContainingSymbol = jest.fn((protoKey) => {
            return new originalGrpcReflection.Client(actionEndpoint, creds).fileContainingSymbol(
                protoKey,
            );
        });
        return {fileContainingSymbol: mockFileContainingSymbol};
    }),
}));

import * as grpcReflection from 'grpc-reflection-js';

import {getGatewayControllers} from '../../src/index.js';

import {ErrorConstructor, createCoreContext} from './create-core-context.js';
import {schema} from './schema/meta.js';

function getControllers() {
    return getGatewayControllers(
        {local: schema},
        {
            installation: 'external',
            env: 'production',
            caCertificatePath: null,
            grpcRecreateService: true,
            ErrorConstructor,
            getAuthArgs: () => ({}),
            getAuthHeaders: () => undefined,
            proxyHeaders: [],
            withDebugHeaders: false,
        },
    );
}

const controllers = getControllers();

let stats: ReturnType<typeof jest.fn>;

const requestId = 'test';
function getApiActionConfig(args?: any) {
    stats = jest.fn();
    const coreContextStub = createCoreContext(stats);
    return {
        requestId,
        headers: {},
        args,
        ctx: coreContextStub,
    };
}

async function expectStatsToSendOk() {
    expect(stats).toHaveBeenCalled();
    expect(stats).toHaveBeenCalledTimes(1);
    const {responseStatus} = stats.mock.calls[stats.mock.calls.length - 1][0];
    expect(responseStatus).toEqual(200);
}

async function expectStatsToSendError() {
    expect(stats).toHaveBeenCalled();
    expect(stats).toHaveBeenCalledTimes(1);
    const {responseStatus} = stats.mock.calls[stats.mock.calls.length - 1][0];
    expect(responseStatus).not.toEqual(200);
}

describe('Unary requests tests', () => {
    it('should correctly handle successful requests', async () => {
        await expect(
            controllers.api.local.meta
                .getFolderStats(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });

        await expectStatsToSendOk();
    });

    it('should correctly rejects when backend error', async () => {
        await expect(
            controllers.api.local.meta.methodWithError(getApiActionConfig()),
        ).rejects.toMatchObject({
            debugHeaders: {
                'x-request-id': requestId,
            },
            error: {
                code: 'GATEWAY_REQUEST_ERROR',
                status: 500,
                details: {
                    grpcCode: 15,
                },
            },
        });
        await expectStatsToSendError();
    });

    it('should correctly rejects when deadline exceeded', async () => {
        await expect(
            controllers.api.local.meta.methodWithDeadline(getApiActionConfig()),
        ).rejects.toMatchObject({
            debugHeaders: {
                'x-request-id': requestId,
            },
            error: {
                code: 'GATEWAY_REQUEST_ERROR',
                status: 504,
                details: {
                    grpcCode: 4,
                },
            },
        });
        await expectStatsToSendError();
    });

    it('should correctly complete parallel requests with deadline exceeded in one', async () => {
        const responseWithOk = controllers.api.local.meta
            .getLongRequest(getApiActionConfig({query: '456'}))
            .then(({responseData}) => responseData);
        const responseWithDeadline = controllers.api.local.meta.methodWithDeadline(
            getApiActionConfig(),
        );

        await expect(responseWithDeadline).rejects.toMatchObject({
            debugHeaders: {
                'x-request-id': requestId,
            },
            error: {
                code: 'GATEWAY_REQUEST_ERROR',
                status: 504,
                details: {
                    grpcCode: 4,
                },
            },
        });

        await expect(responseWithOk).resolves.toEqual({
            result: 'response-456',
        });
    });

    it('should correctly rejects when method is not implemented', async () => {
        await expect(
            controllers.api.local.meta.unimplemented(getApiActionConfig()),
        ).rejects.toMatchObject({
            debugHeaders: {
                'x-request-id': requestId,
            },
            error: {
                code: 'GATEWAY_REQUEST_ERROR',
                status: 501,
                details: {
                    grpcCode: 12,
                },
            },
        });
        await expectStatsToSendError();
    });
});

describe('Parallel requests test', () => {
    it('request should correctly complete if re-create service', async () => {
        const request1 = controllers.api.local.meta
            .getDataWithTimeout(getApiActionConfig({timeout: 1000, id: 1}))
            .then(({responseData}) => responseData);
        const request2 = controllers.api.local.meta
            .getDataWithTimeout(getApiActionConfig({timeout: 0, id: 2, throwError: true}))
            .then(({responseData}) => responseData);

        await expect(request2).rejects.toMatchObject({
            debugHeaders: {
                'x-request-id': requestId,
            },
            error: {
                code: 'GATEWAY_REQUEST_ERROR',
                status: 504,
                details: {
                    grpcCode: 4,
                },
            },
        });

        await expect(request1).resolves.toEqual({result: 'response-1'});
    });
});

describe('Server stream requests tests', () => {
    it('should correctly handle successful requests', async () => {
        const from = 10;
        const to = 15;
        const {stream} = await controllers.api.local.meta.getEntityListServerStream(
            getApiActionConfig({from, to}),
        );

        expect(stream).toBeTruthy();
        if (!stream) {
            return;
        }
        const handleError = jest.fn();
        const handleData = jest.fn();
        const handleEnd = jest.fn();
        stream.on('error', handleError);
        stream.on('data', handleData);
        stream.on('end', handleEnd);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        expect(handleError).not.toHaveBeenCalled();
        expect(handleData).toHaveBeenCalled();
        expect(handleData).toHaveBeenCalledTimes(to - from);
        expect(handleData.mock.calls[handleData.mock.calls.length - 1]).toEqual([
            {
                result: 'item-14',
            },
        ]);
        expect(handleEnd).toHaveBeenCalled();
    });

    it('should handle failed requests', async () => {
        const from = 10;
        const to = 15;
        const {stream} = await controllers.api.local.meta.getEntityListServerStreamWithError(
            getApiActionConfig({from, to}),
        );

        expect(stream).toBeTruthy();
        if (!stream) {
            return;
        }
        const handleError = jest.fn();
        const handleData = jest.fn();
        const handleEnd = jest.fn();
        stream.on('error', handleError);
        stream.on('data', handleData);
        stream.on('end', handleEnd);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const error = handleError.mock.calls[0][0];
        expect(handleError).toHaveBeenCalled();
        expect(handleData).not.toHaveBeenCalled();
        expect(handleEnd).toHaveBeenCalled();
        expect(error.code).toBeGreaterThan(0);

        await expectStatsToSendError();
    });
});

describe('Client stream requests tests', () => {
    it('should throw error when no callback', async () => {
        await expect(
            controllers.api.local.meta.getEntityListClientStream(getApiActionConfig()),
        ).rejects.toMatchObject({
            debugHeaders: {
                'x-request-id': requestId,
            },
            error: {
                code: 'ACTION_CALLBACK_REQUIRED',
                status: 400,
            },
        });
    });
    it('should correctly handle successful requests', async () => {
        const callback = jest.fn();
        const {stream} = await controllers.api.local.meta.getEntityListClientStream({
            ...getApiActionConfig(),
            callback,
        });

        expect(stream).toBeTruthy();
        if (!stream) {
            return;
        }

        stream.write({id: 10});
        await new Promise((resolve) => setTimeout(resolve, 100));
        stream.write({id: 15});
        await new Promise((resolve) => setTimeout(resolve, 100));
        stream.write({id: 20});
        stream.end();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][1]).toEqual({items: ['10', '15', '20']});
    });
});

describe('Bidi stream requests tests', () => {
    it('should correctly handle successful requests', async () => {
        const {stream} = await controllers.api.local.meta.getEntityListDuplexStream(
            getApiActionConfig(),
        );

        expect(stream).toBeTruthy();
        if (!stream) {
            return;
        }

        const handleError = jest.fn();
        const handleData = jest.fn();
        const handleEnd = jest.fn();
        stream.on('error', handleError);
        stream.on('data', handleData);
        stream.on('end', handleEnd);

        stream.write({id: 10});
        await new Promise((resolve) => setTimeout(resolve, 100));
        stream.write({id: 15});
        await new Promise((resolve) => setTimeout(resolve, 100));
        stream.write({id: 20});
        await new Promise((resolve) => setTimeout(resolve, 100));
        stream.end();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(handleData).toHaveBeenCalledTimes(3);
        expect(handleData.mock.calls[2][0]).toEqual({id: '20', hash: 'hash-20'});
    });
});

describe('Cache reflection tests', () => {
    beforeEach(() => {
        mockFileContainingSymbol.mockClear();
    });

    it('should correctly reflection every request', async () => {
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(0);
        const localControllers = getControllers();
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(0);

        const N = 3;
        for (let i = 0; i < N; i++) {
            await expect(
                localControllers.api.local.meta
                    .getFolderStatsReflectionEvery(getApiActionConfig({query: String(i)}))
                    .then(({responseData}) => responseData),
            ).resolves.toEqual({
                result: 'response-' + i,
            });
            await expectStatsToSendOk();
        }
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(N);
        expect(grpcReflection.Client).toHaveBeenCalledTimes(1);
    });

    it('should correctly cached reflection after first request', async () => {
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(0);
        const localControllers = getControllers();
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(0);

        await expect(
            localControllers.api.local.meta
                .getFolderStatsReflectionFirst(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });
        await expectStatsToSendOk();

        await expect(
            localControllers.api.local.meta
                .getFolderStatsReflectionFirst2(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });
        await expectStatsToSendOk();

        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(1);
        expect(grpcReflection.Client).toHaveBeenCalledTimes(1);
    });

    it('should correctly refresh cache', async () => {
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(0);
        const localControllers = getControllers();
        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(0);

        await expect(
            localControllers.api.local.meta
                .getFolderStatsReflectionRefresh(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });
        await expectStatsToSendOk();
        await expect(
            localControllers.api.local.meta
                .getFolderStatsReflectionRefresh(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });
        await expectStatsToSendOk();

        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(1);

        await new Promise((resolve) => setTimeout(resolve, 600));
        await expect(
            localControllers.api.local.meta
                .getFolderStatsReflectionRefresh(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });
        await expectStatsToSendOk();
        await expect(
            localControllers.api.local.meta
                .getFolderStatsReflectionRefresh(getApiActionConfig({query: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({
            result: 'response-123',
        });
        await expectStatsToSendOk();

        expect(mockFileContainingSymbol).toHaveBeenCalledTimes(2);
    });
});

describe('Reflection options tests', () => {
    it('should correctly works reflection with camelCase end enum', async () => {
        await expect(
            controllers.api.local.meta
                .getEntityTestOptions(getApiActionConfig({queryCase: '123'}))
                .then(({responseData}) => responseData),
        ).resolves.toEqual({status: 'STATUS_OK', testCaseResult: 'case-response-123'});
        await expectStatsToSendOk();
    });
});
