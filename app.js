// Passenger looks for app.js by default. Keep the existing Next.js build and
// request handling while listening on the port or socket assigned by the host.
const { createServer } = require("node:http");
const next = require("next");

const rawPort = process.env.PORT || 3000;
const port =
  typeof rawPort === "string" && /^\d+$/.test(rawPort)
    ? Number.parseInt(rawPort, 10)
    : rawPort;

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((request, response) => {
      handle(request, response);
    });

    server.listen(port, () => {
      console.log(`> ABSP server running on ${port}`);
    });

    const shutdown = (signal) => {
      console.log(`Received ${signal}, closing ABSP server gracefully...`);
      server.close(() => {
        console.log("ABSP server closed.");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("Forcefully shutting down ABSP server.");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    console.error("Failed to start ABSP:", error);
    process.exitCode = 1;
  });

