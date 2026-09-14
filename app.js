// Passenger looks for app.js by default. Keep the existing Next.js build and
// request handling while listening on the port assigned by the host.
const { createServer } = require("node:http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer((request, response) => handle(request, response)).listen(port);
  })
  .catch((error) => {
    console.error("Failed to start ABSP:", error);
    process.exitCode = 1;
  });
