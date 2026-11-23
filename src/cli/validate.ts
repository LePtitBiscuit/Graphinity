import { buildViewerData, loadArchitecture } from '../core/index.ts'
import { green, info, printErrors, printWarnings } from './output.ts'
import { summary } from './site.ts'

/** Exit code: 0 when valid (warnings allowed), 1 when invalid. */
export async function validate(file: string, projectRoot: string): Promise<number> {
  const result = await loadArchitecture(file, { projectRoot })
  if (!result.ok) {
    printErrors(result.errors, projectRoot)
    return 1
  }
  printWarnings((await buildViewerData(result.architecture)).warnings, projectRoot)
  info(`${green('✓')} Valid: ${summary(result.architecture)}`)
  return 0
}
