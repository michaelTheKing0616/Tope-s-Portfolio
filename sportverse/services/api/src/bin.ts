import { startServer } from "./server.js";

const { port } = await startServer();
console.log(`SPORTVERSE API at http://localhost:${port}`);
