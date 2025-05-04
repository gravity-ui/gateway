// this one has a -cjs.cts suffix, so it will override the
// module at src/utils/source-dir.ts in the CommonJS build,
// and be excluded from the esm build.
import * as path from 'path';
export const sourceDir = path.resolve(__dirname, '..');
