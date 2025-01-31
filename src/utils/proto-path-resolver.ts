import * as fs from 'fs';
import * as path from 'path';

import * as protobufjs from 'protobufjs';

export function patchProtoPathResolver(root: protobufjs.Root, includeDirs: string[]) {
    const originalResolvePath = root.resolvePath;
    root.resolvePath = function (origin, target) {
        if (target in protobufjs.common || path.isAbsolute(target)) {
            return target;
        }
        for (let i = 0; i < includeDirs.length; i++) {
            const directory = includeDirs[i];
            const fullPath = path.join(directory, target);
            try {
                fs.accessSync(fullPath, fs.constants.R_OK);
                return fullPath;
            } catch (err) {
                continue;
            }
        }
        return originalResolvePath(origin, target);
    };
}
