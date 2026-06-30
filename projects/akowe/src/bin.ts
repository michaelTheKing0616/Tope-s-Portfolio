import { startServer } from "./server.js";

const { port } = startServer();
console.log(`Akowe running at http://localhost:${port}`);
