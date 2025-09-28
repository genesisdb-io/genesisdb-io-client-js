"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestConfig = getTestConfig;
function getTestConfig() {
    // Check if we have real environment variables for testing
    const apiUrl = process.env.TEST_GENESISDB_API_URL;
    const apiVersion = process.env.TEST_GENESISDB_API_VERSION;
    const authToken = process.env.TEST_GENESISDB_AUTH_TOKEN;
    if (apiUrl && apiVersion && authToken) {
        return {
            apiUrl,
            apiVersion,
            authToken,
            useMocks: false
        };
    }
    // Fall back to default mock configuration
    return {
        apiUrl: 'http://localhost:8080',
        apiVersion: 'v1',
        authToken: 'test-token',
        useMocks: true
    };
}
