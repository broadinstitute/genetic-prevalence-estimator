const http = require("http");

const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    ["/api", "/static/rest_framework"],
    createProxyMiddleware({
      target: "http://website:8080",
      changeOrigin: true,
    })
  );

  // Include cookies from app server in WDS response.
  // This is needed to get the CSRF token.
  app.use(/^\/(?!(api|static)\/)/, (proxyReq, proxyRes, next) => {
    http
      .request(`http://website:8080${proxyReq.path}`, (appResponse) => {
        appResponse
          .on("data", () => {})
          .on("end", () => {
            proxyRes.append("set-cookie", appResponse.headers["set-cookie"]);

            next();
          });
      })
      .end();
  });
};
