import {Transform} from 'stream';
import type {Readable} from 'stream';

export function pipeThroughByteCounter(
    source: NodeJS.ReadableStream,
    onFlush: (streamedBytes: number) => void,
): Readable {
    let streamedBytes = 0;

    const counter = new Transform({
        transform(chunk, encoding, cb) {
            if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
                streamedBytes += chunk.length;
            } else if (typeof chunk === 'string') {
                streamedBytes += Buffer.byteLength(
                    chunk,
                    typeof encoding === 'string' ? encoding : undefined,
                );
            }

            cb(null, chunk);
        },
        flush(cb) {
            onFlush(streamedBytes);
            cb();
        },
    });

    return source.pipe(counter);
}
