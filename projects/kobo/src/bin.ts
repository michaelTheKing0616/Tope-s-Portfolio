import { startServer } from "./server.js";

const port = Number(process.env.PORT ?? 8787);
startServer(port);
console.log(`Kobo running at http://localhost:${port}`);
