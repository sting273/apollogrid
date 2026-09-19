import type { Plugin } from "vite";

// The hosted authentication remains unchanged. Only the loopback dev server
// supplies a local identity, before requests enter the Cloudflare worker.
export function localAdmin(): Plugin {
  return {
    name: "apollogrid-local-admin",
    enforce: "pre",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const host = request.headers.host ?? "";
        const remote = request.socket.remoteAddress;
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
            !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "")) {
          response.statusCode = 403;
          response.end("Local access only");
          return;
        }
        const origin = request.headers.origin;
        if (origin && origin !== `http://${host}`) {
          response.statusCode = 403;
          response.end("Cross-origin requests are not allowed");
          return;
        }
        request.headers["oai-authenticated-user-id"] = "apollogrid-local-owner";
        request.headers["oai-authenticated-user-email"] = "owner@localhost";
        for (let i = request.rawHeaders.length - 2; i >= 0; i -= 2) {
          if (request.rawHeaders[i].toLowerCase().startsWith("oai-authenticated-user-")) {
            request.rawHeaders.splice(i, 2);
          }
        }
        request.rawHeaders.push("oai-authenticated-user-id", "apollogrid-local-owner",
          "oai-authenticated-user-email", "owner@localhost");
        next();
      });
    },
  };
}
