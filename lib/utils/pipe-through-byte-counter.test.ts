import {Readable} from 'stream';
import {finished} from 'stream/promises';

import {pipeThroughByteCounter} from './pipe-through-byte-counter';

async function drain(readable: Readable): Promise<void> {
    readable.resume();
    await finished(readable);
}

describe('pipeThroughByteCounter', () => {
    test('calls onFlush with 0 for an empty source', async () => {
        const onFlush = jest.fn();
        const source = Readable.from([]);

        const out = pipeThroughByteCounter(source, onFlush);
        await drain(out);

        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush).toHaveBeenCalledWith(0);
    });

    test('sums Buffer chunks as byte length', async () => {
        const onFlush = jest.fn();
        const source = Readable.from([Buffer.from('ab'), Buffer.from('cde')]);

        const out = pipeThroughByteCounter(source, onFlush);
        await drain(out);

        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush).toHaveBeenCalledWith(5);
    });

    test('sums Uint8Array chunks', async () => {
        const onFlush = jest.fn();
        const source = Readable.from([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]);

        const out = pipeThroughByteCounter(source, onFlush);
        await drain(out);

        expect(onFlush).toHaveBeenCalledWith(5);
    });

    test('counts string chunks using Buffer.byteLength (utf8)', async () => {
        const onFlush = jest.fn();
        const source = Readable.from(['a', 'é']);

        const out = pipeThroughByteCounter(source, onFlush);
        await drain(out);

        expect(onFlush).toHaveBeenCalledWith(Buffer.byteLength('a') + Buffer.byteLength('é'));
    });

    test('sums mixed Buffer and string chunks', async () => {
        const onFlush = jest.fn();
        const source = Readable.from([Buffer.from('zz'), 'π']);

        const out = pipeThroughByteCounter(source, onFlush);
        await drain(out);

        expect(onFlush).toHaveBeenCalledWith(2 + Buffer.byteLength('π'));
    });

    test('forwards binary data unchanged', async () => {
        const onFlush = jest.fn();
        const a = Buffer.from([0, 255, 128]);
        const source = Readable.from([a]);

        const out = pipeThroughByteCounter(source, onFlush);
        const chunks: Uint8Array[] = [];
        out.on('data', (c) => chunks.push(c instanceof Uint8Array ? c : new Uint8Array(c)));

        await finished(out);

        expect(Buffer.concat(chunks)).toEqual(a);
        expect(onFlush).toHaveBeenCalledWith(3);
    });
});
