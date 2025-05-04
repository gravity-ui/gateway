export default {
    roots: ['<rootDir>/integration-test'],
    moduleDirectories: ['node_modules'],
    moduleFileExtensions: ['cjs', 'cts', 'js', 'ts', 'json'],
    testMatch: ['<rootDir>/integration-test/**/?(*.)test.ts'],
    transform: {
        '^.+\\.c?ts$': [
            'ts-jest',
            {tsconfig: '<rootDir>/integration-test/tsconfig.json', useESM: true},
        ],
    },
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '(.+\\/source-dir)\\.js$': '$1-cjs',
        '(.+)\\.c?js$': '$1',
    },
};
