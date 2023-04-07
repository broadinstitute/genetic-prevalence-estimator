module.exports = {
  presets: [
    ["@babel/preset-typescript"],
    [
      "@babel/preset-react",
      {
        useBuiltIns: false,
      },
    ],
    ["@babel/preset-env"],
  ],
};
