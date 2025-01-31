export default {
    roots: ['<rootDir>/src'],
    moduleDirectories: ['node_modules'],
    moduleFileExtensions: ['cjs', 'cts', 'js', 'ts', 'json'],
    testMatch: ['<rootDir>/src/**/?(*.)test.ts'],
    transform: {
        '^.+\\.c?ts$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json', useESM: true}],
    },
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '(.+\\/source-dir)\\.js$': '$1-cjs',
        '(.+)\\.js$': '$1',
    },
};
