import {Transform, pipeline} from 'stream';
import type {Readable} from 'stream';

export function pipeThroughByteCounter(
    source: NodeJS.ReadableStream,
    onFlush: (streamedBytes: number) => void,
): Readable {
    let streamedBytes = 0;
    let reported = false;

    const report = () => {
        if (!reported) {
            reported = true;
            onFlush(streamedBytes);
        }
    };

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
            report();
            cb();
        },
    });

    // Unlike .pipe, pipeline forwards source errors to counter. flush does not run
    // after an error, so the callback reports stats for failed streams
    return pipeline(source, counter, report);
}
