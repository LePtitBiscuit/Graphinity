# Build and host a static site

## Build

```sh
npx graphinity build architecture.yml
```

```
✓ Built 3 universes, 12 nodes, 8 connections → dist/ (10 files)
  Serve it with any static HTTP server, e.g. npx serve dist
```

`dist/` contains everything: the viewer, `architecture.json` (every universe, validated and
resolved, with the logos used), the icons of the collections used in `icons/` (with their
attributions and licenses - keep them when you publish) and your local images in `files/`. No
backend, no database, no network access at runtime.

Choose another directory with `--out`:

```sh
npx graphinity build architecture.yml --out public/architecture
```

## Try it locally

The site must be served over HTTP - opening `index.html` directly (`file://`) does not work.
Any static server will do:

```sh
npx serve dist
```

## Host it

Upload the directory to any static host - GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket,
nginx… It works from the root of a domain or from any sub-path
(`https://example.com/docs/architecture/`): all its URLs are relative.

Links to a level work too: `https://example.com/architecture/#/platform/server` opens that
universe directly.

### Example: GitHub Pages with GitHub Actions

```yaml
# .github/workflows/architecture.yml
name: Architecture diagram
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx graphinity build architecture.yml --out site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - uses: actions/deploy-pages@v4
```

This assumes `graphinity` is a dev dependency of the repository
(see [Installation](/guide/installation)).

## Rebuilding

Run `build` again whenever the files change: the output directory is replaced. It is only ever
emptied if a previous build created it - see [`build`](/cli/build#the-output-directory-is-protected).
