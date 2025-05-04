import * as path from 'path';
import * as url from 'url';
// @ts-ignore to get the CommonJS build to ignore it
export const sourceDir = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '..');
