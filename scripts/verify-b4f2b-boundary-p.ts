import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  B4F2B_AUTHORIZATION_TEMPLATE_PATH,
  B4F2B_CONTRACT_PATHS,
  B4F2B_EVIDENCE_TEMPLATE_PATH,
  B4F2B_FORBIDDEN_ENVIRONMENT_KEYS,
  B4F2B_INVENTORY_PATH,
  B4F2B_MANIFEST_PATH,
  B4F2B_OFFLINE_SOURCE_PATHS,
  B4F2B_PROTECTED_SURFACE_PATHS,
  B4F2B_SCHEMA_PATH,
  buildBoundaryPInventory,
  type BinaryMap,
  type ContractDocumentMap,
  type SourceMap,
} from './lib/b4f2b-boundary-p-contract'

const assertInsideRepository = (repositoryRoot: string, candidate: string) => {
  const relative = path.relative(repositoryRoot, candidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('fixed input escaped the repository')
  }
}

const readFixedFile = async (repositoryRoot: string, relativePath: string) => {
  const requestedPath = path.resolve(repositoryRoot, relativePath)
  assertInsideRepository(repositoryRoot, requestedPath)
  const metadata = await lstat(requestedPath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error('fixed input is not a regular file')
  }
  const resolvedPath = await realpath(requestedPath)
  assertInsideRepository(repositoryRoot, resolvedPath)
  return readFile(resolvedPath)
}

const parseJson = (value: Uint8Array) =>
  JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value)) as unknown

const assertNoCallerInput = () => {
  if (process.argv.slice(2).length !== 0) {
    throw new Error('arguments are not accepted')
  }
  if (
    B4F2B_FORBIDDEN_ENVIRONMENT_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(process.env, key)
    )
  ) {
    throw new Error('ambient connection configuration is not accepted')
  }
}

const prepareEvidenceDirectory = async (repositoryRoot: string) => {
  const evidenceDirectory = path.resolve(repositoryRoot, 'docs', 'evidence')
  assertInsideRepository(repositoryRoot, evidenceDirectory)
  try {
    const metadata = await lstat(evidenceDirectory)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('evidence directory is not a regular directory')
    }
    assertInsideRepository(repositoryRoot, await realpath(evidenceDirectory))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(evidenceDirectory, { recursive: true })
  }
  return evidenceDirectory
}

const main = async () => {
  assertNoCallerInput()
  const repositoryRoot = await realpath(process.cwd())
  const fixedPaths = new Set<string>([
    ...B4F2B_CONTRACT_PATHS,
    ...B4F2B_OFFLINE_SOURCE_PATHS,
    ...B4F2B_PROTECTED_SURFACE_PATHS,
  ])
  const loaded = new Map<string, Uint8Array>()
  for (const fixedPath of Array.from(fixedPaths)) {
    loaded.set(fixedPath, await readFixedFile(repositoryRoot, fixedPath))
  }
  const sources = {} as SourceMap
  for (const sourcePath of B4F2B_OFFLINE_SOURCE_PATHS) {
    sources[sourcePath] = new TextDecoder('utf-8', { fatal: true }).decode(
      loaded.get(sourcePath)
    )
  }
  const protectedSurfaces = {} as BinaryMap
  for (const surfacePath of B4F2B_PROTECTED_SURFACE_PATHS) {
    protectedSurfaces[surfacePath] = loaded.get(surfacePath) as Uint8Array
  }
  const contractDocuments = {} as ContractDocumentMap
  for (const contractPath of B4F2B_CONTRACT_PATHS) {
    contractDocuments[contractPath] = new TextDecoder('utf-8', {
      fatal: true,
    }).decode(loaded.get(contractPath))
  }
  const inventory = buildBoundaryPInventory({
    sources,
    protectedSurfaces,
    contractDocuments,
    manifest: parseJson(loaded.get(B4F2B_MANIFEST_PATH) as Uint8Array),
    schema: parseJson(loaded.get(B4F2B_SCHEMA_PATH) as Uint8Array),
    authorizationTemplate: parseJson(
      loaded.get(B4F2B_AUTHORIZATION_TEMPLATE_PATH) as Uint8Array
    ),
    evidenceTemplate: parseJson(
      loaded.get(B4F2B_EVIDENCE_TEMPLATE_PATH) as Uint8Array
    ),
  })
  const evidenceDirectory = await prepareEvidenceDirectory(repositoryRoot)
  const outputPath = path.resolve(repositoryRoot, B4F2B_INVENTORY_PATH)
  assertInsideRepository(evidenceDirectory, outputPath)
  await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'w',
  })
  process.stdout.write('PASS B4F2B Boundary P fixed offline contract\n')
}

void main().catch(() => {
  process.stderr.write('Boundary P offline contract failed.\n')
  process.exitCode = 1
})
