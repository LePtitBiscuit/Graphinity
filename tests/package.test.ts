import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PACKAGE_NAME, VERSION } from '../src/core/index.ts'
import { project, universe } from './helpers.ts'

const cli = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** Runs the CLI from another directory, as a user would. */
function run(args: string[], cwd?: string, env: Record<string, string> = { NO_COLOR: '1' }) {
  const { NO_COLOR: _n, FORCE_COLOR: _f, ...base } = process.env
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: cwd ?? fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', env: { ...base, ...env } })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe('core', () => {
  it('exposes the package metadata', () => {
    expect(PACKAGE_NAME).toBe(pkg.name)
    expect(VERSION).toBe(pkg.version)
  })
})

// Each test runs the CLI as several processes: slower than the default timeout on a busy machine.
describe('cli', { timeout: 30_000 }, () => {
  it('prints the version, a welcome page, the help and the help of each command', () => {
    expect(run(['--version']).stdout.trim()).toBe(pkg.version)
    const welcome = run([])
    expect(welcome.code).toBe(0)
    expect(welcome.stdout).toContain('Interactive nested architecture diagrams')
    expect(welcome.stdout).toContain(`Version: ${pkg.version}`)
    for (const command of ['init', 'dev', 'build', 'validate']) expect(welcome.stdout).toMatch(new RegExp(`^ {4}${command} `, 'm'))
    expect(welcome.stdout).toContain(pkg.homepage)

    const help = run(['--help'])
    expect(help.code).toBe(0)
    expect(help.stdout).toContain(`Usage: ${pkg.name} <command> [options]`)
    expect(help.stdout).toContain('init [dir]')
    for (const [command, usage] of [['init', 'init [dir]'], ['dev', 'dev <file>'], ['validate', 'validate <file>'], ['build', 'build <file>']]) {
      const { code, stdout } = run([command!, '--help'])
      expect(code).toBe(0)
      expect(stdout).toContain(`Usage: ${pkg.name} ${usage} [options]`)
      expect(stdout).toContain(`Documentation: ${pkg.homepage}cli/${command}`)
    }
    expect(run(['init', '-h']).stdout).toContain('--force')
  })

  it('styles its output only at a terminal, or when forced, and never with NO_COLOR', () => {
    // Not a terminal (a pipe): plain text, no logo.
    const plain = run([])
    expect(plain.stdout).not.toContain('\x1b[')
    expect(plain.stdout).not.toMatch(/[\u2800-\u28ff]/)
    // FORCE_COLOR: colors and the logo (Braille characters).
    const forced = run([], undefined, { FORCE_COLOR: '1' })
    expect(forced.stdout).toContain('\x1b[')
    expect(forced.stdout).toMatch(/[\u2800-\u28ff]/)
    expect(run(['--help'], undefined, { FORCE_COLOR: '1' }).stdout).toContain('\x1b[')
    // NO_COLOR wins: the logo stays, in plain characters.
    const monochrome = run([], undefined, { FORCE_COLOR: '1', NO_COLOR: '1' })
    expect(monochrome.stdout).not.toContain('\x1b[')
    expect(monochrome.stdout).toMatch(/[\u2800-\u28ff]/)
    // validate stays compact, for logs and CI: no logo, even when forced.
    const cwd = fileURLToPath(new URL('..', import.meta.url))
    expect(run(['validate', 'examples/kestrel/architecture.yml'], cwd, { FORCE_COLOR: '1' }).stdout).not.toMatch(/[\u2800-\u28ff]/)
  })

  it('initializes a project that validates, and refuses to overwrite it without --force', async () => {
    const cwd = await project({})
    const first = run(['init'], cwd)
    expect(first.code).toBe(0)
    expect(first.stdout).toContain('✓ Graphinity project initialized successfully!')
    expect(first.stdout).toContain('Created:\n  architecture.yml\n  universes/example.yml\n  assets/icons/\n')
    expect(first.stdout).toContain(`2. Run: npx ${pkg.name} dev architecture.yml`)
    expect(run(['validate', 'architecture.yml'], cwd, { GRAPHINITY_OFFLINE: '1' }).stdout).toContain('✓ Valid: 2 universes, 6 nodes, 4 connections')

    // Not a terminal: no question, nothing written, exit code 1.
    const again = run(['init'], cwd)
    expect(again.code).toBe(1)
    expect(again.stderr).toContain('architecture.yml, universes/example.yml already exist in the current directory. Nothing was written.')
    expect(again.stderr).toContain(`${pkg.name} init --force`)
    expect(run(['init', '--force'], cwd).stdout).toContain('Overwritten:\n  architecture.yml\n  universes/example.yml\n')

    const nested = run(['init', 'docs/arch'], cwd)
    expect(nested.code).toBe(0)
    expect(nested.stdout).toContain('  docs/arch/architecture.yml')
    expect(nested.stdout).toContain(`npx ${pkg.name} dev docs/arch/architecture.yml`)
  })

  it('exits with 2 on usage errors', () => {
    for (const args of [['nope', 'a.yml'], ['--nope'], ['validate'], ['validate', 'a.yml', 'b.yml'], ['build', 'a.yml', '--port', '1'], ['dev', 'a.yml', '--port', 'x'], ['validate', 'a.yml', '--project', '/does/not/exist'], ['init', 'a', 'b'], ['init', '--out', 'x'], ['nope', '--help']]) {
      const { code, stderr } = run(args)
      expect(code, args.join(' ')).toBe(2)
      expect(stderr).toContain('--help')
    }
  })

  it('validates a project from another directory', async () => {
    const cwd = await project({})
    const arch = await project({
      'architecture.yml': universe('root', '[{ id: a, name: A, icon: github, universe: sub/a.yml }]'),
      'sub/a.yml': universe('a', '[{ id: b, name: B, icon: logos:react }, { id: c, name: C, icon: redis }]', '[{ from: b, to: c }]'),
    })
    const { code, stdout } = run(['validate', `${arch}/architecture.yml`], cwd)
    expect(code).toBe(0)
    expect(stdout).toContain('✓ Valid: 2 universes, 3 nodes, 1 connection')
  })

  it('reports invalid configurations with paths relative to the working directory', async () => {
    const cwd = await project({
      'arch/root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: missing.yml }]'),
    })
    const { code, stderr } = run(['validate', 'arch/root.yml'], cwd)
    expect(code).toBe(1)
    expect(stderr).toContain('✗ 1 error')
    expect(stderr).toContain('arch/root.yml:3:46 nodes[0].universe: File not found: "missing.yml"')
  })

  it('warns about unknown icon names without failing', async () => {
    const cwd = await project({ 'root.yml': universe('root', '[{ id: a, name: A, icon: definitely-not-a-brand }]') })
    const { code, stderr } = run(['validate', 'root.yml'], cwd)
    expect(code).toBe(0)
    expect(stderr).toContain('warning root.yml nodes[0].icon: Icon "definitely-not-a-brand" (Simple Icons): not found. The generic icon is shown.')
  })

  it('honours --project for references outside the file directory', async () => {
    const cwd = await project({
      'app/root.yml': universe('root', '[{ id: s, name: S, icon: x, universe: ../shared/s.yml }]'),
      'shared/s.yml': universe('s'),
    })
    expect(run(['validate', 'app/root.yml'], cwd).code).toBe(1)
    expect(run(['validate', 'app/root.yml', '--project', '.'], cwd).code).toBe(0)
  })
})
