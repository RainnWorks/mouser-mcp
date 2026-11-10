# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-10

First release.

### Added

- One MCP tool for each endpoint in Mouser's published API specs (27 tools):
  Search v1 and v2, Cart, Order and Order History.
- Tool inputs come from the specs, with every request body schema written out
  in full.
- `MOUSER_SEARCH_API_KEY` for the Search API and `MOUSER_ORDER_API_KEY` for the
  Cart, Order and Order History APIs. The server adds the right key to each call.
- Search and read tools are marked read-only. Cart and order writes are marked
  destructive.

[Unreleased]: https://github.com/RainnWorks/mouser-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RainnWorks/mouser-mcp/releases/tag/v0.1.0
