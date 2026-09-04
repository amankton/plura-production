import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
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
    const resolvedDirectory = await realpath(evidenceDirectory)
    assertInsideRepository(repositoryRoot, resolvedDirectory)
    return resolvedDirectory
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(evidenceDirectory, { recursive: true })
  }
  const resolvedDirectory = await realpath(evidenceDirectory)
  assertInsideRepository(repositoryRoot, resolvedDirectory)
  return resolvedDirectory
}

const assertSafeExistingOutput = async (
  evidenceDirectory: string,
  outputPath: string
) => {
  try {
    const metadata = await lstat(outputPath)
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error('output target is not a regular file')
    }
    assertInsideRepository(evidenceDirectory, await realpath(outputPath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

const writeAtomicEvidence = async (
  evidenceDirectory: string,
  outputPath: string,
  content: string
) => {
  await assertSafeExistingOutput(evidenceDirectory, outputPath)
  const temporaryPath = path.resolve(
    evidenceDirectory,
    `.CF-P1-B4F2B-boundary-p-${randomUUID()}.tmp`
  )
  assertInsideRepository(evidenceDirectory, temporaryPath)
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(temporaryPath, 'wx', 0o600)
    const temporaryMetadata = await lstat(temporaryPath)
    if (!temporaryMetadata.isFile() || temporaryMetadata.isSymbolicLink()) {
      throw new Error('temporary output is not a regular file')
    }
    assertInsideRepository(evidenceDirectory, await realpath(temporaryPath))
    await handle.writeFile(content, { encoding: 'utf8' })
    await handle.sync()
    await handle.close()
    handle = undefined
    await assertSafeExistingOutput(evidenceDirectory, outputPath)
    await rename(temporaryPath, outputPath)
  } finally {
    await handle?.close().catch(() => undefined)
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
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
  const outputPath = path.resolve(evidenceDirectory, path.basename(B4F2B_INVENTORY_PATH))
  assertInsideRepository(evidenceDirectory, outputPath)
  await writeAtomicEvidence(
    evidenceDirectory,
    outputPath,
    `${JSON.stringify(inventory, null, 2)}\n`
  )
  process.stdout.write('PASS B4F2B Boundary P fixed offline contract\n')
}

void main().catch(() => {
  process.stderr.write('Boundary P offline contract failed.\n')
  process.exitCode = 1
})
