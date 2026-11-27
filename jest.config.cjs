module.exports = {
  coverageDirectory: "client/src/coverage",
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  projects: [
    {
      displayName: "client",
      testEnvironment: "jest-environment-jsdom",
      setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
      moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
        "^@/(.*)$": "<rootDir>/client/src/$1",
        "^@shared/(.*)$": "<rootDir>/shared/$1",
      },
      testMatch: [
        "**/client/src/**/__tests__/**/*.[jt]s?(x)",
        "**/client/src/**/?(*.)+(spec|test).[jt]s?(x)",
      ],
      transform: {
        "^.+\\.(t|j)sx?$": "babel-jest",
      },
      transformIgnorePatterns: ["/node_modules/(?!(react-leaflet|@react-leaflet|leaflet)/)"],
    },
    {
      displayName: "server",
      testEnvironment: "node",
      testTimeout: 30000,
      moduleNameMapper: {
        "^@shared/(.*)$": "<rootDir>/shared/$1",
      },
      testMatch: ["**/server/__tests__/**/*.test.[jt]s?(x)"],
      transform: {
        "^.+\\.(t|j)sx?$": "babel-jest",
      },
    },
  ],
};
