#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildTools, callMouser, loadSpecs } from "./src/tools.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const tools = buildTools(loadSpecs());
const server = new Server({ name: "mouser", version }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...tools.values()].map((t) => t.definition),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.get(req.params.name);
  if (!tool) return { isError: true, content: [{ type: "text", text: `Unknown tool ${req.params.name}` }] };
  try {
    const { ok, text } = await callMouser(tool, req.params.arguments ?? {});
    return { isError: !ok, content: [{ type: "text", text }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: String(err?.message ?? err) }] };
  }
});

await server.connect(new StdioServerTransport());
