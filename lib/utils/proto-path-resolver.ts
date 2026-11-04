import fs from 'fs';
import path from 'path';

import * as protobufjs from 'protobufjs';

function resolveIncludePath(target: string, includeDirs: string[]) {
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
    return null;
}

export function patchProtoPathResolver(root: protobufjs.Root, includeDirs: string[]) {
    const originalResolvePath = root.resolvePath;
    root.resolvePath = function (origin, target) {
        return resolveIncludePath(target, includeDirs) ?? originalResolvePath(origin, target);
    };
}

/**
 * Root which resolves imports in include dirs and records imports of the loaded files
 */
export class GatewayRoot extends protobufjs.Root {
    readonly imports = new Map<string, Set<string>>();
    private readonly includeDirs: string[];

    constructor(includeDirs: string[]) {
        super();
        this.includeDirs = includeDirs;
    }

    resolvePath(origin: string, target: string): string | null {
        const resolved =
            resolveIncludePath(target, this.includeDirs) ?? super.resolvePath(origin, target);

        if (origin && resolved) {
            let fileImports = this.imports.get(origin);
            if (!fileImports) {
                fileImports = new Set();
                this.imports.set(origin, fileImports);
            }
            fileImports.add(resolved);
        }

        return resolved;
    }
}
