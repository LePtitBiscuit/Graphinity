# `validate`

```sh
graphinity validate <file> [--project <dir>]
```

Loads the root universe and every file it references, checks all of them, and prints the result.
Nothing is written and no server is started.

## Valid configuration

```
$ graphinity validate architecture.yml
✓ Valid: 3 universes, 12 nodes, 8 connections
```

Exit code `0`. Warnings - named icons not found in their collection - are printed before the
summary and do not change the exit code:

```
warning architecture.yml nodes[0].icon: Icon "not-a-brand" (Simple Icons): not found. The generic icon is shown.
✓ Valid: 1 universe, 1 node, 0 connections
```

`validate` resolves icons like `build` does: icons of
[Iconify collections](/config/icons#any-iconify-collection) and
[Dashboard Icons](/config/icons#dashboard-icons) not yet in the cache are downloaded.

## Invalid configuration

```
$ graphinity validate architecture.yml
✗ 2 errors
  architecture.yml:35:12 nodes[1].group: Unknown group "partners" (declare it in "groups")
  platform/clusters/eu-west.yml:55:15 nodes[2].universe: File not found: "../services/catalgo.yml"
```

Exit code `1`. Every error has the form `file:line:column field: message`; see
[Validation and limits](/config/validation) for what is checked and
[Common errors](/cli/errors) for how to fix the usual ones.

## In continuous integration

`validate` returns a non-zero exit code on any error, so it can guard a repository:

```sh
npx graphinity validate docs/architecture/architecture.yml
```

## Options

| Option | Default | Description |
| ------ | ------- | ----------- |
| `--project <dir>` | the file's directory | [Project directory](/cli/#the-project-directory). |

## Help

`graphinity validate --help` prints:

```
Graphinity 0.1.2 - Interactive nested architecture diagrams

Usage: graphinity validate <file> [options]

Check the configuration and every reference. Exits with 1 on any error: usable in CI.

Arguments:
  <file>               Root architecture file (.yml, .yaml or .json)

Options:
      --project <dir>  Directory referenced files must stay in (default: the file's directory)
  -h, --help           Show this help

Examples:
  graphinity validate architecture.yml

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/cli/validate
```
