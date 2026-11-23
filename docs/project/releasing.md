# Building and releasing

How the npm package is built, checked and published. Releases are made by the maintainer.

## What the package contains

`pnpm build` produces:

| Directory | Content |
| --------- | ------- |
| `dist/core/` | The engine (JavaScript and type declarations), the package's main entry (`import … from 'graphinity'`). |
| `dist/cli/` | The `graphinity` command. |
| `dist/viewer/` | The precompiled viewer (HTML, JavaScript, CSS). |

The published archive contains only `dist/`, `licenses/` (icon collection licenses),
`README.md`, `LICENSE` and `package.json`. Its runtime dependencies are `yaml` and the icon
collections (`simple-icons`, `@iconify-json/devicon`, `@iconify-json/logos`,
`@iconify-json/vscode-icons`); Vue, Vite and the other build tools are development dependencies
only.

## Check the archive locally

```sh
npm pack --dry-run      # list the files that would be published
pnpm check:package      # build, pack, install with production dependencies only, run every command
```

`pnpm check:package` installs the archive into an empty temporary project
(`npm install --omit=dev`), then runs `graphinity --version`, `--help`, `validate` on a valid and
an invalid project, `build`, and `dev` (it fetches the served pages, then stops the server). It
can also check an existing archive: `node scripts/check-package.mjs graphinity-0.1.0.tgz`.

## Continuous integration

| Workflow | When | What |
| -------- | ---- | ---- |
| `ci.yml` | Every push to `main` and pull request | Type check, lint, build, unit tests on Node.js 22, 24 and 26, end-to-end tests, `npm pack`, installed-package check on Node.js 22.4, 22, 24 and 26. |
| `docs.yml` | Every push to `main` and pull request | Builds this site; deploys it to GitHub Pages from `main`. |
| `release.yml` | A pushed tag `vX.Y.Z` | Publishes to npm (below). |

## Publishing a version

Publication uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers): the
workflow authenticates to npm with a short-lived OpenID Connect token, so no npm token is stored
in the repository, and npm attaches a provenance attestation to the package.

1. Update `version` in `package.json` (for example `0.2.0`), commit and merge it into `main`.
2. Tag that commit and push the tag:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

The `release.yml` workflow then checks that the tag matches the `package.json` version and points
to a commit of `main`, runs the type check, lint, unit and end-to-end tests, packs the archive,
checks it once installed, and publishes that same archive. It never runs for pull requests or for
other tags.

## Documentation site

`pnpm docs:build` writes the site into `docs/.vitepress/dist`. `DOCS_BASE` sets the base path
when the site is not served from the root of its domain (`DOCS_BASE=/Graphinity/`); the GitHub
Pages workflow sets it from the repository's Pages settings, so a custom domain needs no change in
the code.
