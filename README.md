# OpaDeck

**Run operations, not pages.**

OpaDeck is an operation-centric internal ops workbench with first-class data sources, help, tours, cards, and flexible layouts.

## Docs

- English:
  - [**Using OpaDeck（ライブラリ利用者ガイド・スクショ付き）**](docs/en/USING-OPADECK.md)
  - [Constitution](docs/en/CONSTITUTION.md)
  - [Roadmap](docs/en/ROADMAP.md)
  - [DSL](docs/en/DSL.md)
  - [Core Model](docs/en/CORE_MODEL.md)
  - [Extensions](docs/en/EXTENSIONS.md)
  - [Components](docs/en/COMPONENTS.md)
  - [Runtime Orchestration](docs/en/RUNTIME_ORCHESTRATION.md)
  - [Implementation Status](docs/en/IMPLEMENTATION.md)
- Japanese:
  - [憲法 / Constitution](docs/ja/CONSTITUTION.md)
  - [ロードマップ / Roadmap](docs/ja/ROADMAP.md)
  - [DSL](docs/ja/DSL.md)
  - [Core Model](docs/ja/CORE_MODEL.md)
  - [Extensions](docs/ja/EXTENSIONS.md)
  - [コンポーネント / Components](docs/ja/COMPONENTS.md)
  - [ランタイム構成 / Runtime Orchestration](docs/ja/RUNTIME_ORCHESTRATION.md)
  - [実装状況 / Implementation Status](docs/ja/IMPLEMENTATION.md)

## Issues

- [Issue Index](issues/README.md)

## Testing

The runtime is plain ESM and the tests use the built-in Node test runner, so no
dependency install is needed. **Node.js >= 18 is required** (the `node --test`
flag does not exist on older releases).

```bash
node --version   # must print v18 or newer
npm test         # runs `node --test`
```

If you use `nvm`, the repo ships an `.nvmrc`:

```bash
nvm use          # selects the Node version from .nvmrc
npm test
```

You can also point at a specific interpreter without switching the default:

```bash
~/.nvm/versions/node/v22.14.0/bin/node --test
```

See [docs/en/IMPLEMENTATION.md](docs/en/IMPLEMENTATION.md) for the browser
smoke-test checklist that complements these unit tests.

## Showcase

Serve the showcase application with:

```bash
python3 scripts/serve.py
```

Then open:

```txt
http://127.0.0.1:8077/showcase/              # 運用モデル / レンダラ / geoScene / ツアー
http://127.0.0.1:8077/showcase/components.html  # createWorkbench / geoMap + fullscreen
```

スクリーンショット付きの利用ガイドは [docs/en/USING-OPADECK.md](docs/en/USING-OPADECK.md)
（画像は `node showcase/capture-screenshots.mjs` で再生成）。
