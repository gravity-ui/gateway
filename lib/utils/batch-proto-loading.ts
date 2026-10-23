import * as protobufjs from 'protobufjs';

import {GatewayRoot} from './proto-path-resolver';

export interface ProtoActionRef {
    protoPath: string;
    protoKey: string;
}

type ReflectionClass = abstract new (...args: never[]) => protobufjs.ReflectionObject;

interface ProtoIndex {
    byFullName: Map<string, protobufjs.ReflectionObject>;
    byName: Map<string, protobufjs.ReflectionObject[]>;
    typesByFile: Map<string, protobufjs.Type[]>;
    extensions: protobufjs.Field[];
}

const TYPES: ReflectionClass[] = [protobufjs.Type];
const TYPES_AND_ENUMS: ReflectionClass[] = [protobufjs.Type, protobufjs.Enum];
// Objects registered by protobufjs for the fully qualified name lookup
const FULLY_QUALIFIED: ReflectionClass[] = [protobufjs.Type, protobufjs.Enum, protobufjs.Field];

/**
 * Loads protos of the actions into the shared root one by one, the same way per-file loading does,
 * and returns proto paths which can be loaded by a single proto-loader call.
 *
 * In a single protobufjs Root an unqualified type name can be resolved to a type from a file
 * which is not imported: protobufjs checks the fully qualified name in the whole root and searches
 * nested namespaces of every enclosing scope. Resolved types of the shared root can not be used,
 * protobufjs resolves them while files are still being loaded.
 *
 * A proto path is batch-safe only if every type reachable from the protoKey service resolves to
 * the same imported type in any root containing the imports, no extension from a file which is
 * not imported can be attached to these types, and every extension in the imports has the only
 * possible target.
 */
export function loadBatchSafeProtoPaths(root: GatewayRoot, actions: ProtoActionRef[]): string[] {
    const files = new Map<string, string>();
    for (const {protoPath} of actions) {
        if (!files.has(protoPath)) {
            files.set(protoPath, root.resolvePath('', protoPath) ?? protoPath);
            root.loadSync(protoPath);
        }
    }

    const index = createIndex(root);
    const closures = new Map<string, Set<string>>();
    const getClosure = (file: string) => {
        let closure = closures.get(file);
        if (!closure) {
            closure = new Set([file]);
            closures.set(file, closure);
            for (const importedFile of root.imports.get(file) ?? []) {
                for (const closureFile of getClosure(importedFile)) {
                    closure.add(closureFile);
                }
            }
        }
        return closure;
    };

    const unsafePaths = new Set<string>();
    const checkedPaths = new Set<string>();
    const checkedActions = new Set<string>();
    for (const {protoPath, protoKey} of actions) {
        const closure = getClosure(files.get(protoPath) as string);

        if (!checkedPaths.has(protoPath)) {
            checkedPaths.add(protoPath);
            if (!hasDeterministicExtensions(index, closure)) {
                unsafePaths.add(protoPath);
            }
        }

        const actionKey = `${protoPath}\n${protoKey}`;
        if (unsafePaths.has(protoPath) || checkedActions.has(actionKey)) {
            continue;
        }
        checkedActions.add(actionKey);

        if (!isBatchSafeService(index, closure, protoKey)) {
            unsafePaths.add(protoPath);
        }
    }

    return [...files.keys()].filter((protoPath) => !unsafePaths.has(protoPath));
}

function createIndex(root: protobufjs.Root): ProtoIndex {
    const index: ProtoIndex = {
        byFullName: new Map(),
        byName: new Map(),
        typesByFile: new Map(),
        extensions: [],
    };

    const add = (object: protobufjs.ReflectionObject) => {
        index.byFullName.set(object.fullName, object);
        let objects = index.byName.get(object.name);
        if (!objects) {
            objects = [];
            index.byName.set(object.name, objects);
        }
        objects.push(object);
    };

    const walk = (namespace: protobufjs.Namespace) => {
        for (const object of namespace.nestedArray) {
            add(object);

            if (object instanceof protobufjs.Field && object.extend !== undefined) {
                index.extensions.push(object);
            }

            if (object instanceof protobufjs.Type) {
                object.fieldsArray.filter((field) => !field.declaringField).forEach(add);
                if (object.filename) {
                    let types = index.typesByFile.get(object.filename);
                    if (!types) {
                        types = [];
                        index.typesByFile.set(object.filename, types);
                    }
                    types.push(object);
                }
            }

            if (object instanceof protobufjs.Namespace) {
                walk(object);
            }
        }
    };

    walk(root);

    return index;
}

function isVisible(object: protobufjs.ReflectionObject, closure: Set<string>) {
    // Objects without file are bundled google/protobuf types and packages
    return !object.filename || closure.has(object.filename);
}

function isKindOf(object: protobufjs.ReflectionObject, kinds: ReflectionClass[] | null) {
    return !kinds || kinds.some((kind) => object instanceof kind);
}

/**
 * Returns the type which the reference resolves to in any root containing the imports,
 * or null if the result can depend on the root contents
 */
function resolveReference(
    index: ProtoIndex,
    closure: Set<string>,
    scope: protobufjs.Namespace,
    type: string,
    kinds: ReflectionClass[] | null,
): protobufjs.ReflectionObject | null {
    if (type.startsWith('.')) {
        const target = index.byFullName.get(type);
        return target && isKindOf(target, kinds) && isVisible(target, closure) ? target : null;
    }

    // Lookup checks the fully qualified name in the whole root before the enclosing scopes
    const fullNameMatch = index.byFullName.get(`.${type}`);
    if (fullNameMatch && isKindOf(fullNameMatch, FULLY_QUALIFIED)) {
        if (!isVisible(fullNameMatch, closure)) {
            return null;
        }
        if (isKindOf(fullNameMatch, kinds)) {
            return fullNameMatch;
        }
    }

    const segments = type.split('.');
    const candidates = (index.byName.get(segments[segments.length - 1]) ?? []).filter((object) =>
        isKindOf(object, kinds),
    );

    for (let level: protobufjs.Namespace | null = scope; level; level = level.parent) {
        const levelScope = level;
        const direct = index.byFullName.get(`${levelScope.fullName}.${type}`);
        if (direct && isKindOf(direct, kinds)) {
            return isVisible(direct, closure) ? direct : null;
        }

        // Nested namespaces are searched in the load order, which differs between roots
        if (candidates.some((candidate) => isLookupCandidate(candidate, levelScope, segments))) {
            return null;
        }
    }

    return null;
}

function isLookupCandidate(
    candidate: protobufjs.ReflectionObject,
    scope: protobufjs.Namespace,
    segments: string[],
) {
    const prefix = scope.fullName ? `${scope.fullName}.` : '.';
    if (!candidate.fullName.startsWith(prefix)) {
        return false;
    }

    // Lookup may descend into nested namespaces between the path segments
    const relativePath = candidate.fullName.slice(prefix.length).split('.');
    let matched = 0;
    for (const part of relativePath) {
        if (part === segments[matched]) {
            matched++;
        }
    }

    return matched === segments.length;
}

// Objects which an extension can be attached to in a root loaded in any order
function getExtensionCandidates(index: ProtoIndex, extension: protobufjs.Field) {
    const extend = extension.extend as string;
    if (extend.startsWith('.')) {
        const target = index.byFullName.get(extend);
        return target ? [target] : [];
    }

    const segments = extend.split('.');
    return (index.byName.get(segments[segments.length - 1]) ?? []).filter((candidate) =>
        isLookupCandidate(candidate, candidate.root, segments),
    );
}

// Extensions are attached while files are being loaded, so their target must be the only candidate
function hasDeterministicExtensions(index: ProtoIndex, closure: Set<string>) {
    return index.extensions
        .filter((extension) => isVisible(extension, closure))
        .every((extension) => {
            const candidates = getExtensionCandidates(index, extension);
            return candidates.length === 1 && isVisible(candidates[0], closure);
        });
}

function isBatchSafeService(index: ProtoIndex, closure: Set<string>, protoKey: string) {
    const service = index.byFullName.get(`.${protoKey}`);
    if (!(service instanceof protobufjs.Service) || !isVisible(service, closure)) {
        return false;
    }

    const reachable = new Set<protobufjs.Type>();
    const queue: protobufjs.Type[] = [];
    const visit = (scope: protobufjs.Namespace, type: string, kinds: ReflectionClass[]) => {
        const target = resolveReference(index, closure, scope, type, kinds);
        if (target instanceof protobufjs.Type && !reachable.has(target)) {
            reachable.add(target);
            queue.push(target);
        }
        return target !== null;
    };

    for (const method of service.methodsArray) {
        if (
            !visit(service, method.requestType, TYPES) ||
            !visit(service, method.responseType, TYPES)
        ) {
            return false;
        }
    }

    for (let type = queue.pop(); type; type = queue.pop()) {
        // Any.fromObject looks up the type from @type in the whole root
        if (type.fullName === '.google.protobuf.Any') {
            for (const file of closure) {
                for (const closureType of index.typesByFile.get(file) ?? []) {
                    if (!reachable.has(closureType)) {
                        reachable.add(closureType);
                        queue.push(closureType);
                    }
                }
            }
        }

        for (const field of type.fieldsArray) {
            const scope = field.declaringField ? field.declaringField.parent : type;
            if (
                (protobufjs.types.defaults as Record<string, unknown>)[field.type] === undefined &&
                (!scope || !visit(scope as protobufjs.Namespace, field.type, TYPES_AND_ENUMS))
            ) {
                return false;
            }
        }
    }

    // In a batch an extension from a file which is not imported can be attached to a reachable type
    return index.extensions.every(
        (extension) =>
            isVisible(extension, closure) ||
            getExtensionCandidates(index, extension).every(
                (candidate) => !reachable.has(candidate as protobufjs.Type),
            ),
    );
}
