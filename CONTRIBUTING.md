# Contributing

Issues and pull requests are welcome. For anything larger than a fix, open an
issue first so we can agree the shape before you write it.

## Layout

| Path | What |
|---|---|
| `server.js` | The MCP server over stdio. The `mouser-mcp` command |
| `src/tools.js` | Turns the specs into tools and makes the HTTP calls |
| `spec/` | Mouser's Swagger specs. **Downloaded**, not edited |
| `test/` | Unit tests, and a test that starts the server over stdio |

Never edit `spec/` by hand. To pick up a change in Mouser's API:

```sh
npm run update-specs
npm test
```

## Making a change

```sh
npm install
npm test
```

The tests never call Mouser. To try a real call, start the server with your
keys and connect a client to it, for example the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
MOUSER_SEARCH_API_KEY=... npx @modelcontextprotocol/inspector node server.js
```

## Releasing

1. `npm version X.Y.Z --no-git-tag-version`.
2. Move the `[Unreleased]` notes in `CHANGELOG.md` under a new `## [X.Y.Z]`
   heading. They become the GitHub release notes.
3. Commit, open a PR, merge.
4. Tag the merge commit `vX.Y.Z` and push the tag: `git push origin vX.Y.Z`.

The `release` workflow then checks that the tag matches `package.json`, runs
the tests, makes the GitHub release and publishes to npm.

### Registry credentials (maintainers)

| Registry | Set up | Until then |
|---|---|---|
| npm | [Trusted publishing](https://docs.npmjs.com/trusted-publishers): on the package's settings, a GitHub Actions publisher for this repo and `release.yml`. Then repository variable `NPM_ENABLED=true`. npm only allows it on an existing package, so publish the first version by hand | Skipped |

## Code of conduct

Be kind, assume good faith, and keep discussion about the work.
