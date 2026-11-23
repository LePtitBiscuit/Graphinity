// Turns configuration text into plain data. Data only: no custom YAML tags, no code execution.
import { LineCounter, parseDocument, type Document } from 'yaml'

export type FieldPath = (string | number)[]

export interface Position {
  line: number
  column: number
}

export interface ParseIssue {
  message: string
  position?: Position
}

export interface ParsedConfig {
  data: unknown
  /** Position of a field, or of its closest existing ancestor. */
  locate(path: FieldPath): Position | undefined
}

export type ConfigFormat = 'yaml' | 'json'

/** Caps alias expansion to defuse "billion laughs" style documents. */
const MAX_ALIAS_COUNT = 100

export function parseConfig(
  text: string,
  format: ConfigFormat,
): { ok: true; config: ParsedConfig } | { ok: false; issues: ParseIssue[] } {
  const source = text.startsWith('﻿') ? text.slice(1) : text

  if (format === 'json') {
    try {
      JSON.parse(source)
    } catch (error) {
      return { ok: false, issues: [{ message: `Invalid JSON: ${(error as Error).message}` }] }
    }
  }

  // JSON is valid YAML 1.2, so the YAML parser also provides positions (and duplicate key
  // detection) for JSON files.
  const lineCounter = new LineCounter()
  const doc = parseDocument(source, { lineCounter, prettyErrors: false })

  // Warnings include unresolved tags such as `!!js/function`: treat them as errors.
  const problems = [...doc.errors, ...doc.warnings]
  if (problems.length > 0) {
    return {
      ok: false,
      issues: problems.map((problem) => {
        const { line, col } = lineCounter.linePos(problem.pos[0])
        return {
          message: `Invalid ${format === 'json' ? 'JSON' : 'YAML'}: ${problem.message}`,
          position: { line, column: col },
        }
      }),
    }
  }

  let data: unknown
  try {
    data = doc.toJS({ maxAliasCount: MAX_ALIAS_COUNT })
  } catch (error) {
    return { ok: false, issues: [{ message: `Invalid YAML: ${(error as Error).message}` }] }
  }

  return { ok: true, config: { data, locate: (path) => locate(doc, lineCounter, path) } }
}

function locate(doc: Document, lineCounter: LineCounter, path: FieldPath): Position | undefined {
  for (let depth = path.length; depth >= 0; depth--) {
    const node = depth === 0 ? doc.contents : doc.getIn(path.slice(0, depth), true)
    const range = (node as { range?: [number, number, number] } | null | undefined)?.range
    if (range) {
      const { line, col } = lineCounter.linePos(range[0])
      return { line, column: col }
    }
  }
  return undefined
}
