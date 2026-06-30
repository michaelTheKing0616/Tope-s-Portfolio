#!/usr/bin/env node
import { startServer } from "./server.js";

const port = Number(process.env.PORT ?? 8790);
const { port: p } = startServer({ port });
console.log(`Tatafo UI at http://localhost:${p}`);
