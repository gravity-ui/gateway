module.exports = {
    roots: ['<rootDir>/lib'],
    moduleDirectories: ['node_modules'],
    moduleFileExtensions: ['js', 'ts', 'json'],
    testMatch: ['<rootDir>/lib/**/?(*.)test.ts'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json'}],
    },
};
