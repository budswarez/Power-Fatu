import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "@swc/jest",
      {
        jsc: {
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Silence CSS module imports in tests
    "^.+\\.css$": "<rootDir>/src/lib/__tests__/__mocks__/styleMock.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/src/lib/__tests__/setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/components/**/*.tsx",
    "src/app/**/page.tsx",
    "src/app/api/**/*.ts",
    "!src/lib/firebase.ts",
    "!src/lib/firebase-admin.ts",
    "!src/**/*.d.ts",
  ],
};

export default config;
