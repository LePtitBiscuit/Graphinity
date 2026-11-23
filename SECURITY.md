# Security policy

## Supported versions

Graphinity is in its 0.x series: only the latest published version receives fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:
[Report a vulnerability](https://github.com/LePtitBiscuit/Graphinity/security/advisories/new)
(repository › *Security* › *Advisories*).

Include the version, the configuration files or commands that reproduce the problem, and its
impact. You will get an answer as soon as possible; once a fix is released, the advisory is
published and you are credited unless you prefer otherwise.

## Scope

Graphinity treats configuration files as untrusted input. Reports are especially welcome about:

- reading or serving files outside the project directory (paths, symbolic links);
- markup or script injection in the viewer or in generated sites (names, descriptions, SVG icons
  and images);
- the YAML/JSON parser (tags, aliases, size limits);
- the dev server (it must only answer local requests or Cloudflare quick tunnels, and only serve the viewer and the files
  referenced by the architecture);
- icon downloads at build time (allowed hosts, validation, cache).

The security measures in place are described in the README › *Security* and in the documentation.
Vulnerabilities of development-only dependencies (Vite, VitePress, Playwright…) that do not reach
the published package are handled through regular dependency updates.
