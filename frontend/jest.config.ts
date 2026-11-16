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

  testMatch: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],

  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",

    // Type-only declarations.
    "!src/**/*.d.ts",
    "!src/**/types/**",

    // Next.js routing/bootstrap glue.
    "!src/app/**",

    // Thin provider composition wrappers only.
    // TaskDataProvider contains DDP-80 business logic and must
    // remain included in coverage.
    "!src/providers/antd-provider.tsx",
    "!src/providers/app-providers.tsx",

    // Re-export-only barrel files.
    "!src/**/index.ts",

    // Static presentation data.
    "!src/**/constants/**",
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
