import * as fs from 'fs';
import * as path from 'path';

import {sourceDir} from './source-dir.js';

let packageRootTest = path.resolve(sourceDir, '../package.json');
if (!fs.existsSync(packageRootTest)) {
    packageRootTest = path.resolve(sourceDir, '../../package.json');
}

export const packageRoot = path.dirname(packageRootTest);
