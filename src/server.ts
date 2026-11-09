import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fetchRfqs } from "./extract.ts";

let pending: Promise<Awaited<ReturnType<typeof fetchRfqs>>> | null = null;

function loadRfqs() {
  if (!pending) {
    pending = fetchRfqs().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/rfqs") {
    try {
      const rfqs = await loadRfqs();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(rfqs));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Download failed" }));
    }
    return;
  }

  const html = await readFile(new URL("../public/index.html", import.meta.url));
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3000, () => {
  console.log("http://localhost:3000");
});
