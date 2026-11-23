# Icons

The `icon` of a [node](/config/node) (required) or a [group](/config/group) (optional) is a
**named icon** - from **any of the 200+ [Iconify](https://icon-sets.iconify.design) collections**,
or from Dashboard Icons - or a **local image** of your project.

![One node per icon collection: Simple Icons, Devicon, SVG Logos, VSCode Icons, Dashboard Icons, a local SVG, and the generic icon for a missing reference](/images/icon-collections.png){.screenshot}

## Syntax

| `icon` value | Example | Collection |
| ------------ | ------- | ---------- |
| `name` | `github` | [Simple Icons](#simple-icons) |
| `prefix:name` | `mdi:database`, `lucide:network`, `tabler:server` | [any Iconify collection](#any-iconify-collection) |
| `simple-icons:name` | `simple-icons:cloudflare` | [Simple Icons](#simple-icons) (bundled) |
| `devicon:name` | `devicon:docker` | [Devicon](#devicon) (bundled) |
| `logos:name` | `logos:kubernetes` | [SVG Logos](#svg-logos) (bundled) |
| `vscode-icons:name` | `vscode-icons:file-type-docker` | [VSCode Icons](#vscode-icons) (bundled) |
| `dashboard:name` | `dashboard:jellyfin` | [Dashboard Icons](#dashboard-icons) |
| relative path to an image | `./icons/billing.svg` | [Local images](#local-images) |

- A value ending in `.svg`, `.png`, `.webp`, `.jpg` or `.jpeg` is a local image; anything else
  is a named icon.
- The prefix is the collection's prefix on [icon-sets.iconify.design](https://icon-sets.iconify.design),
  the name the part after it: `mdi:database`, `carbon:cloud-services`, `fa6-brands:docker`.
- Prefixes and names are case-insensitive (`Logos:React` works). They are lowercase letters and
  digits separated by single hyphens; anything else is an error:

  ```
  architecture.yml:6:11 nodes[0].icon: Invalid icon "my_set:react": "my_set" is not a collection prefix (lowercase letters, digits and single hyphens, e.g. "mdi", "simple-icons")
  ```

- An **icon that is not found** - or a collection that does not exist, or a download that
  failed - is not an error: the node shows a generic icon, and `validate`, `dev` and `build`
  print a warning:

  ```
  warning ok.yml nodes[0].icon: Icon "mdi:databse" (Iconify mdi): not found. The generic icon is shown.
  warning ok.yml nodes[1].icon: Icon "logo:react" (Iconify logo): no Iconify collection is named "logo" (see https://icon-sets.iconify.design). The generic icon is shown.
  ```

## Example

```yaml [architecture.yml]
id: homelab
name: Homelab
groups:
  - id: server
    name: Proxmox
    icon: dashboard:proxmox
  - id: data
    name: Data
    icon: mdi:database                   # Material Design Icons (Iconify)
nodes:
  - id: code
    name: GitHub
    icon: github                         # Simple Icons
  - id: app
    name: Web app
    icon: devicon:react                  # Devicon
  - id: lb
    name: Load balancer
    icon: tabler:arrows-split            # Tabler Icons (Iconify)
  - id: db
    name: Database
    icon: lucide:database                # Lucide (Iconify)
    group: data
  - id: cache
    name: Cache
    icon: carbon:data-base-alt           # Carbon (Iconify)
    group: data
  - id: cluster
    name: Cluster
    icon: logos:kubernetes               # SVG Logos
  - id: images
    name: Images
    icon: vscode-icons:file-type-docker  # VSCode Icons
  - id: media
    name: Jellyfin
    icon: dashboard:jellyfin             # Dashboard Icons
    group: server
  - id: home
    name: Home Assistant
    icon: dashboard:home-assistant
    group: server
  - id: billing
    name: Billing
    icon: ./icons/billing.svg            # local image
connections:
  - from: code
    to: app
  - from: app
    to: cluster
  - from: cluster
    to: images
  - from: images
    to: media
  - from: app
    to: lb
  - from: lb
    to: db
  - from: db
    to: cache
```

## Any Iconify collection

[Iconify](https://iconify.design) gathers more than 200 open source icon collections - generic
icons as well as logos - under one naming scheme. **Any of them can be used**, without installing
anything: write the collection's prefix and the icon's name.

| Kind | Examples |
| ---- | -------- |
| Generic, technical | `mdi:database`, `mdi:server-network`, `lucide:network`, `lucide:hard-drive`, `tabler:server`, `tabler:cloud-computing`, `carbon:kubernetes`, `ph:cloud-arrow-up-bold`, `material-symbols:storage` |
| Logos of services | `simple-icons:cloudflare`, `devicon:docker`, `logos:aws`, `fa6-brands:docker`, `skill-icons:postgresql-dark`, `devicon-plain:nginx` |
| Files and folders | `vscode-icons:file-type-yaml`, `material-icon-theme:docker` |

Find icons on [icon-sets.iconify.design](https://icon-sets.iconify.design): search, open an
icon, and copy its name (`mdi:database`).

How it works:

- **Four collections are bundled** in the package and need no network: Simple Icons, Devicon,
  SVG Logos and VSCode Icons (from their npm packages). Dashboard Icons has its own
  [download](#dashboard-icons). The prefixes `simple-icons`, `devicon`, `logos`, `vscode-icons`
  and `dashboard` always use them.
- **Every other prefix is downloaded from the official Iconify API** when the diagram is built
  (`validate`, `dev`, `build`) - never when the site is viewed:
  - only the icons your files reference are downloaded, never whole collections, grouped by
    collection (up to 32 icons per request);
  - only from the official API hosts - `api.iconify.design`, and its official mirrors
    `api.simplesvg.com` and `api.unisvg.com` when it does not answer; nothing else;
  - only icon data (JSON), checked field by field, turned into an SVG document and
    [validated](#svg-validation) before use;
  - with a 10 s timeout per request, and at most 4 requests at a time;
  - the collection's name, author and license are downloaded too, to [credit it](#licenses-and-redistribution).
- Downloaded icons are kept in a **cache**, `$XDG_CACHE_HOME/graphinity/iconify/`
  (by default `~/.cache/graphinity/iconify/`): an icon is downloaded once, and later
  builds that use only cached icons make **no request at all** - they work offline.
- In [`dev`](/cli/dev), icons you add to a file are downloaded when you save it, and appear in
  the open page; icons already used come from memory.
- Without network and without a cached copy, the icon is replaced with the generic icon and a
  warning is printed - the build itself succeeds:

  ```
  warning ok.yml nodes[0].icon: Icon "mdi:database" (Iconify mdi): download failed (fetch failed (ENOTFOUND); check your network connection). The generic icon is shown.
  ```

  A failed download is retried on the next build (in `dev`, after 30 seconds).

### Working offline

Set `GRAPHINITY_OFFLINE=1` to forbid every download (Iconify and Dashboard Icons):
icons come from the cache only, and icons not in the cache are shown with the generic icon, with
a warning. Useful in CI with a cached directory, or on an air-gapped machine:

```sh
GRAPHINITY_OFFLINE=1 npx graphinity build architecture.yml
```

To refresh downloaded icons, delete the cache directory: they are downloaded again on the next
build.

::: tip Privacy
The downloads reveal the names of the icons you use to the Iconify API (and, for `dashboard:`
icons, to jsDelivr). Nothing else is sent: no file content, no node names. Use only the bundled
collections - or `GRAPHINITY_OFFLINE=1` - to make no request at all.
:::

## Bundled collections

| Prefix | Collection | Icons | License | Shipped as |
| ------ | ---------- | ----- | ------- | ---------- |
| *(none)*, `simple-icons` | [Simple Icons](https://simpleicons.org) | brand logos, single color | CC0-1.0 | npm package `simple-icons` (bundled) |
| `devicon` | [Devicon](https://github.com/devicons/devicon) | programming languages and tools | MIT | npm package `@iconify-json/devicon` (bundled) |
| `logos` | [SVG Logos](https://github.com/gilbarbara/logos) | company and product logos, in color | CC0-1.0 | npm package `@iconify-json/logos` (bundled) |
| `vscode-icons` | [VSCode Icons](https://github.com/vscode-icons/vscode-icons) | file types and folders | MIT | npm package `@iconify-json/vscode-icons` (bundled) |
| `dashboard` | [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons) | self-hosted services and applications | Apache-2.0 | downloaded when the diagram is built ([details](#dashboard-icons)) |

Devicon, SVG Logos and VSCode Icons are the [Iconify](https://iconify.design) packages of these
collections, bundled so that the most common logos need no network. Browse them on
[icon-sets.iconify.design](https://icon-sets.iconify.design) too: the name is the part after the
prefix (`logos:kubernetes` → `kubernetes`).

### Simple Icons

The default collection: a name without prefix is a Simple Icons name. The name is the icon's
**slug** on [simpleicons.org](https://simpleicons.org): lowercase letters and digits, with `.`
written `dot` and `+` written `plus` - `nodedotjs`, `vuedotjs`, `nextdotjs`, `githubactions`,
`googlecloud`, `cplusplus`.

Simple Icons logos are single-color: they are drawn in their **brand color**, and colors too
dark to read on the dark canvas (such as GitHub's) are replaced with a light gray.

Common slugs: `docker`, `kubernetes`, `nginx`, `nodedotjs`, `python`, `go`, `react`, `vuedotjs`,
`nextdotjs`, `postgresql`, `redis`, `mongodb`, `github`, `githubactions`, `cloudflare`, `vercel`,
`stripe`, `grafana`, `ubuntu`.

::: warning Not every brand is in Simple Icons
Some brands are absent from Simple Icons - for example the AWS logos (`amazonwebservices`,
`amazons3` and `awslambda` do not exist). Try [SVG Logos](#svg-logos), or use a
[local image](#local-images).
:::

### Devicon

Logos of programming languages, frameworks and tools: `devicon:react`, `devicon:python`,
`devicon:docker`, `devicon:postgresql`. Names are lowercase, with hyphens. Icons are drawn in
their own colors.

### SVG Logos

Company and product logos in color: `logos:kubernetes`, `logos:vue`, `logos:aws`,
`logos:postgresql`, `logos:redis`. Many logos also exist as a square icon variant, named
`<name>-icon` (`logos:docker-icon`).

### VSCode Icons

The file and folder icons of the VS Code extension: `vscode-icons:file-type-docker`,
`vscode-icons:file-type-yaml`, `vscode-icons:default-folder`. Useful for configuration files,
scripts and data.

### Dashboard Icons

Logos of self-hosted services and applications (Jellyfin, Home Assistant, Proxmox, Nextcloud…):
`dashboard:jellyfin`, `dashboard:home-assistant`, `dashboard:proxmox`. Names are lowercase with
hyphens; many icons have a `-light` variant for dark backgrounds (`dashboard:github-light`).

Dashboard Icons has no npm package, so its icons are **downloaded when a diagram is built**
(`validate`, `dev`, `build`):

- from the project's own repository, through jsDelivr, **pinned to one commit**
  (`homarr-labs/dashboard-icons@d4b500dc40a8e1043b1581cabb7208892cf35472`), so builds are
  reproducible;
- only SVG data is downloaded, and every file is [validated](#svg-validation) before use;
- downloaded icons are kept in a cache, `$XDG_CACHE_HOME/graphinity/dashboard-icons/`
  (by default `~/.cache/graphinity/dashboard-icons/`): later builds work offline;
- without network and without a cached copy, the icon is replaced with the generic icon and a
  warning is printed - the build itself succeeds:

  ```
  warning ok.yml nodes[1].icon: Icon "dashboard:jellyfin" (Dashboard Icons): download failed (getaddrinfo ENOTFOUND cdn.jsdelivr.net); check your network connection. The generic icon is shown.
  ```

They only happen when a diagram uses `dashboard:` icons, and follow the same rules as Iconify
downloads: build time only, cache, timeout, `GRAPHINITY_OFFLINE`.

## Local images

A **relative path** to an image file of the project:

```yaml
icon: ./icons/billing.svg
```

- Formats: `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`.
- The path is relative to the file that contains it and must stay inside the project directory.
  A missing file is an error (`File not found: "./icons/billing.svg"`).
- SVG files are [validated](#svg-validation): an unsafe SVG is an error (and, in `dev`, the
  node shows the generic icon).

  ```
  architecture.yml:9:11 nodes[1].icon: Invalid SVG "./icons/unsafe.svg": it contains a script
  ```

- Prefer **SVG**, which stays sharp at every zoom level. For other formats, use a square image of
  at least 96 × 96 px; non-square images are fitted, never stretched.
- `build` copies local images unchanged to `files/` in the site.

## How icons reach the viewer

Icons are resolved **when the diagram is built**, never in the browser:

- each distinct reference is resolved once, even when many nodes use it;
- only the icons used are included - never whole collections;
- Simple Icons logos are stored as path data in `architecture.json`;
- icons of the other collections - bundled or downloaded - are written as SVG files,
  `icons/<hash>.svg`, named after their content: identical icons (for example an alias and its
  target) share one file;
- the viewer displays them through `<img>` elements, from the site itself: a built site works
  **offline**, and SVG scripts never run.

Single-color icons of Iconify collections (`mdi`, `lucide`, `tabler`…) are drawn in light gray.
Images are drawn at 30 × 30 px in `medium` tiles (22 and 44 px in `small` and `large` ones) and
16 × 16 px in group titles. Multi-color logos are
drawn as designed: logos with black or dark parts are less visible on the dark canvas - prefer a
light variant when the collection has one.

## SVG validation

Every SVG - local files, downloaded icons, icons of the bundled collections - must be a
standalone SVG document of at most 512 KB, and must not contain anything that could run code or
load a resource from elsewhere. Refused:

- `<script>`, `<foreignObject>` and HTML elements (`<iframe>`, `<object>`, `<embed>`…);
- event handler attributes (`onload`, `onclick`…), `javascript:` URLs;
- links and references to other files or sites (`href`, `xlink:href`, `url(…)`) - only links
  inside the document (`#id`) are allowed;
- `@import`, CSS expressions, `<set>` and link animations;
- entity declarations and internal DOCTYPE subsets.

## Licenses and redistribution

Every built site that uses named icons contains `icons/ATTRIBUTIONS.md`, crediting each
collection it uses - name, author, source, license and a link to the license - and, for the
bundled collections, the license texts that redistribution requires, in `icons/licenses/`.
**Keep these files when you publish the site.**

```md [icons/ATTRIBUTIONS.md]
- **Material Design Icons** by Pictogrammers - https://github.com/Templarian/MaterialDesign
  License: Apache-2.0 (https://github.com/Templarian/MaterialDesign/blob/master/LICENSE)
  Keep this notice, and the license terms linked above, with the icons.
```

Iconify collections have their own licenses (MIT, Apache-2.0, ISC, CC-BY-4.0, OFL-1.1…), shown
for each collection on [icon-sets.iconify.design](https://icon-sets.iconify.design). The credits
are taken from the Iconify API. When a collection's license may restrict publishing (GPL,
share-alike or non-commercial licenses, or a license that could not be downloaded), a warning
asks you to check its terms:

```
warning ok.yml nodes[0].icon: Icon collection "Some set" is licensed under GPL-3.0 (https://…): check that its terms allow your use before publishing the site.
```

The bundled collections:

| Collection | License | When redistributing icons |
| ---------- | ------- | ------------------------- |
| Simple Icons | [CC0-1.0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md) | No condition on the icon data. |
| SVG Logos | [CC0-1.0](https://raw.githubusercontent.com/gilbarbara/logos/master/LICENSE.txt) | No condition on the icon data. |
| Devicon | [MIT](https://github.com/devicons/devicon/blob/master/LICENSE) | Include the copyright and permission notice - done automatically (`icons/licenses/devicon.txt`). |
| VSCode Icons | [MIT](https://github.com/vscode-icons/vscode-icons/blob/master/LICENSE) | Include the copyright and permission notice - done automatically (`icons/licenses/vscode-icons.txt`). |
| Dashboard Icons | [Apache-2.0](https://github.com/homarr-labs/dashboard-icons/blob/d4b500dc40a8e1043b1581cabb7208892cf35472/LICENSE) | Give a copy of the license and keep the notices - done automatically (`icons/licenses/dashboard-icons.txt`). |

::: warning Logos are trademarks
Whatever the license of a collection, the logos it contains remain trademarks of their owners.
Using them to identify a product or service is common practice, but brands may have usage
guidelines; the licenses above do not grant trademark rights. This documentation is not legal
advice.
:::

## Adding a collection

Collections are implemented as icon providers with a common interface; the universal Iconify
provider handles every prefix without a provider of its own. See
[Programmatic API](/reference/api#icon-providers).
