#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://api.mouser.com";
const keys = {
  search: process.env.MOUSER_SEARCH_API_KEY,
  order: process.env.MOUSER_ORDER_API_KEY,
};

const loadSpec = (name) => JSON.parse(readFileSync(new URL(`./spec/${name}.json`, import.meta.url)));

function inlineRefs(schema, definitions, seen = new Set()) {
  if (Array.isArray(schema)) return schema.map((s) => inlineRefs(s, definitions, seen));
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) {
    const name = schema.$ref.replace("#/definitions/", "");
    if (seen.has(name)) return { type: "object", description: name };
    return inlineRefs(definitions[name], definitions, new Set([...seen, name]));
  }
  return Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, inlineRefs(v, definitions, seen)]));
}

function toolName(path, method, specName) {
  const slug = path
    .replace(/^\/api\/v(\{version\}|\d)\//, "")
    .replace(/\{(\w+)\}/g, "by_$1")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase();
  const prefix = specName === "v2" ? "v2_" : "";
  return `${prefix}${method}_${slug}`.slice(0, 64);
}

function buildTools() {
  const tools = new Map();
  for (const specName of ["v1", "v2"]) {
    const spec = loadSpec(specName);
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const properties = {};
        const required = [];
        const params = (op.parameters ?? []).filter((p) => p.name !== "apiKey" && p.name !== "version");
        for (const p of params) {
          const prop = p.in === "body"
            ? inlineRefs(p.schema, spec.definitions)
            : { type: p.type, ...(p.format && { format: p.format }), ...(p.enum && { enum: p.enum }) };
          if (p.description) prop.description = p.description;
          properties[p.name] = prop;
          if (p.required) required.push(p.name);
        }
        if (path.includes("{version}")) {
          properties.version = { type: "string", description: "API version. Defaults to 1.", default: "1" };
        }
        const isSearch = (op.tags ?? []).includes("SearchApi");
        tools.set(toolName(path, method, specName), {
          path, method, params, isSearch,
          definition: {
            name: toolName(path, method, specName),
            description: `[${(op.tags ?? []).join(",")}] ${method.toUpperCase()} ${path}\n${op.summary ?? ""}\n${op.description ?? ""}`.trim(),
            inputSchema: { type: "object", properties, required },
            annotations: { readOnlyHint: method === "get" || isSearch },
          },
        });
      }
    }
  }
  return tools;
}

async function callMouser(tool, args) {
  const apiKey = tool.isSearch ? keys.search : keys.order;
  if (!apiKey) throw new Error(`Set ${tool.isSearch ? "MOUSER_SEARCH_API_KEY" : "MOUSER_ORDER_API_KEY"}`);
  let path = tool.path.replace("{version}", args.version ?? "1");
  const query = new URLSearchParams({ apiKey });
  let body;
  for (const p of tool.params) {
    const value = args[p.name];
    if (value === undefined) continue;
    if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(value));
    else if (p.in === "query") query.set(p.name, String(value));
    else if (p.in === "body") body = JSON.stringify(value);
  }
  const res = await fetch(`${BASE_URL}${path}?${query}`, {
    method: tool.method.toUpperCase(),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: tool.method === "get" ? undefined : body ?? "{}",
  });
  const text = await res.text();
  return { ok: res.ok, text: `HTTP ${res.status}\n${text}` };
}

const tools = buildTools();
const server = new Server({ name: "mouser", version: "0.1.0" }, { capabilities: { tools: {} } });

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
