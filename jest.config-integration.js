module.exports = {
    roots: ['<rootDir>/integration-test'],
    moduleDirectories: ['node_modules'],
    moduleFileExtensions: ['js', 'ts', 'json'],
    testMatch: ['<rootDir>/integration-test/**/?(*.)test.ts'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
};
