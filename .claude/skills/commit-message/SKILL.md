---
name: commit-message
description: Draft or review Graphinity Conventional Commit messages from the actual git diff, using the narrowest stable feature scope (a configuration feature, a viewer interaction, a CLI command). Use after repository modifications, when the user asks for a commit message, or when changes need logical grouping. Never run git commit unless explicitly requested.
---

# Commit Message

## Workflow

1. Read `git status` and `git diff` (staged and unstaged, plus untracked files); describe only
   changes actually present.
2. Name the exact feature changed in a short phrase, as a user of Graphinity would see it (a
   configuration field, a validation rule, a layout behaviour, a viewer interaction, a CLI
   command), before choosing the scope.
3. Convert that phrase to a concise kebab-case scope; do not substitute the folder (`core`,
   `viewer`, `cli`, `docs`) or the file (`schema`, `layout`) it lives in.
4. Decide whether the changes are independent or form one coherent feature.
5. Separate independent changes; group what implements the same feature (see *Grouping*).
6. Propose copy-ready messages. Never run `git commit`, `git push` or create a branch without an
   explicit request (`AGENTS.md`), and never push a `v*` tag: it publishes to npm.

## Format

`type(scope): description`

- Types: `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `build`, `ci`, `chore`,
  `security`, `revert`.
- English only, imperative verb, lowercase, no final period, subject under about 72 characters.
- **No em dash (U+2014)** in the subject or the body, as everywhere in the repository: use `-`.
- Prefer a subject alone. Add a body only for what the subject cannot carry (a breaking change, a
  non-obvious tradeoff, a cross-layer summary that would otherwise mislead), at most 2 short `-`
  items, not a changelog of the diff.
- Add `Refs:` or `Closes:` only when the user gives a reference.

## Scope

Choose the narrowest stable feature, whatever layer changed (engine, viewer, CLI, docs, tests).
A feature that spans `src/core/`, `viewer/`, `tests/`, `e2e/`, `docs/`, `README.md`, `AGENTS.md`
and `examples/` keeps one functional scope.

Typical feature scopes (extend the list, keep the style):

| Area | Scopes |
| ---- | ------ |
| Configuration | `connections`, `group-connections`, `connection-sides`, `cross-universe-connections`, `groups`, `tags`, `node-sizes`, `colors`, `backgrounds`, `sub-universes`, `file-paths` |
| Validation | `validation-messages`, or the scope of the feature whose rule changed (`group-connections` for a rule on connections to groups) |
| Icons | `icons`, `iconify-icons`, `dashboard-icons`, `simple-icons`, `local-icons`, `icon-cache`, `offline-build` |
| Layout and routing | `auto-layout`, `edge-routing`, `edge-labels`, `group-layout`, `node-dragging` |
| Viewer | `navigation`, `portals`, `node-details`, `explorer`, `config-errors`, `canvas-gestures`, `theme` |
| CLI | `cli-init`, `cli-dev`, `cli-validate`, `cli-build`, `welcome-page`, `cli-help`, `live-reload` |
| Public API | `api` (only for `src/core/index.ts` exports themselves) |
| Content | `kestrel-example` (example-only changes), the page topic for docs-only changes (`docs(static-hosting)`, `docs(llms)`) |

Rules:

- Before returning a message, compare the scope with the phrase from step 2. If it could
  describe unrelated features (`viewer`, `core`, `layout`), narrow it.
- Horizontal scopes only for genuinely horizontal work: `deps` (dependency updates), `ci`
  (`.github/workflows`), `release` (version bump, changelog), `package` (package contents,
  `exports`, `files`, `engines`, `scripts/check-package.mjs`), `brand` (logo and generated
  files), `e2e` (Playwright setup, not a test of one feature), `agents` (`AGENTS.md`/`CLAUDE.md`
  guides only), `repo` as a last resort.
- Do not use `docs` as a scope: a docs-only commit is `docs(<topic>)`.

## Grouping

- **Documentation goes with its feature.** `AGENTS.md` requires every user-visible change to
  update `docs/`, `README.md` and the relevant `AGENTS.md` in the same change: keep them in the
  feature commit, never in a separate `docs:` commit. Same for its unit tests, e2e tests and the
  example files that show the feature.
- A `docs(...)` commit is only for documentation that changes no behaviour (a fix, a new guide).
- Split a refactoring from a behaviour change when the diff mixes them (`CONTRIBUTING.md`: one
  change per pull request).
- Split example edits that do not illustrate the feature of the commit
  (`feat(kestrel-example): ...` or `chore(kestrel-example): ...`).
- Do not create artificial technical commits (`feat(core)` + `feat(viewer)` + `docs`) for one
  feature.
- `pnpm-lock.yaml`: include it only with a `package.json` change. A lockfile change with no
  dependency change (a `pnpm install` artefact) is not part of any commit: point it out instead.
- Never include `.claude/settings.local.json`, `.env*`, `.npmrc`, keys, `dist/` or
  `docs/public/demo/`.

## Type

- `feat`: a new configuration field or value, a new viewer interaction, a new CLI option.
- `fix`: wrong behaviour, a misleading error message, a layout or routing defect.
- `perf`: layout, routing or build speed, without changing the result.
- `security`: the rules of `docs/reference/engine.md` › *Security* (untrusted configuration, file access,
  icon downloads, markup injection).
- `style`: visual changes of the viewer without new behaviour (spacing, colors of the UI);
  not code formatting alone, which is `chore`.
- `build`: the build of the package (`dist/core`, `dist/cli`, `dist/viewer`), Vite, TypeScript
  configuration.
- Breaking changes: a configuration file valid before is now rejected or drawn differently, a
  field is renamed or removed, a CLI option or exit code changes, an export of the public API
  changes. Mark the type with `!` and add a `BREAKING CHANGE:` paragraph saying what users must
  change in their files.

## Examples

- `feat(group-connections): connect nodes and groups to group frames`
- `fix(edge-routing): keep the configured side of a group end`
- `fix(validation-messages): name the group in unknown end errors`
- `feat(cli-dev): reload the viewer when an included file changes`
- `docs(static-hosting): add a Cloudflare Pages example`
- `chore(release): prepare v0.1.2`
- `build(deps): update elkjs to 0.12.2`

```text
feat(group-connections)!: resolve plain ids to nodes before groups

BREAKING CHANGE: a connection to a group that shares an id with a node now targets the node;
write `{ group: <id> }` to keep the group.
```
