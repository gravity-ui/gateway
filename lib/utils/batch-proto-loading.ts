import * as protobufjs from 'protobufjs';

export interface ProtoActionRef {
    protoPath: string;
    protoKey: string;
}

interface TypeReference {
    scope: protobufjs.Namespace;
    file: string;
    type: string;
    target: protobufjs.ReflectionObject;
}

/**
 * Loads protos of the actions into the shared root one by one, the same way per-file loading does,
 * and returns proto paths which can be loaded by a single proto-loader call.
 *
 * In a single protobufjs Root an unqualified type name can be resolved to a type from a file
 * which is not imported: protobufjs looks up the name in sibling namespaces and their nested types.
 * A proto path is batch-safe only if every type reference in its imports resolves the same way
 * in any root that contains these imports: to an imported type, by a direct match in one of
 * the enclosing scopes, with no other candidates in the inner scopes.
 */
export function loadBatchSafeProtoPaths(
    root: protobufjs.Root,
    actions: ProtoActionRef[],
): string[] {
    const imports = new Map<string, Set<string>>();
    const files = new Map<string, string | null>();
    const originalResolvePath = root.resolvePath;

    root.resolvePath = (origin, target) => {
        const resolved = originalResolvePath.call(root, origin, target);
        if (origin && resolved) {
            let fileImports = imports.get(origin);
            if (!fileImports) {
                fileImports = new Set();
                imports.set(origin, fileImports);
            }
            fileImports.add(resolved);
        }
        return resolved;
    };

    try {
        for (const {protoPath} of actions) {
            if (!files.has(protoPath)) {
                files.set(protoPath, root.resolvePath('', protoPath));
                root.loadSync(protoPath);
            }
        }
    } finally {
        root.resolvePath = originalResolvePath;
    }

    try {
        root.resolveAll();
    } catch {
        return [];
    }

    const closures = new Map<string, Set<string>>();
    const getClosure = (file: string) => {
        let closure = closures.get(file);
        if (!closure) {
            closure = new Set([file]);
            closures.set(file, closure);
            for (const importedFile of imports.get(file) ?? []) {
                for (const closureFile of getClosure(importedFile)) {
                    closure.add(closureFile);
                }
            }
        }
        return closure;
    };

    const {references, extensions, objectsByName, objectsByFullName} = collectReferences(root);

    const unsafeFiles = new Set<string>();
    for (const reference of references) {
        if (!isSafeReference(reference, getClosure(reference.file), objectsByName)) {
            unsafeFiles.add(reference.file);
        }
    }

    const unsafePaths = new Set<string>();
    for (const {protoPath, protoKey} of actions) {
        const file = files.get(protoPath);
        if (!file) {
            unsafePaths.add(protoPath);
            continue;
        }

        const closure = getClosure(file);
        const service = objectsByFullName.get(`.${protoKey}`);
        if (
            !(service instanceof protobufjs.Service) ||
            !isVisible(service, closure) ||
            [...closure].some((closureFile) => unsafeFiles.has(closureFile)) ||
            hasForeignExtensions(extensions, closure)
        ) {
            unsafePaths.add(protoPath);
        }
    }

    return [...files.keys()].filter((protoPath) => !unsafePaths.has(protoPath));
}

function collectReferences(root: protobufjs.Root) {
    const references: TypeReference[] = [];
    // Extended types with files of their extension fields
    const extensions = new Map<protobufjs.Type, Set<string>>();
    const objectsByName = new Map<string, protobufjs.ReflectionObject[]>();
    const objectsByFullName = new Map<string, protobufjs.ReflectionObject>();

    const addObject = (object: protobufjs.ReflectionObject) => {
        let objects = objectsByName.get(object.name);
        if (!objects) {
            objects = [];
            objectsByName.set(object.name, objects);
        }
        objects.push(object);
    };

    const addField = (field: protobufjs.Field, scope: protobufjs.Namespace) => {
        addObject(field);

        // Extension copies are resolved from the declaring field scope and checked with it
        if (field.declaringField) {
            if (field.declaringField.filename && scope instanceof protobufjs.Type) {
                let files = extensions.get(scope);
                if (!files) {
                    files = new Set();
                    extensions.set(scope, files);
                }
                files.add(field.declaringField.filename);
            }
            return;
        }

        if (field.filename && field.resolvedType) {
            references.push({
                scope,
                file: field.filename,
                type: field.type,
                target: field.resolvedType,
            });
        }
    };

    const walk = (namespace: protobufjs.Namespace) => {
        for (const object of namespace.nestedArray) {
            addObject(object);
            objectsByFullName.set(object.fullName, object);

            if (object instanceof protobufjs.Field) {
                addField(object, namespace);
            }

            if (object instanceof protobufjs.Type) {
                object.fieldsArray.forEach((field) => addField(field, object));
                object.oneofsArray.forEach(addObject);
            }

            if (object instanceof protobufjs.Service && object.filename) {
                for (const method of object.methodsArray) {
                    addObject(method);
                    for (const [type, target] of [
                        [method.requestType, method.resolvedRequestType],
                        [method.responseType, method.resolvedResponseType],
                    ] as const) {
                        if (target) {
                            references.push({scope: object, file: object.filename, type, target});
                        }
                    }
                }
            }

            if (object instanceof protobufjs.Namespace) {
                walk(object);
            }
        }
    };

    walk(root);

    // Descriptor options are encoded by proto-loader with its own root, their extensions do not matter
    // unless the options are used as message fields
    const referencedTypes = new Set(
        references
            .filter(({scope}) => !scope.fullName.startsWith('.google.protobuf.'))
            .map(({target}) => target),
    );
    for (const type of extensions.keys()) {
        if (/^\.google\.protobuf\.\w+Options$/.test(type.fullName) && !referencedTypes.has(type)) {
            extensions.delete(type);
        }
    }

    return {references, extensions, objectsByName, objectsByFullName};
}

// In a batch an extended type also gets extension fields from files which are not imported
function hasForeignExtensions(extensions: Map<protobufjs.Type, Set<string>>, closure: Set<string>) {
    for (const [type, files] of extensions) {
        if (isVisible(type, closure) && [...files].some((file) => !closure.has(file))) {
            return true;
        }
    }

    return false;
}

function isVisible(object: protobufjs.ReflectionObject, closure: Set<string>) {
    // Objects without file are bundled google/protobuf types
    return !object.filename || closure.has(object.filename);
}

function isSafeReference(
    {scope, type, target}: TypeReference,
    closure: Set<string>,
    objectsByName: Map<string, protobufjs.ReflectionObject[]>,
) {
    if (!isVisible(target, closure)) {
        return false;
    }

    // Absolute and fully qualified names are looked up by the full name first
    if (type.startsWith('.')) {
        return type === target.fullName;
    }
    if (`.${type}` === target.fullName) {
        return true;
    }

    const innerScopes: protobufjs.Namespace[] = [];
    let level: protobufjs.Namespace | null = scope;
    while (level && `${level.fullName}.${type}` !== target.fullName) {
        innerScopes.push(level);
        level = level.parent;
    }

    // Resolved by searching in nested namespaces, the result depends on the root contents and order
    if (!level) {
        return false;
    }

    const segments = type.split('.');
    const candidates = objectsByName.get(segments[segments.length - 1]) ?? [];

    return !candidates.some(
        (candidate) =>
            candidate !== target &&
            innerScopes.some((innerScope) => isLookupCandidate(candidate, innerScope, segments)),
    );
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
