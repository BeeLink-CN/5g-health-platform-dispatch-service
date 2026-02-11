module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.integration.test.ts', '**/integration/*.test.ts'],
    setupFiles: ['dotenv/config'],
    testTimeout: 30000
};
