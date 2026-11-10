# mouser-mcp

A quick MCP server for the Mouser APIs: Search (v1 and v2), Cart, Order and Order History.

It builds one tool per endpoint from Mouser's own Swagger specs in `spec/`, fetched from
`https://api.mouser.com/api/docs/V1` and `/V2`. The server adds the API key to each call.

## Run

```sh
npm install
MOUSER_SEARCH_API_KEY=... MOUSER_ORDER_API_KEY=... node server.js
```

Search tools use `MOUSER_SEARCH_API_KEY`. Cart, Order and Order History tools use `MOUSER_ORDER_API_KEY`.

## Claude Code

```sh
claude mcp add mouser -s user \
  -e MOUSER_SEARCH_API_KEY="$(op read 'op://claw/Mouser/Search API Key')" \
  -e MOUSER_ORDER_API_KEY="$(op read 'op://claw/Mouser/Order API Key')" \
  -- node /path/to/mouser-mcp/server.js
```

## Refresh the specs

```sh
curl -s https://api.mouser.com/api/docs/V1 -o spec/v1.json
curl -s https://api.mouser.com/api/docs/V2 -o spec/v2.json
```

`post_order` places a real order. `post_cart*` changes the real cart.
