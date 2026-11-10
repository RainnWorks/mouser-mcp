import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("the server starts over stdio and lists its tools", async () => {
  const client = new Client({ name: "test", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ["server.js"], env: {} }));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 27);
  const result = await client.callTool({ name: "get_cart", arguments: { cartKey: "x" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /MOUSER_ORDER_API_KEY is not set/);
  await client.close();
});
