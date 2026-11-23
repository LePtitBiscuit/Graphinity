# What is Graphinity?

Graphinity turns plain YAML or JSON files into **interactive, recursive architecture
diagrams**. You describe each level of a system - an organisation, a platform, a server, its
services - in its own file, and link the levels together: a node can *open* another file.

It is a single npm package that provides:

- a **configuration engine** that loads, validates and resolves the files;
- a **command line** (`graphinity`) with three commands:
  [`dev`](/cli/dev) (local preview with live reload), [`validate`](/cli/validate) and
  [`build`](/cli/build) (static site);
- a **precompiled viewer** (Vue 3, Vue Flow and ELK) that shows one universe at a time and lets
  you navigate between them.

![The Lyon hub universe of the Kestrel Logistics example: site IT, warehouse floor and packing stations in frosted groups over a floor plan](/images/lyon.png){.screenshot}

## How it works

1. **You write files.** Each file is a *universe*: nodes, connections between them, and optional
   groups. A node with a `universe` field points to another file.
2. **The engine reads everything.** Starting from one root file, it follows every reference,
   validates every file and reports all problems at once, with their location.
3. **The viewer draws each universe.** When you open a universe, it is laid out automatically
   - you never write coordinates. Double-click a node to go down a level; use the breadcrumb or
   the back button to go up.

## Principles

- **The files are the only source of truth.** The viewer never writes anything back. You can
  drag nodes to look at them, but nothing is saved: the layout always comes from the files.
- **Strict, predictable validation.** Unknown fields are errors (typos are caught), and every
  error points to a file, a line, a column and a field.
- **One universe at a time.** Large systems stay readable: each level is a small diagram.
- **Safe by default.** Configuration files are treated as untrusted data; see
  [How the engine works](/reference/engine#security).

## What it is not

- Not a diagram editor: there is no editing interface.
- Not a general-purpose drawing tool: shapes are nodes (a logo tile with a name), groups
  and connections.

See the [limitations](/reference/limitations) for what is not implemented.
