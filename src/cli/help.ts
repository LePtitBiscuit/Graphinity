// What `graphinity` prints about itself: the welcome page (no command), the general help
// (--help) and the help of each command (<command> --help). Only implemented commands and
// options are listed: keep this file in sync with COMMAND_OPTIONS in index.ts and the docs.
import { PACKAGE_NAME, VERSION } from '../core/index.ts'
import { besideLogo, docsUrl, showLogo, styles, TAGLINE, type Styles } from './brand.ts'

export const DEFAULT_PORT = 4321
export const DEFAULT_OUT = 'dist'

interface CommandHelp {
  usage: string
  summary: string
  /** Shown on the welcome page. */
  short: string
  /** Shown in the general help. */
  line: string
  arguments: [string, string][]
  options: [string, string][]
  examples: string[]
  page: string
}

const PROJECT_OPTION: [string, string] = ['    --project <dir>', "Directory referenced files must stay in (default: the file's directory)"]
const FILE_ARGUMENT: [string, string] = ['<file>', 'Root architecture file (.yml, .yaml or .json)']

export const COMMANDS: Record<string, CommandHelp> = {
  init: {
    usage: 'init [dir]',
    summary: 'Create a starter project: architecture.yml, a sub-universe in universes/, and assets/icons/ for your own logos. Existing files are never overwritten without a confirmation (or --force).',
    short: 'Initialize a new Graphinity project',
    line: 'Create a starter project (architecture.yml, universes/, assets/icons/)',
    arguments: [['[dir]', 'Project directory, created if missing (default: the current directory)']],
    options: [['    --force', 'Overwrite existing files without asking']],
    examples: [`${PACKAGE_NAME} init`, `${PACKAGE_NAME} init my-architecture`],
    page: 'cli/init',
  },
  dev: {
    usage: 'dev <file>',
    summary: 'Serve the diagram on 127.0.0.1 and reload it when files change.',
    short: 'Start the interactive diagram viewer',
    line: 'Serve the diagram on 127.0.0.1 and reload it when files change',
    arguments: [FILE_ARGUMENT],
    options: [
      ['-p, --port <n>', `Port (default ${DEFAULT_PORT}, or the next free one)`],
      ['    --no-open', 'Do not open the browser'],
      PROJECT_OPTION,
    ],
    examples: [`${PACKAGE_NAME} dev architecture.yml`, `${PACKAGE_NAME} dev architecture.yml --port 8080 --no-open`],
    page: 'cli/dev',
  },
  validate: {
    usage: 'validate <file>',
    summary: 'Check the configuration and every reference. Exits with 1 on any error: usable in CI.',
    short: 'Validate architecture configuration',
    line: 'Check the configuration and every reference',
    arguments: [FILE_ARGUMENT],
    options: [PROJECT_OPTION],
    examples: [`${PACKAGE_NAME} validate architecture.yml`],
    page: 'cli/validate',
  },
  build: {
    usage: 'build <file>',
    summary: 'Generate a static site, deployable on any static host.',
    short: 'Generate a static website',
    line: 'Generate a static site, deployable on any static host',
    arguments: [FILE_ARGUMENT],
    options: [['-o, --out <dir>', `Output directory (default ${DEFAULT_OUT})`], PROJECT_OPTION],
    examples: [`${PACKAGE_NAME} build architecture.yml`, `${PACKAGE_NAME} build architecture.yml --out site`],
    page: 'cli/build',
  },
}

const EXIT_CODES = 'Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.'

/** Words of `text` on lines of at most `width` characters. */
function wrap(text: string, width = 88): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  return line ? [...lines, line] : lines
}

function table(rows: readonly [string, string][], width: number, s: Styles, indent = '  '): string[] {
  return rows.map(([left, right]) => `${indent}${s.link(left.padEnd(width))}  ${right}`)
}

function docsLine(s: Styles, page?: string): string[] {
  const url = docsUrl(page)
  return url ? ['', `Documentation: ${s.link(url)}`] : []
}

/** A short, discreet header: name, version and tagline on one line. */
function header(s: Styles): string {
  return `${s.bold(s.gradient('Graphinity'))} ${s.dim(VERSION)} - ${TAGLINE}`
}

/** `graphinity --help`. */
export function generalHelp(stream: { isTTY?: boolean }): string {
  const s = styles(stream)
  const commands = Object.values(COMMANDS).map((c): [string, string] => [c.usage, c.line])
  return [
    header(s),
    '',
    `${s.accent('Usage:')} ${PACKAGE_NAME} <command> [options]`,
    '',
    s.accent('Commands:'),
    ...table(commands, 16, s),
    '',
    s.accent('Options:'),
    ...table(
      [
        ['-h, --help', `Show this help, or a command's: ${PACKAGE_NAME} <command> --help`],
        ['-v, --version', 'Show the version'],
      ],
      16,
      s,
    ),
    '',
    s.accent('Examples:'),
    ...[`${PACKAGE_NAME} init`, `${PACKAGE_NAME} dev architecture.yml`, `${PACKAGE_NAME} validate architecture.yml`, `${PACKAGE_NAME} build architecture.yml --out site`].map(
      (example) => `  ${example}`,
    ),
    '',
    EXIT_CODES,
    ...docsLine(s),
  ].join('\n')
}

/** `graphinity <command> --help`. */
export function commandHelp(command: string, stream: { isTTY?: boolean }): string {
  const s = styles(stream)
  const help = COMMANDS[command]!
  return [
    header(s),
    '',
    `${s.accent('Usage:')} ${PACKAGE_NAME} ${help.usage} [options]`,
    '',
    ...wrap(help.summary),
    '',
    s.accent('Arguments:'),
    ...table(help.arguments, 19, s),
    '',
    s.accent('Options:'),
    ...table([...help.options, ['-h, --help', 'Show this help']], 19, s),
    '',
    s.accent('Examples:'),
    ...help.examples.map((example) => `  ${example}`),
    '',
    EXIT_CODES,
    ...docsLine(s, help.page),
  ].join('\n')
}

/** `graphinity` alone: the logo (at a terminal), what it is, its commands and how to start. */
export function welcome(stream: { isTTY?: boolean }): string {
  const s = styles(stream)
  const intro = [s.bold(s.gradient('G R A P H I N I T Y')), TAGLINE, '', `${s.dim('Version:')} ${VERSION}`]
  const top = showLogo(stream) ? besideLogo(s, intro) : intro.map((line) => `  ${line}`.trimEnd()).join('\n')
  const url = docsUrl()
  return [
    top,
    '',
    `  ${s.accent('Commands:')}`,
    ...table(
      Object.entries(COMMANDS).map(([name, c]): [string, string] => [name, c.short]),
      9,
      s,
      '    ',
    ),
    '',
    `  ${s.accent('Get started:')}`,
    `    npx ${PACKAGE_NAME} init`,
    `    npx ${PACKAGE_NAME} dev architecture.yml`,
    '',
    `  ${s.dim(`Options and examples: ${PACKAGE_NAME} --help`)}`,
    ...(url ? ['', `  ${s.accent('Documentation:')}`, `    ${s.link(url)}`] : []),
    '',
  ].join('\n')
}
