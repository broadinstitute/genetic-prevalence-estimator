// https://jestjs.io/docs/en/configuration.html

module.exports = {
  projects: [
    {
      displayName: "frontend",
      transform: {
        "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
      },
      moduleNameMapper: {
        "^lodash-es$": "lodash",
      },
      testMatch: ["<rootDir>/**/*.spec.(js|jsx|ts|tsx)"],
      testEnvironment: "jsdom",
      preset: "ts-jest",
    },
  ],
  roots: ["<rootDir>", "<rootDir>/tests"],
};

export {};
