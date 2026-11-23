# Documentation for LLMs

The documentation is also published in plain Markdown, for language models and AI assistants: an
index, the whole documentation in one file, and every page on its own.

## The files

| URL | Content |
| --- | ------- |
| `/llms.txt` | An index of every page, by section, with a one-line summary and a link to its Markdown version ([llms.txt format](https://llmstxt.org)). |
| `/llms-full.txt` | The whole documentation in one Markdown file, in reading order. Each page starts with a `Source:` line giving its URL. |
| `/<page>.md` | One page in Markdown, next to its HTML page: `/config/node.md` for `/config/node`, `/cli/index.md` for `/cli/`. |

Give an assistant the address of `llms.txt` and it can find the page it needs, or give it
`llms-full.txt` to read everything at once.

## On every page

Above the content of each documentation page:

- **Copy page** copies the Markdown of the page to the clipboard.
- **View as Markdown** opens the Markdown of the page in a new tab.
- **Copy all documentation** copies `llms-full.txt` to the clipboard.
- **Download documentation** saves `llms-full.txt` as `graphinity-documentation.md`.

Copying needs a browser that allows the site to write to the clipboard (any site served over
HTTPS or from `localhost`); when it is refused, the message says so and the Markdown can be opened
and copied by hand.

## What the Markdown contains

The files are generated from the Markdown sources of the site on every build, so they always
match the pages:

- Headings, tables, lists and code blocks are kept as they are. A code block titled with a file
  name (`architecture.yml`) is preceded by that name in bold.
- Notes and warnings become quotes, starting with their title in bold.
- Links and images point to absolute URLs of the published site (`/config/node#fields` becomes
  `https://<site>/config/node#fields`), so they work wherever the text is pasted.
- The home page's title, tagline and features are written as text; the live demo is a link.

Only the pages of the navigation and the home page are published. Files for contributors, the
scripts of the site and generated files (the demo) are never included.
