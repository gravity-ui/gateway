import path from 'path';

import axios, {AxiosRequestConfig} from 'axios';
import MockAdapter from 'axios-mock-adapter';

import {GetAuthHeadersParams, getGatewayControllers} from './index';

const mock = new MockAdapter(axios);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class CoreContext {
    utils = {};
    create() {
        return new CoreContext();
    }
    log() {}
    logError() {}
    end() {}
    stats() {}
    getMetadata() {
        return {};
    }
}

class ErrorConstructor extends Error {
    static wrap(error: Error) {
        return error;
    }
}

const generateContext = () => {
    const ctx = new CoreContext();

    return ctx;
};

const mockConnection = () => {
    return {
        once: jest.fn(),
        removeListener: jest.fn(),
    };
};

const testMsgRoot = 'root result';
const testMsgExample = 'example result';
const testMsgOverrided = 'overrided result';
const testMsgAnotherAction = 'another action result';
const testMsgDebugBody = 'debug body';
mock.onGet('https://example.com/root').reply(200, testMsgRoot);
mock.onGet('https://example.com/another-action').reply(200, testMsgAnotherAction);
mock.onGet('https://example.com/example').reply(200, testMsgExample);
mock.onGet('https://example.com/overrided').reply(200, testMsgOverrided);
mock.onPost('https://example.com/info').reply(({headers, data}: AxiosRequestConfig) => [
    200,
    {headers, data: JSON.parse(data)},
]);
mock.onPost('https://example.com/debug-body').reply(200, testMsgDebugBody);

const config = {
    env: 'testing',
    installation: 'external',
    caCertificatePath: null,
    ErrorConstructor,
    getAuthArgs: () => ({}),
    getAuthHeaders: () => undefined,
    withDebugHeaders: false,
    proxyHeaders: [],
};
const endpoints = {
    external: {
        testing: {
            endpoint: 'https://example.com',
        },
    },
};
const params = {
    requestId: '111',
    headers: {},
    args: {},
    ctx: generateContext(),
    authArgs: {},
};

const rootSchema = {
    rootService: {
        serviceName: 'test',
        actions: {
            getRoot: {
                path: () => '/root',
                method: 'GET' as const,
            },
            getAnotherAction: {
                path: () => '/another-action',
                method: 'GET' as const,
            },
            _hiddenAction: {
                path: () => '/root',
                method: 'GET' as const,
            },
            _getInfo: {
                method: 'POST' as const,
                path: () => '/info',
                params: (body: any) => ({body}),
            },
            mixedInfo: (api: any, args: any) => api.rootService._getInfo(args),
            mixedInfoWithDelay: async (api: any, args: any) => {
                await sleep(1000);
                return api.rootService._getInfo(args);
            },
            mixedRoot: (api: any, args: any) => api.rootService.getRoot(args),
            mixedRootScope: (api: any, args: any) => api.root.rootService.getRoot(args),
            mixedScope: (api: any, args: any) => api.example.exampleService.getExample(args),
            debugBody: {
                path: () => '/debug-body',
                method: 'POST' as const,
                params: (body: any) => ({body}),
            },
        },
        endpoints,
    },
};
const exampleSchema = {
    exampleService: {
        serviceName: 'example',
        actions: {
            getExample: {
                path: () => '/example',
                method: 'GET' as const,
            },
        },
        endpoints,
    },
};
const overrideRootServiceSchema = {
    getRoot: {
        serviceName: 'test',
        actions: {
            getOverrided: {
                path: () => '/overrided',
                method: 'GET' as const,
            },
        },
        endpoints,
    },
    overrideService: {
        serviceName: 'test',
        actions: {
            getOverrided: {
                path: () => '/overrided',
                method: 'GET' as const,
            },
        },
        endpoints,
    },
};

describe('getGatewayControllers', () => {
    describe('api', () => {
        test('correct call by scope', async () => {
            const {api} = getGatewayControllers({root: rootSchema, example: exampleSchema}, config);
            const res1 = await api.root.rootService.getRoot(params);
            expect(res1.responseData).toBe(testMsgRoot);
            const res2 = await api.example.exampleService.getExample(params);
            expect(res2.responseData).toBe(testMsgExample);
        });

        test('mixed actions in scopes', async () => {
            const {api} = getGatewayControllers({root: rootSchema, example: exampleSchema}, config);
            const res1 = await api.root.rootService.mixedRoot(params);
            expect(res1.responseData).toBe(testMsgRoot);
            const res2 = await api.root.rootService.mixedRootScope(params);
            expect(res2.responseData).toBe(testMsgRoot);
            const res3 = await api.root.rootService.mixedScope(params);
            expect(res3.responseData).toBe(testMsgExample);
        });

        test('mixed actions context', async () => {
            const {api} = getGatewayControllers({root: rootSchema}, config);

            const params1 = {...params, args: {test: 'test1'}};
            const res1 = await api.rootService.mixedInfo(params1);
            expect((res1.responseData as any).data).toStrictEqual(params1.args);
            expect((res1.responseData as any).headers['x-request-id']).toStrictEqual(
                params1.requestId,
            );

            const params2 = {...params, args: {test: 'test2'}, requestId: '222'};
            const res2 = await api.rootService.mixedInfo(params2);
            expect((res2.responseData as any).data).toStrictEqual(params2.args);
            expect((res2.responseData as any).headers['x-request-id']).toStrictEqual(
                params2.requestId,
            );
        });

        test('mixed actions context for simultaneous calls', async () => {
            const {api} = getGatewayControllers({root: rootSchema}, config);

            const params1 = {...params, requestId: 'request1', args: {test: 'data1'}};
            const res1Promise = api.rootService.mixedInfoWithDelay(params1);

            const params2 = {...params, requestId: 'request2', args: {test: 'data2'}};
            const res2Promise = api.rootService.mixedInfo(params2);

            const [res1, res2] = await Promise.all([res1Promise, res2Promise]);

            expect((res1.responseData as any).data).toStrictEqual(params1.args);
            expect((res1.responseData as any).headers['x-request-id']).toStrictEqual(
                params1.requestId,
            );

            expect((res2.responseData as any).data).toStrictEqual(params2.args);
            expect((res2.responseData as any).headers['x-request-id']).toStrictEqual(
                params2.requestId,
            );
        });

        test('without root scheme', async () => {
            const {api} = getGatewayControllers({example: exampleSchema}, config);
            const res2 = await api.example.exampleService.getExample(params);
            expect(res2.responseData).toBe(testMsgExample);
        });

        test('api hosting root service', async () => {
            const {api} = getGatewayControllers({root: rootSchema, example: exampleSchema}, config);
            const res1 = await api.rootService.getRoot(params);
            expect(res1.responseData).toBe(testMsgRoot);
        });

        test('api hosting only root service', async () => {
            const {api} = getGatewayControllers({root: rootSchema, example: exampleSchema}, config);

            const res2 = await api.example.exampleService.getExample(params);
            expect(res2.responseData).toBe(testMsgExample);
            await expect(async () => {
                // @ts-expect-error
                await test.api.exampleService.getExample(params);
            }).rejects.toThrow(TypeError);
        });

        test('override root service', async () => {
            const {api} = getGatewayControllers(
                {root: rootSchema, rootService: overrideRootServiceSchema},
                config,
            );
            const res1 = await api.root.rootService.getRoot(params);
            expect(res1.responseData).toBe(testMsgRoot);

            const res2 = await api.rootService.getRoot(params);
            expect(res2.responseData).toBe(testMsgRoot);

            const res3 = await api.rootService.getRoot.getOverrided(params);
            expect(res3.responseData).toBe(testMsgOverrided);

            const res4 = await api.rootService.overrideService.getOverrided(params);
            expect(res4.responseData).toBe(testMsgOverrided);
        });

        test('type error for undefined', async () => {
            const {api} = getGatewayControllers({root: rootSchema}, config);
            const res1 = await api.root.rootService.getRoot(params);
            expect(res1.responseData).toBe(testMsgRoot);

            await expect(async () => {
                // @ts-expect-error
                await api.rootNotDefined.rootService.getRoot(params);
            }).rejects.toThrow(TypeError);

            await expect(async () => {
                // @ts-expect-error
                await api.root.rootServiceNotDefined.getRoot(params);
            }).rejects.toThrow(TypeError);

            await expect(async () => {
                // @ts-expect-error
                await api.root.rootService.getRootNotDefined(params);
            }).rejects.toThrow(TypeError);
        });

        test('correct if duplicate between scopes', async () => {
            const {api} = getGatewayControllers(
                {root: rootSchema, duplicateRoot: rootSchema},
                config,
            );
            const res1 = await api.root.rootService.getRoot(params);
            expect(res1.responseData).toBe(testMsgRoot);
            const res2 = await api.rootService.getRoot(params);
            expect(res2.responseData).toBe(testMsgRoot);
            const res3 = await api.duplicateRoot.rootService.getRoot(params);
            expect(res3.responseData).toBe(testMsgRoot);
        });

        test('debug body', async () => {
            const headerKey = 'x-api-request-body';
            const {api} = getGatewayControllers({root: rootSchema}, config);
            const msg = 'йцукенгшщзхъфывапролджэёячсмитьбю';

            const args = {message: msg};
            const {
                responseData: res1,
                debugHeaders: {[headerKey]: debug1},
            } = await api.root.rootService.debugBody({
                ...params,
                args,
            });
            expect(debug1).toBe(encodeURIComponent(JSON.stringify(args)));
            expect(res1).toBe(testMsgDebugBody);

            const {
                responseData: res2,
                debugHeaders: {[headerKey]: debug2},
            } = await api.root.rootService.debugBody({
                ...params,
                args: {message: msg + msg},
            });
            expect(debug2).toBe(null);
            expect(res2).toBe(testMsgDebugBody);

            const {
                responseData: res3,
                debugHeaders: {[headerKey]: debug3},
            } = await api.root.rootService.debugBody({
                ...params,
                args: Buffer.from(msg),
            });
            expect(debug3).toBe('[Buffer]');
            expect(res3).toBe(testMsgDebugBody);
        });
    });

    describe('controller', () => {
        test('404', async () => {
            const {controller} = getGatewayControllers({root: rootSchema}, config);
            const req: any = {
                params: {},
            };

            const res: any = {
                status: jest.fn((_) => res),
                send: jest.fn(),
                set: jest.fn(),
            };
            await controller(req, res);
            expect(res.status.mock.calls[0][0]).toBe(404);
            expect(res.send.mock.calls[0][0]).toEqual({
                status: 404,
                code: 'UNKNOWN_SERVICE',
                message: 'Unknown service',
            });

            await controller(
                {
                    params: {
                        service: 'rootService',
                        action: '',
                    },
                } as any,
                res,
            );
            expect(res.status.mock.calls[1][0]).toBe(404);
            expect(res.send.mock.calls[1][0]).toEqual({
                status: 404,
                code: 'UNKNOWN_SERVICE_ACTION',
                message: 'Unknown service action',
            });
        });

        test('hidden action', async () => {
            const {controller, api} = getGatewayControllers({root: rootSchema}, config);

            const res1 = await api.root.rootService._hiddenAction(params);
            expect(res1.responseData).toBe(testMsgRoot);

            const res: any = {
                status: jest.fn((_) => res),
                send: jest.fn(),
                set: jest.fn(),
            };

            await controller(
                {
                    params: {
                        service: 'rootService',
                        action: '_hiddenAction',
                    },
                } as any,
                res,
            );
            expect(res.status.mock.calls[0][0]).toBe(404);
            expect(res.send.mock.calls[0][0]).toEqual({
                status: 404,
                code: 'UNKNOWN_SERVICE_ACTION',
                message: 'Unknown service action',
            });
        });

        test('call action', async () => {
            const {controller} = getGatewayControllers(
                {root: rootSchema, example: exampleSchema},
                config,
            );

            const res: any = {
                status: jest.fn((_) => res),
                send: jest.fn(),
                set: jest.fn(),
            };

            await controller(
                {
                    params: {
                        service: 'rootService',
                        action: 'getRoot',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );

            expect(res.send.mock.calls[0][0]).toBe(testMsgRoot);

            await controller(
                {
                    params: {
                        scope: 'root',
                        service: 'rootService',
                        action: 'getRoot',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );
            expect(res.send.mock.calls[1][0]).toBe(testMsgRoot);

            await controller(
                {
                    params: {
                        scope: 'example',
                        service: 'exampleService',
                        action: 'getExample',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );
            expect(res.send.mock.calls[2][0]).toBe(testMsgExample);
        });

        test('controller actions', async () => {
            const {controller: controller1} = getGatewayControllers(
                {root: rootSchema},
                {
                    ...config,
                    actions: ['root.rootService.getRoot'],
                },
            );

            const res: any = {
                status: jest.fn((_) => res),
                send: jest.fn(),
                set: jest.fn(),
            };

            await controller1(
                {
                    params: {
                        scope: 'root',
                        service: 'rootService',
                        action: 'getRoot',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );
            expect(res.send.mock.calls[0][0]).toBe(testMsgRoot);

            await controller1(
                {
                    params: {
                        scope: 'root',
                        service: 'rootService',
                        action: 'getAnotherAction',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );
            expect(res.send.mock.calls[1][0]).toEqual({
                status: 404,
                code: 'UNKNOWN_SERVICE_ACTION',
                message: 'Unknown service action',
            });

            const {controller: controller2} = getGatewayControllers(
                {root: rootSchema},
                {
                    ...config,
                    actions: ['root.rootService.*'],
                },
            );

            await controller2(
                {
                    params: {
                        scope: 'root',
                        service: 'rootService',
                        action: 'getAnotherAction',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );
            expect(res.send.mock.calls[2][0]).toBe(testMsgAnotherAction);
        });
    });

    describe('grpc', () => {
        test('grpc duplicate names', async () => {
            const grpcSchema = {
                rootService: {
                    serviceName: 'test',
                    actions: {
                        getRoot: {
                            protoPath: path.resolve(__dirname, '../testProto/greeter.proto'),
                            protoKey: 'test.v1.Greeter',
                            action: 'SayHello',
                        },
                    },
                    endpoints,
                },
            };
            const grpcSchema2 = {
                rootService: {
                    serviceName: 'test',
                    actions: {
                        getRoot: {
                            protoPath: path.resolve(__dirname, '../testProto/greeter2.proto'),
                            protoKey: 'test.v1.Greeter',
                            action: 'SayHello',
                        },
                    },
                    endpoints,
                },
            };

            const controller = getGatewayControllers(
                {root: grpcSchema, second: grpcSchema2},
                config,
            );
            expect(controller).toBeDefined();
        });

        test('grpc not found actions', async () => {
            const grpcSchema = {
                rootService: {
                    serviceName: 'test',
                    actions: {
                        getRoot: {
                            protoPath: path.resolve(__dirname, '../testProto/greeter.proto'),
                            protoKey: 'test.v1.Greeter',
                            action: 'NotExistAction',
                        },
                    },
                    endpoints,
                },
            };

            const {api} = getGatewayControllers({root: grpcSchema}, config);
            await expect(api.rootService.getRoot(params)).rejects.toMatchObject({
                error: {
                    code: 'GRPC_ACTION_NOT_FOUND',
                    status: 400,
                    message: 'Not found action NotExistAction in rootService',
                },
            });
        });
    });

    describe('GATEWAY_ENDPOINTS_OVERRIDES', () => {
        const OLD_ENV = process.env;

        beforeEach(() => {
            jest.resetModules();
            process.env = {...OLD_ENV};
        });

        afterAll(() => {
            process.env = OLD_ENV;
        });

        test('GATEWAY_ENDPOINTS_OVERRIDES', async () => {
            process.env.GATEWAY_ENDPOINTS_OVERRIDES = JSON.stringify({
                rootService: {
                    endpoint: 'https://overrided.com',
                },
                'example.exampleService': {
                    endpoint: 'https://overrided.example.com',
                },
            });

            mock.onGet('https://overrided.com/root').reply(200, 'IT IS OVERRIDED');
            mock.onGet('https://overrided.example.com/example').reply(
                200,
                'IT IS OVERRIDED EXAMPLE',
            );

            const {api} = getGatewayControllers({root: rootSchema, example: exampleSchema}, config);
            const res1 = await api.root.rootService.getRoot(params);
            expect(res1.responseData).toBe('IT IS OVERRIDED');
            const res2 = await api.example.exampleService.getExample(params);
            expect(res2.responseData).toBe('IT IS OVERRIDED EXAMPLE');
        });

        test('should ignore invalid JSON', async () => {
            process.env.GATEWAY_ENDPOINTS_OVERRIDES = 'invalid JSON';
            const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation();

            const {api} = getGatewayControllers({root: rootSchema}, config);
            const res1 = await api.root.rootService.getRoot(params);

            expect(res1.responseData).toBe(testMsgRoot);
            expect(consoleWarnMock).toBeCalled();
            expect(consoleWarnMock.mock.calls[0][0]).toBe(
                'Error when parse GATEWAY_ENDPOINTS_OVERRIDES',
            );

            consoleWarnMock.mockRestore();
        });
    });

    describe('Auth Headers', () => {
        const msgResult = 'msg result';

        const mockRequest = jest.fn(() => {
            return [200, msgResult];
        });
        mock.onPost('https://example.com/login').reply(mockRequest);

        const testServiceName = 'testServiceName';
        const getAuthHeadersInAction = jest.fn(({authArgs}: GetAuthHeadersParams) => ({
            token: 'change from config ' + authArgs?.token,
        }));
        const localSchema = {
            localService: {
                serviceName: testServiceName,
                endpoints,
                actions: {
                    login: {
                        path: () => '/login',
                        method: 'POST' as const,
                    },
                    loginCustomGetAuthHeaders: {
                        path: () => '/login',
                        method: 'POST' as const,
                        getAuthHeaders: getAuthHeadersInAction,
                    },
                },
            },
        };

        const localConfig = {
            ...config,
            getAuthHeaders: jest.fn(({authArgs}) => {
                return authArgs;
            }),
        };

        const testHeaders = {
            testHeader: 'testValue',
        };
        const testToket = '123';
        const localParams = {
            ...params,
            headers: testHeaders,
            authArgs: {
                token: testToket,
            },
        };

        afterEach(() => {
            localConfig.getAuthHeaders.mockClear();
            mockRequest.mockClear();
            getAuthHeadersInAction.mockClear();
        });

        test('should send authArgs to getAuthHeaders', async () => {
            const {api} = getGatewayControllers({root: localSchema}, localConfig);
            const res = await api.root.localService.login(localParams);
            expect(res.responseData).toBe(msgResult);
            expect(localConfig.getAuthHeaders.mock.calls[0][0]).toEqual({
                actionType: 'rest',
                serviceName: testServiceName,
                requestHeaders: testHeaders,
                authArgs: {token: testToket},
            });
            expect((mockRequest.mock.calls[0] as any)[0].headers.token).toBe(testToket);

            const res2 = await api.root.localService.login({
                ...params,
                headers: {},
                authArgs: undefined,
            });

            expect(res2.responseData).toBe(msgResult);
            expect(localConfig.getAuthHeaders.mock.calls[1][0]).toEqual({
                actionType: 'rest',
                serviceName: testServiceName,
                requestHeaders: {},
                authArgs: undefined,
            });
            expect((mockRequest.mock.calls[1] as any)[0].headers.token).toBeUndefined();

            const res3 = await api.root.localService.loginCustomGetAuthHeaders(localParams);
            expect(res3.responseData).toBe(msgResult);
            expect((mockRequest.mock.calls[2] as any)[0].headers.token).toBe(
                'change from config ' + testToket,
            );
            expect(getAuthHeadersInAction.mock.calls[0][0]).toEqual({
                actionType: 'rest',
                serviceName: testServiceName,
                requestHeaders: testHeaders,
                authArgs: {token: testToket},
            });
        });

        test('should stay authArgs empty if not set', async () => {
            const {api} = getGatewayControllers({root: localSchema}, localConfig);
            const res = await api.root.localService.login({
                requestId: '111',
                headers: {},
                args: {},
                ctx: generateContext(),
            });
            expect(res.responseData).toBe(msgResult);
            expect(localConfig.getAuthHeaders.mock.calls[0][0]).toEqual({
                actionType: 'rest',
                serviceName: testServiceName,
                requestHeaders: {},
                authArgs: undefined,
            });
            expect((mockRequest.mock.calls[0] as any)[0].headers.token).toBeUndefined();
        });

        test('should use getAuthArgs if call controller', async () => {
            const getAuthArgs = (_req: any, res: any) => ({token: res.locals.token});
            const {controller} = getGatewayControllers(
                {root: localSchema},
                {
                    ...localConfig,
                    getAuthArgs,
                },
            );
            const res: any = {
                status: jest.fn((_) => res),
                send: jest.fn(),
                set: jest.fn(),
                locals: {
                    token: '777',
                },
            };
            await controller(
                {
                    params: {
                        service: 'localService',
                        action: 'login',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );

            expect(res.send.mock.calls[0][0]).toBe(msgResult);
            expect((mockRequest.mock.calls[0] as any)[0].headers.token).toBe('777');

            await controller(
                {
                    params: {
                        service: 'localService',
                        action: 'loginCustomGetAuthHeaders',
                    },
                    headers: {},
                    ctx: generateContext(),
                    connection: mockConnection(),
                } as any,
                res,
            );
            expect(res.send.mock.calls[1][0]).toBe(msgResult);
            expect((mockRequest.mock.calls[1] as any)[0].headers.token).toBe(
                'change from config 777',
            );
        });
    });
});
