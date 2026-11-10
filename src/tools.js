import { readFileSync } from "node:fs";

export const BASE_URL = "https://api.mouser.com";
export const SPEC_NAMES = ["v1", "v2"];

export const KEY_ENV = {
  search: "MOUSER_SEARCH_API_KEY",
  order: "MOUSER_ORDER_API_KEY",
};

export function loadSpecs() {
  return Object.fromEntries(
    SPEC_NAMES.map((name) => [name, JSON.parse(readFileSync(new URL(`../spec/${name}.json`, import.meta.url)))]),
  );
}

export function inlineRefs(schema, definitions, seen = new Set()) {
  if (Array.isArray(schema)) return schema.map((s) => inlineRefs(s, definitions, seen));
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) {
    const name = schema.$ref.replace("#/definitions/", "");
    if (seen.has(name)) return { type: "object", description: name };
    return inlineRefs(definitions[name], definitions, new Set([...seen, name]));
  }
  return Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, inlineRefs(v, definitions, seen)]));
}

export function toolName(path, method, specName) {
  const slug = path
    .replace(/^\/api\/v(\{version\}|\d)\//, "")
    .replace(/\{(\w+)\}/g, "by_$1")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase();
  const prefix = specName === "v1" ? "" : `${specName}_`;
  return `${prefix}${method}_${slug}`.slice(0, 64);
}

function parameterSchema(param, definitions) {
  const schema = param.in === "body"
    ? inlineRefs(param.schema, definitions)
    : { type: param.type, ...(param.format && { format: param.format }), ...(param.enum && { enum: param.enum }) };
  return param.description ? { ...schema, description: param.description } : schema;
}

export function buildTools(specs) {
  const tools = new Map();
  for (const [specName, spec] of Object.entries(specs)) {
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(operations)) {
        const name = toolName(path, method, specName);
        const tags = op.tags ?? [];
        const params = (op.parameters ?? []).filter((p) => p.name !== "apiKey" && p.name !== "version");
        const properties = Object.fromEntries(params.map((p) => [p.name, parameterSchema(p, spec.definitions)]));
        if (path.includes("{version}")) {
          properties.version = { type: "string", description: "API version. Defaults to 1.", default: "1" };
        }
        const keyKind = tags.includes("SearchApi") ? "search" : "order";
        const readOnly = method === "get" || keyKind === "search";
        tools.set(name, {
          path,
          method,
          params,
          keyKind,
          definition: {
            name,
            description: [`[${tags.join(",")}] ${method.toUpperCase()} ${path}`, op.summary, op.description]
              .filter(Boolean)
              .join("\n"),
            inputSchema: { type: "object", properties, required: params.filter((p) => p.required).map((p) => p.name) },
            annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly },
          },
        });
      }
    }
  }
  return tools;
}

export function buildRequest(tool, args, apiKey, baseUrl = BASE_URL) {
  let path = tool.path.replace("{version}", encodeURIComponent(args.version ?? "1"));
  const query = new URLSearchParams({ apiKey });
  let body;
  for (const p of tool.params) {
    const value = args[p.name];
    if (value === undefined) continue;
    if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(value));
    else if (p.in === "query") query.set(p.name, String(value));
    else if (p.in === "body") body = JSON.stringify(value);
  }
  const method = tool.method.toUpperCase();
  return {
    url: `${baseUrl}${path}?${query}`,
    init: {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: method === "GET" ? undefined : body ?? "{}",
    },
  };
}

export async function callMouser(tool, args, { env = process.env, fetchImpl = fetch } = {}) {
  const envName = KEY_ENV[tool.keyKind];
  const apiKey = env[envName];
  if (!apiKey) return { ok: false, text: `${envName} is not set.` };
  const { url, init } = buildRequest(tool, args, apiKey);
  const res = await fetchImpl(url, init);
  return { ok: res.ok, text: `HTTP ${res.status}\n${await res.text()}` };
}
