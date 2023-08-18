import {createServer} from 'http';
import * as path from 'path';

import {
    Server,
    ServerCredentials,
    handleBidiStreamingCall,
    handleClientStreamingCall,
    handleServerStreamingCall,
    handleUnaryCall,
} from '@grpc/grpc-js/build/src';
import {Status} from '@grpc/grpc-js/build/src/constants';
import {addReflection} from 'grpc-server-reflection';

import {serverEndpoint} from '../constants';
import {v1Package} from '../package-definitions';

function startHttpServer() {
    const hostname = '127.0.0.1';
    const port = 3000;

    const server = createServer((_, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World');
    });

    server.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
}

const getEntityUnary: handleUnaryCall<any, any> = (call, callback) => {
    callback(null, {
        result: `response-${call.request.query}`,
        test_case_result: `case-response-${call.request.query}`,
    });
};

const getLongEntityUnary: handleUnaryCall<any, any> = async (call, callback) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    getEntityUnary(call, callback);
};

const methodWithError: handleUnaryCall<any, any> = (_, callback) => {
    callback(
        {
            message: 'Method is down',
            code: Status.DATA_LOSS,
            details: 'Error details here',
        },
        null,
    );
};

const methodWithDeadline: handleUnaryCall<any, any> = async (_, callback) => {
    callback(
        {
            message: 'Method with deadline exceeded',
            code: Status.DEADLINE_EXCEEDED,
            details: 'Deadline exceeded',
        },
        null,
    );
};

const getEntityListServerStream: handleServerStreamingCall<any, any> = (call) => {
    const from = call.request.from;
    const to = call.request.to;
    for (let i = from; i < to; i++) {
        call.write({
            result: `item-${i}`,
        });
    }
    call.end();
};

const getEntityListServerStreamWithError: handleServerStreamingCall<any, any> = (call) => {
    call.destroy(new Error('Server has a bad mood today'));
};

const getEntityListClientStream: handleClientStreamingCall<any, any> = (call, callback) => {
    const data: any[] = [];
    call.on('data', (item) => {
        data.push(item.id);
    });
    call.on('end', () => {
        callback(null, {
            items: data,
        });
    });
};

const getEntityListDuplexStream: handleBidiStreamingCall<any, any> = (call) => {
    call.on('data', (item) => {
        setTimeout(
            () =>
                call.write({
                    ...item,
                    hash: `hash-${item.id}`,
                }),
            100,
        );
    });
    call.on('end', () => {
        setTimeout(() => call.end(), 100);
    });
};

const getEntityTestOptions: handleUnaryCall<any, any> = (call, callback) => {
    callback(null, {
        test_case_result: `case-response-${call.request.query_case}`,
        status: 1,
    });
};

const getDataWithTimeout: handleUnaryCall<any, any> = (call, callback) => {
    if (call.request.throw_error) {
        callback(
            {
                message: 'Method with deadline exceeded',
                code: Status.DEADLINE_EXCEEDED,
                details: 'Deadline exceeded',
            },
            null,
        );
        return;
    }
    setTimeout(() => {
        callback(null, {
            result: `response-${call.request.id}`,
        });
    }, call.request.timeout);
};

function startGrpcServer() {
    const server = new Server();
    addReflection(server, path.resolve(__dirname, '../proto/descriptor_set.bin'));
    // @ts-ignore
    server.addService(v1Package.MetaService.service, {
        // @ts-ignore
        GetEntityUnary: getEntityUnary,
        GetLongEntityUnary: getLongEntityUnary,
        MethodWithError: methodWithError,
        MethodWithDeadline: methodWithDeadline,
        GetEntityListServerStream: getEntityListServerStream,
        GetEntityListServerStreamWithError: getEntityListServerStreamWithError,
        GetEntityListClientStream: getEntityListClientStream,
        GetEntityListDuplexStream: getEntityListDuplexStream,
        GetEntityTestOptions: getEntityTestOptions,
    });
    // @ts-ignore
    server.addService(v1Package.Meta2Service.service, {
        GetEntityUnary: getEntityUnary,
    });
    // @ts-ignore
    server.addService(v1Package.Meta3Service.service, {
        GetEntityUnary: getEntityUnary,
    });
    // @ts-ignore
    server.addService(v1Package.TimeoutService.service, {
        GetDataWithTimeout: getDataWithTimeout,
    });
    server.bindAsync(serverEndpoint, ServerCredentials.createInsecure(), () => {
        server.start();
    });
}

function main() {
    startGrpcServer();

    // to make start-server-and-test working
    startHttpServer();
}

main();
