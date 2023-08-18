import {ExtendedGrpcActionEndpoint} from '../../models/common';

import {overrideEndpoints} from './overrideEndpoints';

describe('overrideEndpoints', () => {
    test('simple override endpoint and grpcEndpoint', () => {
        const envParams = {
            serviceName: {
                endpoint: 'https://example.com',
                grpcEndpoint: 'grpc.example.com',
            },
        };

        const originalSchema = {
            root: {
                serviceName: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpoint: 'https://override.me',
                                grpcEndpoint: 'grpc.override.me',
                                test: 'not.override.me',
                            },
                        },
                    },
                },
            },
        };

        const schema = overrideEndpoints(originalSchema, envParams, 'installationA', 'preprod');

        expect(schema.root.serviceName.endpoints.installationA.preprod.endpoint).toBe(
            'https://example.com',
        );
        expect(schema.root.serviceName.endpoints.installationA.preprod.grpcEndpoint).toBe(
            'grpc.example.com',
        );
        expect(schema.root.serviceName.endpoints.installationA.preprod.test).toBe(
            'not.override.me',
        );
    });

    test('override endpoint with scope', () => {
        const envParams = {
            'local.serviceName': {
                endpoint: 'example.com',
            },
        };

        const originalSchema = {
            root: {
                serviceName: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpoint: 'https://not.override.me',
                            },
                        },
                    },
                },
            },
            local: {
                serviceName: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpoint: 'https://override.me',
                            },
                        },
                    },
                },
            },
        };

        const schema = overrideEndpoints(originalSchema, envParams, 'installationA', 'preprod');

        expect(schema.local.serviceName.endpoints.installationA.preprod.endpoint).toBe(
            'example.com',
        );
        expect(schema.root.serviceName.endpoints.installationA.preprod.endpoint).toBe(
            'https://not.override.me',
        );
    });

    test('override only one environment', () => {
        const envParams = {
            serviceName: {
                endpoint: 'example.com',
            },
        };

        const originalSchema = {
            root: {
                serviceName: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpoint: 'https://override.me',
                            },
                            prod: {
                                endpoint: 'https://not.override.me',
                            },
                        },
                        installationB: {
                            preprod: {
                                endpoint: 'https://not.override.me',
                            },
                            prod: {
                                endpoint: 'https://not.override.me',
                            },
                        },
                    },
                },
            },
        };

        const schema = overrideEndpoints(originalSchema, envParams, 'installationA', 'preprod');

        expect(schema.root.serviceName.endpoints.installationA.preprod.endpoint).toBe(
            'example.com',
        );
        expect(schema.root.serviceName.endpoints.installationA.prod.endpoint).toBe(
            'https://not.override.me',
        );
        expect(schema.root.serviceName.endpoints.installationB.preprod.endpoint).toBe(
            'https://not.override.me',
        );
        expect(schema.root.serviceName.endpoints.installationB.prod.endpoint).toBe(
            'https://not.override.me',
        );
    });

    test('override extends endpoint with save other properties', () => {
        const envParams = {
            rootService: {
                endpoint: 'https://example.com',
                grpcEndpoint: 'example.com',
                test: 'example.ru',
            },
        };

        const testGrpcOptions = {test: Math.random()};
        const testAxiosConfig = {retry: Math.random()};

        const originalSchema = {
            root: {
                rootService: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpoint: {
                                    path: 'https://override.me',
                                    axiosConfig: testAxiosConfig,
                                },
                                grpcEndpoint: {
                                    path: 'grpc.override.me',
                                    grpcOptions: testGrpcOptions,
                                },
                                test: {
                                    path: 'test.override.me',
                                },
                            },
                        },
                    },
                },
            },
        };

        const schema = overrideEndpoints(originalSchema, envParams, 'installationA', 'preprod');

        expect(schema.root.rootService.endpoints.installationA.preprod.endpoint.path).toEqual(
            'https://example.com',
        );
        expect(
            schema.root.rootService.endpoints.installationA.preprod.endpoint.axiosConfig,
        ).toStrictEqual(testAxiosConfig);
        expect(schema.root.rootService.endpoints.installationA.preprod.grpcEndpoint.path).toEqual(
            'example.com',
        );
        expect(
            schema.root.rootService.endpoints.installationA.preprod.grpcEndpoint.grpcOptions,
        ).toStrictEqual(testGrpcOptions);
        expect(schema.root.rootService.endpoints.installationA.preprod.test.path).toEqual(
            'example.ru',
        );
    });

    test('insecure', () => {
        const envParams = {
            rootService: {
                endpointAAA: {
                    path: 'aaa.example.com',
                    insecure: false,
                },
                endpointBBB: {
                    path: 'bbb.example.com',
                    insecure: true,
                },
                endpointCCC: 'ccc.example.com',
                endpointDDD: {
                    path: 'ddd.example.com',
                    insecure: true,
                },
            },
        };

        const originalSchema = {
            root: {
                rootService: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpointAAA: {
                                    path: 'aaa.grpc.override.me',
                                    insecure: true,
                                },
                                endpointBBB: {
                                    path: 'bbb.grpc.override.me',
                                },
                                endpointCCC: 'ccc.grpc.override.me',
                                endpointDDD: 'ddd.grpc.override.me',
                            },
                        },
                    },
                },
            },
        };

        const schema = overrideEndpoints(originalSchema, envParams, 'installationA', 'preprod');

        expect(schema.root.rootService.endpoints.installationA.preprod.endpointAAA.path).toBe(
            'aaa.example.com',
        );
        expect(
            schema.root.rootService.endpoints.installationA.preprod.endpointAAA.insecure,
        ).toBeFalsy();
        expect(schema.root.rootService.endpoints.installationA.preprod.endpointBBB.path).toBe(
            'bbb.example.com',
        );
        expect(
            (
                schema.root.rootService.endpoints.installationA.preprod
                    .endpointBBB as ExtendedGrpcActionEndpoint
            ).insecure,
        ).toBeTruthy();
        expect(schema.root.rootService.endpoints.installationA.preprod.endpointCCC).toBe(
            'ccc.example.com',
        );
        expect(
            (
                schema.root.rootService.endpoints.installationA.preprod
                    .endpointDDD as unknown as ExtendedGrpcActionEndpoint
            ).path,
        ).toBe('ddd.example.com');
        expect(
            (
                schema.root.rootService.endpoints.installationA.preprod
                    .endpointDDD as unknown as ExtendedGrpcActionEndpoint
            ).insecure,
        ).toBeTruthy();
    });

    test('warning if incorrect params', () => {
        const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation();

        expect(() =>
            overrideEndpoints(
                {},
                {serviceName: {endpoint: 'example.com'}},
                'installationA',
                'preprod',
            ),
        ).not.toThrowError();
        expect(consoleWarnMock).toHaveBeenLastCalledWith(
            'overrideEndpoints: incorrect service root.serviceName',
        );

        expect(() =>
            overrideEndpoints(
                {},
                {'local.serviceName': {endpoint: 'example.com'}},
                'installationA',
                'preprod',
            ),
        ).not.toThrowError();
        expect(consoleWarnMock).toHaveBeenLastCalledWith(
            'overrideEndpoints: incorrect service local.serviceName',
        );

        expect(() =>
            overrideEndpoints(
                {
                    root: {
                        serviceName: {
                            actions: {},
                            endpoints: {
                                installationA: {
                                    preprod: {
                                        endpoint: 'https://override.me',
                                    },
                                },
                            },
                        },
                    },
                },
                {serviceName: {test: 'example.com'}},
                'installationA',
                'preprod',
            ),
        ).not.toThrowError();
        expect(consoleWarnMock).toHaveBeenLastCalledWith(
            'overrideEndpoints: incorrect endpointName test',
        );

        consoleWarnMock.mockRestore();
    });

    test('ignore mistake in override config', () => {
        const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation();

        const originalSchema = {
            root: {
                rootService: {
                    actions: {},
                    endpoints: {
                        installationA: {
                            preprod: {
                                endpoint: 'override.me',
                            },
                        },
                    },
                },
            },
        };

        const schema = overrideEndpoints(
            originalSchema,
            {serviceName: {endpoint: 'example.com'}, rootService: {endpoint: 'example2.com'}},
            'installationA',
            'preprod',
        );
        expect(consoleWarnMock).toHaveBeenLastCalledWith(
            'overrideEndpoints: incorrect service root.serviceName',
        );
        expect(schema.root.rootService.endpoints.installationA.preprod.endpoint).toBe(
            'example2.com',
        );
        consoleWarnMock.mockRestore();
    });
});
