const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    ["/api", "/static/rest_framework"],
    createProxyMiddleware({
      target: "http://website:8080",
      changeOrigin: true,
    })
  );
};
