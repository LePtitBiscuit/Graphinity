# `dev`

```sh
graphinity dev <file> [--port <n>] [--no-open] [--project <dir>]
```

Starts a local server, opens the diagram in your browser, and reloads it every time a file
changes.

```sh
npx graphinity dev architecture.yml
```

```
10:42:07 ✓ 3 universes, 12 nodes, 8 connections

  Graphinity 0.1.2  http://127.0.0.1:4321/
  Watching architecture.yml and the files it references. Ctrl+C to stop.
```

## Options

| Option | Default | Description |
| ------ | ------- | ----------- |
| `-p, --port <n>` | `4321` | Port. Without this option, if 4321 is taken, the next free port (up to 4330) is used. With it, a taken port is an error: `Port 8080 is already in use. Choose another one with --port.` `0` picks any free port. |
| `--no-open` | | Do not open the browser (useful on a remote machine, or in scripts). |
| `--project <dir>` | the file's directory | [Project directory](/cli/#the-project-directory). |

## Live reload

- The server watches the directories of the root file and of every file it reads (universes and
  local icons). Saving a `.yml`, `.yaml`, `.json` or image file there reloads the data - also
  when an editor saves by replacing the file, and when a missing sub-universe is created.
- Open pages update by themselves and keep your position: the same universe, zoom and pan.
- Each reload prints a summary line, or the errors.
- Icons added to a file are resolved on save - downloaded if they are not in the cache - and
  appear in the open page; icons already used are not downloaded again.

## Errors do not stop the server

When files have errors, the terminal lists them:

```
10:43:15 ✗ 1 error
  warehouses/lyon.yml:77:12 connections[1].style: "style" must be one of solid, dashed, dotted, got "wavy"
```

and the page **still shows the diagram**, without the elements concerned - here, that
connection - and with a *N configuration errors* button that lists them. Each error only leaves
out the element it concerns: see [When there are errors](/config/validation#when-there-are-errors).
Only when the root file itself cannot be read are the errors shown instead of the diagram.

Fix the file and save: the element comes back.

## Security

- The server listens on `127.0.0.1` only: it is not reachable from other machines.
- It only answers requests addressed to it - `127.0.0.1:<port>`, `localhost:<port>`, or a
  Cloudflare quick tunnel (`<name>.trycloudflare.com`) - as a protection against DNS rebinding,
  and only `GET` and `HEAD`.
- It serves the viewer and the files referenced by the architecture - nothing else from your
  disk.

## Showing it through a Cloudflare tunnel

To show a diagram to someone else while you edit it, open a
[Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
to the dev server (`cloudflared` must be installed):

```sh
graphinity dev architecture.yml --port 4321 --no-open
cloudflared tunnel --url http://127.0.0.1:4321
```

`cloudflared` prints a `https://<name>.trycloudflare.com` address: anyone who has it sees the
diagram, with live reload. Only quick tunnels are accepted (`*.trycloudflare.com`); a tunnel on
your own domain is refused. Anyone with the address can read the diagram: stop `cloudflared`
when you are done. To publish it for good, [build a static site](/cli/build).

Stop it with `Ctrl+C`.

## Help

`graphinity dev --help` prints:

```
Graphinity 0.1.2 - Interactive nested architecture diagrams

Usage: graphinity dev <file> [options]

Serve the diagram on 127.0.0.1 and reload it when files change.

Arguments:
  <file>               Root architecture file (.yml, .yaml or .json)

Options:
  -p, --port <n>       Port (default 4321, or the next free one)
      --no-open        Do not open the browser
      --project <dir>  Directory referenced files must stay in (default: the file's directory)
  -h, --help           Show this help

Examples:
  graphinity dev architecture.yml
  graphinity dev architecture.yml --port 8080 --no-open

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/cli/dev
```
