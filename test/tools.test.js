import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, buildTools, callMouser, loadSpecs } from "../src/tools.js";

const tools = buildTools(loadSpecs());

test("every Mouser endpoint becomes one tool", () => {
  const specs = loadSpecs();
  const endpoints = Object.values(specs).flatMap((s) => Object.values(s.paths).flatMap((ops) => Object.keys(ops)));
  assert.equal(tools.size, endpoints.length);
  assert.equal(tools.size, 27);
});

test("tool names are valid MCP names", () => {
  for (const name of tools.keys()) assert.match(name, /^[a-z0-9_]{1,64}$/);
});

test("no tool asks the caller for the API key", () => {
  for (const t of tools.values()) assert.ok(!("apiKey" in t.definition.inputSchema.properties), t.definition.name);
});

test("body schemas have no unresolved refs", () => {
  for (const t of tools.values()) assert.ok(!JSON.stringify(t.definition.inputSchema).includes("$ref"), t.definition.name);
});

test("search tools use the search key and are read-only", () => {
  const t = tools.get("post_search_keyword");
  assert.equal(t.keyKind, "search");
  assert.equal(t.definition.annotations.readOnlyHint, true);
});

test("order and cart writes use the order key and are marked destructive", () => {
  for (const name of ["post_order", "post_cart_items_insert", "post_cart_item_remove"]) {
    const t = tools.get(name);
    assert.equal(t.keyKind, "order", name);
    assert.equal(t.definition.annotations.destructiveHint, true, name);
  }
});

test("buildRequest fills version, path, query and body", () => {
  const { url, init } = buildRequest(tools.get("get_order_by_ordernumber"), { orderNumber: 123 }, "K");
  assert.equal(url, "https://api.mouser.com/api/v1/order/123?apiKey=K");
  assert.equal(init.method, "GET");
  assert.equal(init.body, undefined);

  const search = buildRequest(tools.get("post_search_keyword"), { request: { SearchByKeywordRequest: { keyword: "LM317" } } }, "K");
  assert.equal(search.url, "https://api.mouser.com/api/v1/search/keyword?apiKey=K");
  assert.deepEqual(JSON.parse(search.init.body), { SearchByKeywordRequest: { keyword: "LM317" } });

  const history = buildRequest(tools.get("get_orderhistory_bydatefilter"), { dateFilter: "ThisYear" }, "K");
  assert.equal(history.url, "https://api.mouser.com/api/v1/orderhistory/ByDateFilter?apiKey=K&dateFilter=ThisYear");
});

test("callMouser picks the key that matches the API", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(new URL(url).searchParams.get("apiKey"));
    return { ok: true, status: 200, text: async () => "{}" };
  };
  const env = { MOUSER_SEARCH_API_KEY: "S", MOUSER_ORDER_API_KEY: "O" };
  await callMouser(tools.get("v2_get_search_manufacturerlist"), {}, { env, fetchImpl });
  await callMouser(tools.get("get_cart"), { cartKey: "c" }, { env, fetchImpl });
  assert.deepEqual(seen, ["S", "O"]);
});

test("callMouser names the missing key", async () => {
  const r = await callMouser(tools.get("get_cart"), { cartKey: "c" }, { env: {}, fetchImpl: () => assert.fail() });
  assert.equal(r.ok, false);
  assert.match(r.text, /MOUSER_ORDER_API_KEY/);
});
