# AGENTS.md - docs (documentation site)

The official documentation, built with **VitePress 1.6** (a dev dependency; it brings its own
Vite - overridden to 6.x in `pnpm-workspace.yaml` for security fixes -, separate from the viewer's Vite).
Deployed to GitHub Pages from `main` by `.github/workflows/docs.yml`. Read the [root guide](../AGENTS.md) first.

## Layout

| Path | Content |
| ---- | ------- |
| `index.md` | Home page (hero, features, two-file example). |
| `guide/` | Introduction: what it is, installation, quick start, live demo. |
| `concepts/` | Universes, nodes, connections, sub-universes, groups and tags, file structure, layout. |
| `config/` | Reference of every configuration property, icons, colors, validation and limits, examples. |
| `cli/` | One page per command, overview (options, exit codes), common errors. |
| `guides/` | Task-oriented guides. |
| `reference/` | Engine, viewer, programmatic API, limitations. |
| `project/` | Contributing, building and releasing (CI, npm publication), license. |
| `.vitepress/config.ts` | Navigation, local search, theme options, the LLM files (`buildEnd` hook, dev middleware), and in dev the live demo served from `public/demo` on disk (`/demo/` -> `index.html`; Vite alone would answer 404, and would miss a demo rebuilt while it runs). `DOCS_BASE` sets the base path, `DOCS_URL` the absolute URL used in the LLM files (default: package.json `homepage`). |
| `.vitepress/sidebar.ts` | The pages, in reading order: the sidebar, and the pages published for LLMs. |
| `.vitepress/theme/` | Default theme + `custom.css` (brand colors from the logo: violet to pink, screenshot and demo frame styles). |
| `public/` | `logo.svg` and `favicon.svg` (generated from `brand/logo.html` by `pnpm brand`, do not edit), `images/` (screenshots of the viewer). `public/demo/` is generated, not committed. Nothing in `public/` is a page (`srcExclude`): its Markdown files (the demo's `ATTRIBUTIONS.md`) are copied as they are. |
| `scripts/check-examples.ts` | Validates every complete example of the pages with the real engine. |
| `scripts/llms.ts` | Generates `llms.txt`, `llms-full.txt` and `<page>.md` from the pages (tested in `tests/docs/llms.test.ts`). New VitePress syntax in a page (a container, a Vue snippet) must be converted there. |

## Commands

```sh
pnpm dev:docs       # live preview, also started by `pnpm dev` (alias: docs:dev; run pnpm docs:demo once for the live demo page)
pnpm docs:check     # validate every YAML/JSON example of the pages
pnpm docs:demo      # build the package, then the Kestrel Logistics demo into docs/public/demo
pnpm docs:build     # check + demo + static site into docs/.vitepress/dist (DOCS_BASE=/Graphinity/ for a sub-path)
pnpm docs:preview   # serve the built site
```

`pnpm dev:docs` also answers `*.trycloudflare.com` (Cloudflare quick tunnels): `vite.server.allowedHosts`
in `.vitepress/config.ts`, like the viewer's dev server in `vite.config.ts`.

## Rules

- **English only. Document only what is implemented**, and say plainly what is not (see
  `reference/limitations.md`). Never invent a property, option, command or message: copy messages
  from real CLI output.
- **Complete examples are fenced blocks titled with a file name** (```` ```yaml [architecture.yml] ````).
  They are validated by `pnpm docs:check`: consecutive titled blocks of a page form one project
  until a file name repeats, the first file is the root, unreached files are checked as their
  own roots, icons not found in their collection fail (icons that cannot be downloaded - Iconify
  collections, Dashboard Icons - are skipped, not failed). Check every new `prefix:name` exists on
  icon-sets.iconify.design. Use untitled blocks only for fragments.
- **Keep the site in sync with the code.** When a configuration property, a validation rule, a
  CLI option or output, a viewer interaction or the public API changes, update the matching pages
  (table below) in the same change, as well as the `README.md`.
- Links between pages are absolute (`/config/node`) and checked by `vitepress build` (dead links
  fail the build). Anchors must match real headings.
- Screenshots in `public/images/` come from the built demo (static site, served over HTTP);
  regenerate them when the viewer's look changes.

| If you change… | Update |
| -------------- | ------ |
| A configuration property | `config/<object>.md`, `config/validation.md` (limits, rules), `config/index.md` (property lists), concept pages that show it. |
| Icons, colors, styles | `config/icons.md`, `config/colors-and-styles.md`. |
| Layout or viewer behaviour | `concepts/layout.md`, `reference/viewer.md`, `guides/local-preview.md`. |
| A CLI command, option or message | `cli/*.md`, `guide/installation.md` (help output), `cli/errors.md`. |
| The public API | `reference/api.md`. |
| Something not implemented / a limit | `reference/limitations.md`. |
| The example project | `guide/demo.md`, `concepts/file-structure.md`. |
| Scripts, CI workflows, release process, supported Node.js versions | `project/contributing.md`, `project/releasing.md`, `guide/installation.md`, `CONTRIBUTING.md`. |
