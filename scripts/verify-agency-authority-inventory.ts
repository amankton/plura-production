import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyRepository } from './agency-authority-inventory-lib'

if (process.argv.length !== 2) {
  console.error('B5A1_FAIL argument-count')
  process.exit(1)
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
  const result = verifyRepository(repositoryRoot)
  const counts = result.counts
  if (result.errors.length > 0) {
    console.error(
      `B5A1_FAIL errors=${result.errors.length} first=${result.errors[0]}`
    )
    process.exit(1)
  }
  console.log(
    [
      'B5A1_PASS',
      `records=${counts.records}`,
      `db=${counts.databaseImports}`,
      `db_direct=${counts.directDatabaseCallers}`,
      `db_injected=${counts.databaseAdapterInjections}`,
      `server_files=${counts.serverActionFiles}`,
      `server_exports=${counts.serverActionExports}`,
      `query_exports=${counts.queryExports}`,
      `api_routes=${counts.apiRouteFiles}`,
      `api_handlers=${counts.apiHandlerSymbols}`,
      `pages=${counts.pageFiles}`,
      `layouts=${counts.layoutFiles}`,
      `upload_routes=${counts.uploadRoutes}`,
      `upload_callbacks=${counts.uploadCallbacks}`,
      `providers=${counts.providerBoundaries}`,
      `manifest=${result.manifestHash}`,
    ].join(' ')
  )
} catch {
  console.error('B5A1_FAIL verifier-error')
  process.exit(1)
}
