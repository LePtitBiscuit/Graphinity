// Terminal output: colors only on a terminal (see brand.ts: NO_COLOR, FORCE_COLOR), paths relative
// to the working directory.
import path from 'node:path'
import { formatConfigError, type ConfigError } from '../core/index.ts'
import { colorEnabled } from './brand.ts'

const paint = (code: number, stream: NodeJS.WriteStream) => (text: string) =>
  colorEnabled(stream) ? `\x1b[${code}m${text}\x1b[0m` : text

export const red = paint(31, process.stderr)
export const yellow = paint(33, process.stderr)
export const green = paint(32, process.stdout)
export const dim = paint(2, process.stdout)

export function info(line: string): void {
  process.stdout.write(`${line}\n`)
}

export function warn(line: string): void {
  process.stderr.write(`${yellow('warning')} ${line}\n`)
}

/** Warnings (e.g. icons not found), with file paths relative to the working directory. */
export function printWarnings(warnings: ConfigError[], projectRoot: string): void {
  for (const warning of warnings) {
    const file = path.relative(process.cwd(), path.resolve(projectRoot, warning.file)) || warning.file
    warn(formatConfigError({ ...warning, file }))
  }
}

/** Errors with file paths made relative to the working directory, so they can be opened directly. */
export function printErrors(errors: ConfigError[], projectRoot: string): void {
  process.stderr.write(`${red(`✗ ${errors.length === 1 ? '1 error' : `${errors.length} errors`}`)}\n`)
  for (const error of errors) {
    const file = path.relative(process.cwd(), path.resolve(projectRoot, error.file)) || error.file
    process.stderr.write(`  ${formatConfigError({ ...error, file })}\n`)
  }
}
