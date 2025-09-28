export interface TestConfig {
    apiUrl: string;
    apiVersion: string;
    authToken: string;
    useMocks: boolean;
}
export declare function getTestConfig(): TestConfig;
