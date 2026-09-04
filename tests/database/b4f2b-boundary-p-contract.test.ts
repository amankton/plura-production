import { describe, expect, test } from 'bun:test'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  B4F2B_AUTHORIZATION_TEMPLATE_PATH,
  B4F2B_CONTRACT_PATHS,
  B4F2B_EVIDENCE_TEMPLATE_PATH,
  B4F2B_FORBIDDEN_ENVIRONMENT_KEYS,
  B4F2B_MANIFEST_PATH,
  B4F2B_OFFLINE_SOURCE_PATHS,
  B4F2B_PROTECTED_SURFACE_PATHS,
  B4F2B_SCHEMA_PATH,
  authorizationState,
  buildBoundaryPInventory,
  validateClosedSchemaDocument,
  validateEvidenceTemplate,
  validateManifest,
  type BinaryMap,
  type ContractDocumentMap,
  type SourceMap,
} from '../../scripts/lib/b4f2b-boundary-p-contract'

const readJson = async (filePath: string) =>
  JSON.parse(await Bun.file(filePath).text()) as unknown

const loadInputs = async () => {
  const sources = {} as SourceMap
  for (const sourcePath of B4F2B_OFFLINE_SOURCE_PATHS) {
    sources[sourcePath] = await Bun.file(sourcePath).text()
  }
  const protectedSurfaces = {} as BinaryMap
  for (const surfacePath of B4F2B_PROTECTED_SURFACE_PATHS) {
    protectedSurfaces[surfacePath] = new Uint8Array(
      await Bun.file(surfacePath).arrayBuffer()
    )
  }
  const contractDocuments = {} as ContractDocumentMap
  for (const contractPath of B4F2B_CONTRACT_PATHS) {
    contractDocuments[contractPath] = await Bun.file(contractPath).text()
  }
  return {
    sources,
    protectedSurfaces,
    contractDocuments,
    manifest: await readJson(B4F2B_MANIFEST_PATH),
    schema: await readJson(B4F2B_SCHEMA_PATH),
    authorizationTemplate: await readJson(B4F2B_AUTHORIZATION_TEMPLATE_PATH),
    evidenceTemplate: await readJson(B4F2B_EVIDENCE_TEMPLATE_PATH),
  }
}

const offlineEnvironment = () => {
  const environment = { ...process.env }
  for (const key of B4F2B_FORBIDDEN_ENVIRONMENT_KEYS) delete environment[key]
  return environment
}

const validatorPath = path.resolve('scripts/verify-b4f2b-boundary-p.ts')

const runCli = (
  extraArguments: string[] = [],
  environment = offlineEnvironment(),
  cwd = process.cwd()
) => {
  const child = Bun.spawn(
    [process.execPath, validatorPath, ...extraArguments],
    { cwd, env: environment, stderr: 'pipe', stdout: 'pipe' }
  )
  return Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
}

describe('B4F2B Boundary P closed offline contract', () => {
  test('builds a deterministic inventory while keeping Boundary R blocked', async () => {
    const inputs = await loadInputs()
    const first = buildBoundaryPInventory(inputs)
    const second = buildBoundaryPInventory(inputs)
    expect(first).toEqual(second)
    expect(first.boundaryP).toBe('CONTRACT_VALIDATED_SYNTHETIC_NOT_RUN')
    expect(first.boundaryR).toBe('BLOCKED')
    expect(first.authorizationState).toBe('INCOMPLETE')
    expect(first.representativeState).toBe('NOT_ACCESSED')
    expect(first.currentState).toEqual({
      migrationBaseline: 'ABSENT_REQUIRES_AUTHORIZED_BASELINE',
      prismaProvider: 'mysql',
      prismaRelationMode: 'prisma',
      permissionUserIdInPrisma: false,
      prismaDeclaresLogicalPlan: true,
      prismaDeclaresWebhookInbox: true,
    })
    expect(
      first.stageGraph.every(
        (stage) =>
          stage.executionStatus === 'SYNTHETIC_ONLY' ||
          stage.executionStatus === 'BLOCKED_BOUNDARY_R'
      )
    ).toBeTrue()
  })

  test('fails closed on contract, source, and protected-surface drift', async () => {
    const inputs = await loadInputs()
    expect(() =>
      buildBoundaryPInventory({
        ...inputs,
        contractDocuments: {
          ...inputs.contractDocuments,
          [B4F2B_MANIFEST_PATH]: inputs.contractDocuments[
            B4F2B_MANIFEST_PATH
          ].replace('"status"', '"changedStatus"'),
        },
      })
    ).toThrow()
    expect(() =>
      buildBoundaryPInventory({
        ...inputs,
        sources: { ...inputs.sources, 'prisma/schema.prisma': 'drift\n' },
      })
    ).toThrow()
    const changedPackage = new Uint8Array(
      inputs.protectedSurfaces['package.json'].byteLength + 1
    )
    changedPackage.set(inputs.protectedSurfaces['package.json'])
    expect(() =>
      buildBoundaryPInventory({
        ...inputs,
        protectedSurfaces: {
          ...inputs.protectedSurfaces,
          'package.json': changedPackage,
        },
      })
    ).toThrow()
  })

  test('requires a closed schema and a forward-only acyclic stage graph', async () => {
    const schema = (await readJson(B4F2B_SCHEMA_PATH)) as Record<string, any>
    validateClosedSchemaDocument(schema)
    const openSchema = structuredClone(schema)
    openSchema.$defs.authorizationPacket.additionalProperties = true
    expect(() => validateClosedSchemaDocument(openSchema)).toThrow()

    const manifest = (await readJson(B4F2B_MANIFEST_PATH)) as Record<string, any>
    validateManifest(manifest)
    const cyclicManifest = structuredClone(manifest)
    cyclicManifest.stageGraph[0].dependencies = ['P11_CLEANUP_PLAN']
    expect(() => validateManifest(cyclicManifest)).toThrow()
    const executableManifest = structuredClone(manifest)
    executableManifest.criterionDisposition[0].disposition = 'PASS'
    expect(() => validateManifest(executableManifest)).toThrow()
  })

  test('authorization can never self-approve Boundary R', async () => {
    const template = (await readJson(
      B4F2B_AUTHORIZATION_TEMPLATE_PATH
    )) as Record<string, any>
    expect(authorizationState(template)).toBe('INCOMPLETE')
    expect(authorizationState({ ...template, unexpected: true })).toBe('INVALID')

    const complete = structuredClone(template)
    complete.state = 'COMPLETE_AWAITING_EXTERNAL_APPROVAL'
    complete.scope.sourceFingerprintSha256 = 'a'.repeat(64)
    complete.scope.targetFingerprintSha256 = 'b'.repeat(64)
    complete.scope.operations = ['READ_ONLY_STRUCTURAL_FINGERPRINT']
    complete.scope.windowStartUtc = '2030-01-01T00:00:00.000Z'
    complete.scope.windowEndUtc = '2030-01-01T01:00:00.000Z'
    complete.scope.backupMetadataSha256 = 'c'.repeat(64)
    complete.scope.retentionPolicySha256 = 'd'.repeat(64)
    complete.scope.rollbackPlanSha256 = 'e'.repeat(64)
    for (const key of Object.keys(complete.approvals)) {
      complete.approvals[key] = 'f'.repeat(64)
    }
    for (const key of Object.keys(complete.rules)) complete.rules[key] = true
    expect(authorizationState(complete)).toBe(
      'COMPLETE_AWAITING_EXTERNAL_APPROVAL'
    )
    complete.state = 'APPROVED_FOR_EXECUTION'
    expect(authorizationState(complete)).toBe('INVALID')
  })

  test('evidence template is blank, finite, aggregate-only, and closed', async () => {
    const template = await readJson(B4F2B_EVIDENCE_TEMPLATE_PATH)
    expect(() => validateEvidenceTemplate(template)).not.toThrow()
    expect(JSON.stringify(template)).not.toMatch(
      /"(command|credential|email|host|message|path|providerId|recordId|row|secret|tenantId|url)"\s*:/i
    )
    expect(() =>
      validateEvidenceTemplate({
        ...(template as Record<string, unknown>),
        rowId: 'forbidden',
      })
    ).toThrow()
  })

  test('CLI writes only deterministic offline evidence with no arguments', async () => {
    const [stdout, stderr, exitCode] = await runCli()
    expect(exitCode).toBe(0)
    expect(stdout).toBe('PASS B4F2B Boundary P fixed offline contract\n')
    expect(stderr).toBe('')
    const first = await Bun.file(
      'docs/evidence/CF-P1-B4F2B-boundary-p-inventory.json'
    ).text()
    const secondRun = await runCli()
    expect(secondRun[2]).toBe(0)
    const second = await Bun.file(
      'docs/evidence/CF-P1-B4F2B-boundary-p-inventory.json'
    ).text()
    expect(second).toBe(first)
    expect(first).not.toMatch(/"(credential|email|host|recordId|row|secret|tenantId|url)"/i)
  })

  test('CLI rejects caller selectors and ambient connection configuration without echo', async () => {
    const hostileSelector = `--source-${'url'}=not-for-use`
    const argumentResult = await runCli([hostileSelector])
    expect(argumentResult[2]).not.toBe(0)
    expect(argumentResult[0]).toBe('')
    expect(argumentResult[1]).toBe('Boundary P offline contract failed.\n')
    expect(`${argumentResult[0]}${argumentResult[1]}`).not.toContain(hostileSelector)

    const ambientMarker = 'must-never-appear'
    const environmentResult = await runCli([], {
      ...offlineEnvironment(),
      DATABASE_URL: ambientMarker,
    })
    expect(environmentResult[2]).not.toBe(0)
    expect(environmentResult[0]).toBe('')
    expect(environmentResult[1]).toBe('Boundary P offline contract failed.\n')
    expect(`${environmentResult[0]}${environmentResult[1]}`).not.toContain(
      ambientMarker
    )
  })

  test('CLI rejects a redirected output without changing the outside sentinel', async () => {
    const ownerDirectory = await mkdtemp(path.join(tmpdir(), 'crewframe-b4f2b-'))
    const repositoryFixture = path.join(ownerDirectory, 'repository')
    const outsideDirectory = path.join(ownerDirectory, 'outside-target')
    const sentinelPath = path.join(outsideDirectory, 'sentinel.txt')
    try {
      await mkdir(repositoryFixture)
      const fixedInputs = new Set([
        ...B4F2B_CONTRACT_PATHS,
        ...B4F2B_OFFLINE_SOURCE_PATHS,
        ...B4F2B_PROTECTED_SURFACE_PATHS,
      ])
      for (const fixedInput of Array.from(fixedInputs)) {
        const destination = path.join(repositoryFixture, fixedInput)
        await mkdir(path.dirname(destination), { recursive: true })
        await copyFile(path.resolve(fixedInput), destination)
      }
      const evidenceDirectory = path.join(repositoryFixture, 'docs', 'evidence')
      await mkdir(evidenceDirectory, { recursive: true })
      await mkdir(outsideDirectory)
      await writeFile(sentinelPath, 'OUTSIDE_SENTINEL_UNCHANGED\n', 'utf8')
      await symlink(
        outsideDirectory,
        path.join(evidenceDirectory, 'CF-P1-B4F2B-boundary-p-inventory.json'),
        'junction'
      )
      const [stdout, stderr, exitCode] = await runCli(
        [],
        offlineEnvironment(),
        repositoryFixture
      )
      expect(exitCode).not.toBe(0)
      expect(stdout).toBe('')
      expect(stderr).toBe('Boundary P offline contract failed.\n')
      expect(await Bun.file(sentinelPath).text()).toBe(
        'OUTSIDE_SENTINEL_UNCHANGED\n'
      )
      expect(`${stdout}${stderr}`).not.toContain(sentinelPath)
    } finally {
      await rm(ownerDirectory, { force: true, recursive: true })
    }
  })

  test('tool has no database, provider, network, process, or shell adapter', async () => {
    const source = `${await Bun.file(
      'scripts/verify-b4f2b-boundary-p.ts'
    ).text()}\n${await Bun.file(
      'scripts/lib/b4f2b-boundary-p-contract.ts'
    ).text()}`
    expect(source).not.toMatch(
      /^\s*import[^\n]*(PrismaClient|@\/lib\/db|\.\.\/src\/lib\/db)|fetch\(|https?:\/\/|Bun\.spawn|child_process|execFile|spawnSync/m
    )
    expect(source).not.toMatch(/docker\s+(run|exec)|mysql\s|password-manager/i)
  })
})
