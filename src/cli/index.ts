#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { PACKAGE_NAME, VERSION } from '../core/index.ts'
import { buildSite } from './build.ts'
import { startDevServer } from './dev.ts'
import { besideLogo, docsUrl, showLogo, styles } from './brand.ts'
import { commandHelp, DEFAULT_OUT, DEFAULT_PORT, generalHelp, welcome } from './help.ts'
import { initProject } from './init.ts'
import { dim, green, info, printErrors, printWarnings, red, warn } from './output.ts'
import { summary, viewerDir } from './site.ts'
import { validate } from './validate.ts'

const COMMAND_OPTIONS: Record<string, string[]> = {
  init: ['force'],
  dev: ['port', 'open', 'project'],
  validate: ['project'],
  build: ['out', 'project'],
}

class UsageError extends Error {}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      port: { type: 'string', short: 'p' },
      open: { type: 'boolean' },
      out: { type: 'string', short: 'o' },
      project: { type: 'string' },
      force: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })

  if (values.version) {
    info(VERSION)
    return 0
  }
  const [command, file, ...extra] = positionals
  if (command === undefined) {
    info(values.help ? generalHelp(process.stdout) : welcome(process.stdout))
    return 0
  }
  const allowed = COMMAND_OPTIONS[command]
  if (!allowed) throw new UsageError(`Unknown command "${command}".`)
  if (values.help) {
    info(commandHelp(command, process.stdout))
    return 0
  }
  for (const option of Object.keys(values)) {
    if (!allowed.includes(option)) throw new UsageError(`--${option === 'open' ? 'no-open' : option} does not apply to "${command}".`)
  }
  if (extra.length > 0) throw new UsageError(`Unexpected argument "${extra[0]}".`)
  if (command === 'init') return init(file ?? '.', values.force ?? false)
  if (file === undefined) throw new UsageError(`Missing the architecture file: ${PACKAGE_NAME} ${command} <file>`)

  const rootFile = path.resolve(file)
  const projectRoot = await projectDirectory(values.project ?? path.dirname(rootFile))

  switch (command) {
    case 'validate':
      return validate(rootFile, projectRoot)
    case 'build':
      return build(rootFile, projectRoot, values.out ?? DEFAULT_OUT)
    default:
      return dev(rootFile, projectRoot, values.port, values.open ?? true)
  }
}

/**
 * `init [dir]`: at a terminal, the logo, a question before overwriting anything, and the next
 * steps. Elsewhere (CI, pipes), plain lines, and existing files are never overwritten without
 * --force: the command fails instead.
 */
async function init(dir: string, force: boolean): Promise<number> {
  const s = styles(process.stdout)
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  if (showLogo(process.stdout)) info(`\n${besideLogo(s, [s.bold(s.gradient('G R A P H I N I T Y')), 'Initializing a new project...'])}\n`)

  const target = path.resolve(dir)
  const shown = path.relative(process.cwd(), target) || '.'
  const where = shown === '.' ? 'in the current directory' : `in ${shown}`
  const result = await initProject({
    dir: target,
    force,
    ...(interactive && {
      confirm: async (existing: string[]) => {
        const { createInterface } = await import('node:readline/promises')
        const prompt = createInterface({ input: process.stdin, output: process.stdout })
        try {
          const answer = await prompt.question(`${s.yellow('?')} ${existing.join(', ')} already ${existing.length === 1 ? 'exists' : 'exist'} ${where}. Overwrite? (y/N) `)
          return /^y(es)?$/i.test(answer.trim())
        } finally {
          prompt.close()
        }
      },
    }),
  })
  if (!result.ok) {
    const what = result.existing.join(', ')
    process.stderr.write(
      result.declined
        ? `${red('✗')} Nothing was written: ${what} kept as ${result.existing.length === 1 ? 'it is' : 'they are'}.\n`
        : `${red('✗')} ${what} already ${result.existing.length === 1 ? 'exists' : 'exist'} ${where}. Nothing was written.\n  Run "${PACKAGE_NAME} init --force" to overwrite, or choose another directory: ${PACKAGE_NAME} init <dir>\n`,
    )
    return 1
  }

  const prefix = shown === '.' ? '' : `${shown.split(path.sep).join('/')}/`
  info(`${s.green('✓')} Graphinity project initialized successfully!`)
  info('')
  if (result.created.length > 0) {
    info(s.accent('Created:'))
    for (const file of result.created) info(`  ${prefix}${file}`)
  }
  if (result.overwritten.length > 0) {
    info(s.accent('Overwritten:'))
    for (const file of result.overwritten) info(`  ${prefix}${file}`)
  }
  const docs = docsUrl()
  info('')
  info(s.accent('Next steps:'))
  info('')
  info(`  1. Edit ${s.link(`${prefix}architecture.yml`)} to define your nodes.`)
  info(`  2. Run: ${s.link(`npx ${PACKAGE_NAME} dev ${prefix}architecture.yml`)}`)
  if (docs) {
    info('  3. Read the documentation:')
    info(`     ${s.link(docs)}`)
  }
  return 0
}

async function projectDirectory(dir: string): Promise<string> {
  try {
    return await realpath(dir)
  } catch {
    throw new UsageError(`Project directory not found: ${dir}`)
  }
}

async function build(file: string, projectRoot: string, out: string): Promise<number> {
  const result = await buildSite({ file, projectRoot, outDir: out, viewerDir: viewerDir() })
  if (!result.ok) {
    if ('refused' in result) process.stderr.write(`${red('✗')} ${result.refused}\n`)
    else printErrors(result.errors, projectRoot)
    return 1
  }
  printWarnings(result.bundle.warnings, projectRoot)
  const shown = path.relative(process.cwd(), result.outDir) || '.'
  info(`${green('✓')} Built ${summary(result.bundle.data.architecture)} → ${shown}/ (${result.files} files)`)
  info(dim(`  Serve it with any static HTTP server, e.g. npx serve ${shown}`))
  return 0
}

async function dev(file: string, projectRoot: string, portOption: string | undefined, open: boolean): Promise<number> {
  const port = portOption === undefined ? DEFAULT_PORT : Number(portOption)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`Invalid port "${portOption}".`)

  const server = await startDevServer({
    file,
    projectRoot,
    viewerDir: viewerDir(),
    port,
    portAttempts: portOption === undefined ? 10 : 1,
    log: {
      info: (line) => info(`${dim(time())} ${line.startsWith('✓') ? green('✓') + line.slice(1) : line}`),
      warn: (line) => warn(line),
      warnings: (warnings) => printWarnings(warnings, projectRoot),
      errors: (errors) => {
        process.stderr.write(`${dim(time())} `)
        printErrors(errors, projectRoot)
      },
    },
  })
  const s = styles(process.stdout)
  info(`\n  ${s.bold(s.gradient('Graphinity'))} ${dim(VERSION)}  ${green(server.url)}`)
  info(dim(`  Watching ${path.relative(process.cwd(), file) || file} and the files it references. Ctrl+C to stop.\n`))
  if (open) openBrowser(server.url)

  await new Promise<void>((resolve) => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  await server.close()
  return 0
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]]
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.on('error', () => info(dim(`  Open ${url} in your browser.`)))
    child.unref()
  } catch {
    info(dim(`  Open ${url} in your browser.`))
  }
}

function time(): string {
  return new Date().toLocaleTimeString()
}

// Output cut short (`graphinity --help | head`): stop quietly.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0)
  throw error
})

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
      process.stderr.write(`${red('✗')} ${(error as Error).message}\n  Run "${PACKAGE_NAME} --help" for usage.\n`)
      process.exitCode = 2
    } else {
      process.stderr.write(`${red('✗')} ${(error as Error).message}\n`)
      process.exitCode = 1
    }
  },
)
