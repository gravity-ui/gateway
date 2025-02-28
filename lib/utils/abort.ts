import type {SurfaceCall} from '@grpc/grpc-js/build/src/call';

import {GrpcError} from './parse-error';

type ListenForAbortArgs = {
    signal?: AbortSignal;
    config: {abortOnClientDisconnect?: boolean};
    call: SurfaceCall;
    reject: (err: Error) => void;
};

export function listenForAbort({signal, config, call, reject}: ListenForAbortArgs) {
    if (!signal || !config.abortOnClientDisconnect) {
        return () => null;
    }

    const handleAbortSignal = () => {
        call.cancel();

        reject(
            new GrpcError('Request was cancelled.', {
                status: 400,
                code: 'REQUEST_WAS_CANCELLED',
                message: 'Request was cancelled because the original connection was disconnected.',
            }),
        );
    };

    let aborted = false;

    signal.addEventListener('abort', handleAbortSignal);

    return () => {
        if (aborted) {
            return;
        }
        aborted = true;

        signal.removeEventListener('abort', handleAbortSignal);
    };
}
