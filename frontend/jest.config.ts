import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
    dir: "./",
});

const config: Config = {
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testEnvironment: "jsdom",

    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },

    testMatch: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
    ],

    collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
    ],

    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],

    coverageThreshold: {
        global: {
            branches: 80,
            lines: 80,
        },
    },
};

export default createJestConfig(config);