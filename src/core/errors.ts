// Error formatting. No Node dependency: also used by the browser viewer.
import type { ConfigError } from './types.ts'

/** `platform/clusters/eu-west.yml:55:15 nodes[2].universe: File not found: "../services/catalgo.yml"` */
export function formatConfigError(error: ConfigError): string {
  const position = error.line === undefined ? '' : `:${error.line}${error.column === undefined ? '' : `:${error.column}`}`
  return `${error.file}${position}${error.field ? ` ${error.field}` : ''}: ${error.message}`
}
