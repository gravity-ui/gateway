import * as grpc from '@grpc/grpc-js';
import {Metadata} from '@grpc/grpc-js/build/src/metadata';

import {v1Package} from '../package-definitions';

function serverStreamCall(
    //@ts-ignore
    client: v1Package.MetaService,
    serviceMetadata: Metadata,
    actionName: string,
) {
    // eslint-disable-next-line new-cap
    const call = client[actionName]({from: 10, to: 15}, serviceMetadata, {
        deadline: Date.now() + 1000 * 60,
    });
    call.on('data', function (result: any) {
        console.log('ServerStream DATA', result);
    });
    call.on('end', function () {
        console.log('ServerStream END');
        // The server has finished sending
    });
    call.on('error', function (e: any) {
        console.error('ServerStream ERROR', e);
        // An error has occurred and the stream has been closed.
    });
    call.on('status', function (status: any) {
        console.log('ServerStream STATUS', status);
        // process status
    });
}

export function nativeCall() {
    //@ts-ignore
    const client = new v1Package.MetaService('localhost:50051', grpc.credentials.createInsecure());
    const serviceMetadata = new grpc.Metadata();
    const metadata = {
        'meta-key': 'meta-value',
    };
    Object.keys(metadata).forEach((key) => {
        // @ts-ignore
        serviceMetadata.add(key, metadata[key]);
    });

    // Unary call
    // eslint-disable-next-line new-cap
    client.GetEntityUnary(
        {query: 'xxx=aaa'},
        serviceMetadata,
        {
            deadline: Date.now() + 1000 * 60,
        },
        (error: any, value: any) => {
            console.log('GetEntityUnary result');
            console.log(error, value);
        },
    );

    // eslint-disable-next-line new-cap
    client.Unimplemented(null, serviceMetadata, (error: any, value: any) => {
        console.log('Unimplemented result');
        console.log(error, value);
    });

    // eslint-disable-next-line new-cap
    client.MethodWithError(null, serviceMetadata, (error: any, value: any) => {
        console.log('MethodWithError result');
        console.log(error, value);
    });

    // eslint-disable-next-line new-cap
    client.MethodWithDeadline(null, serviceMetadata, (error: any, value: any) => {
        console.log('MethodWithDeadline result');
        console.log(error, value);
    });

    // Server stream call
    // eslint-disable-next-line new-cap
    serverStreamCall(client, serviceMetadata, 'GetEntityListServerStream');
    serverStreamCall(client, serviceMetadata, 'GetEntityListServerStreamWithError');
}

nativeCall();
