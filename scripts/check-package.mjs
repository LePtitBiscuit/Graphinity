// Installs a packed graphinity archive into an empty project, with production dependencies only,
// and runs the installed `graphinity` command as a user would: --version, --help, the welcome page,
// init, validate (valid and invalid), build, and dev (served pages, then Ctrl+C).
//
//   node scripts/check-package.mjs [graphinity-x.y.z.tgz]
//
// Without an argument the archive is built first (`npm pack`, which runs the build). Plain
// JavaScript, not TypeScript: CI runs it on the oldest supported Node.js, which cannot strip types.
// Needs network access to install the runtime dependencies from the npm registry; icons are taken
// from the bundled collections only (GRAPHINITY_OFFLINE).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('..', import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'))
const work = mkdtempSync(path.join(tmpdir(), 'graphinity-package-'))
const env = { ...process.env, NO_COLOR: '1', GRAPHINITY_OFFLINE: '1', XDG_CACHE_HOME: path.join(work, 'cache') }
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function check(condition, message, output = '') {
  if (!condition) throw new Error(`${message}${output ? `\n${output}` : ''}`)
  console.log(`✓ ${message}`)
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', shell: process.platform === 'win32' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

try {
  let archive = process.argv[2] && path.resolve(process.argv[2])
  if (!archive) {
    const packed = run(npm, ['pack', '--pack-destination', work, '--silent'], repo)
    check(packed.code === 0, 'npm pack', packed.out)
    // The build (prepack) also prints to stdout: look for the archive instead of parsing it.
    archive = path.join(work, readdirSync(work).find((name) => name.endsWith('.tgz')) ?? 'missing.tgz')
  }
  check(existsSync(archive), `archive ${path.basename(archive)}`)

  const app = path.join(work, 'app')
  mkdirSync(path.join(app, 'arch', 'icons'), { recursive: true })
  writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'app', private: true }))
  const install = run(npm, ['install', '--omit=dev', '--no-audit', '--no-fund', archive], app)
  check(install.code === 0, 'npm install --omit=dev <archive>', install.out)
  for (const dev of ['vue', 'vite', '@xyflow/vue', 'elkjs', 'typescript']) {
    check(!existsSync(path.join(app, 'node_modules', dev)), `no development dependency installed (${dev})`)
  }

  writeFileSync(
    path.join(app, 'arch', 'architecture.yml'),
    ['id: root', 'name: Root', 'nodes:', '  - { id: web, name: Web, icon: github }', '  - { id: api, name: API, icon: ./icons/api.svg, universe: api.yml }', 'connections:', '  - { from: web, to: api, label: HTTPS }', ''].join('\n'),
  )
  writeFileSync(path.join(app, 'arch', 'api.yml'), ['id: api', 'name: API', 'nodes:', '  - { id: server, name: Server, icon: logos:nodejs-icon }', ''].join('\n'))
  writeFileSync(path.join(app, 'arch', 'icons', 'api.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')
  writeFileSync(path.join(app, 'arch', 'broken.yml'), 'id: broken\nname: Broken\nnodes:\n  - { id: a, name: A, universe: missing.yml }\n')

  const bin = path.join(app, 'node_modules', '.bin', process.platform === 'win32' ? 'graphinity.cmd' : 'graphinity')
  const cli = (...args) => run(bin, args, app)

  const v = cli('--version')
  check(v.code === 0 && v.out.trim() === version, `graphinity --version prints ${version}`, v.out)
  const help = cli('--help')
  check(help.code === 0 && help.out.includes('Usage: graphinity <command> [options]'), 'graphinity --help', help.out)
  const welcome = cli()
  check(welcome.code === 0 && welcome.out.includes(`Version: ${version}`) && !welcome.out.includes('\x1b['), 'graphinity (welcome page, plain text outside a terminal)', welcome.out)

  // init: a starter project that validates without network, never overwritten without --force.
  mkdirSync(path.join(app, 'starter'))
  const init = run(bin, ['init'], path.join(app, 'starter'))
  check(init.code === 0 && init.out.includes('Graphinity project initialized successfully!'), 'graphinity init', init.out)
  const starter = run(bin, ['validate', 'architecture.yml'], path.join(app, 'starter'))
  check(starter.code === 0 && starter.out.includes('✓ Valid: 2 universes'), 'the initialized project is valid', starter.out)
  check(run(bin, ['init'], path.join(app, 'starter')).code === 1, 'graphinity init refuses to overwrite (exit 1)')
  check(cli('nope', 'x.yml').code === 2, 'usage error exits with 2')

  const valid = cli('validate', 'arch/architecture.yml')
  check(valid.code === 0 && valid.out.includes('✓ Valid: 2 universes, 3 nodes, 1 connection'), 'graphinity validate (valid project)', valid.out)
  const invalid = cli('validate', 'arch/broken.yml')
  check(invalid.code === 1 && invalid.out.includes('File not found: "missing.yml"'), 'graphinity validate (invalid project) exits with 1', invalid.out)

  const built = cli('build', 'arch/architecture.yml', '--out', 'site')
  check(built.code === 0, 'graphinity build', built.out)
  for (const file of ['index.html', 'architecture.json', 'files/icons/api.svg', 'icons/ATTRIBUTIONS.md']) {
    check(existsSync(path.join(app, 'site', file)), `site contains ${file}`)
  }
  const data = JSON.parse(readFileSync(path.join(app, 'site', 'architecture.json'), 'utf8'))
  check(data.architecture.root === 'root', 'architecture.json describes the root universe')

  await new Promise((resolve, reject) => {
    const dev = spawn(bin, ['dev', 'arch/architecture.yml', '--port', '0', '--no-open'], { cwd: app, env, shell: process.platform === 'win32' })
    let out = ''
    let started = false
    const timer = setTimeout(() => {
      dev.kill('SIGKILL')
      reject(new Error(`graphinity dev did not start\n${out}`))
    }, 30_000)
    const onData = async (chunk) => {
      out += chunk
      const url = out.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
      if (!url || started) return
      started = true
      try {
        const page = await fetch(url)
        check(page.ok && (await page.text()).includes('graphinity:live'), `graphinity dev serves the viewer (${url})`)
        const json = await fetch(`${url}/architecture.json`)
        check(json.ok && (await json.json()).architecture.root === 'root', 'graphinity dev serves architecture.json')
        dev.kill('SIGINT')
      } catch (error) {
        dev.kill('SIGKILL')
        reject(error)
      }
    }
    dev.stdout.on('data', onData)
    dev.stderr.on('data', (chunk) => (out += chunk))
    dev.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) resolve(check(true, 'graphinity dev stops cleanly on Ctrl+C'))
      else reject(new Error(`graphinity dev exited with ${code ?? signal}\n${out}`))
    })
  })

  console.log(`\nPackage OK on Node.js ${process.version}`)
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
