import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const scriptPath = 'scripts/verify-b4f2b-p02-synthetic-mysql.ps1'
const fixturePath = 'tests/fixtures/mysql/b4f2b-p02-synthetic-schema.sql'
const evidencePath = 'docs/evidence/CF-P1-B4F2B-P02-synthetic-mysql.json'
const fixedInputPaths = [
  'docs/architecture/CF-P1-B4F2B-boundary-p-manifest.json',
  'docs/architecture/schemas/CF-P1-B4F2B-boundary-p.schema.json',
  'docs/templates/CF-P1-B4F2B-boundary-r-authorization.json',
  'docs/templates/CF-P1-B4F2B-boundary-r-evidence.json',
  'docs/issues/CF-P1-B4F2B-P02-disposable-synthetic-mysql-proof.md',
  'scripts/verify-b4f2b-boundary-p.ts',
  fixturePath,
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql',
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql',
]

const normalize = (value: string) =>
  `${value.replace(/\r\n/g, '\n').trimEnd()}\n`
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

const forbiddenEnvironmentKeys = [
  'DATABASE_URL',
  'DIRECT_URL',
  'DOCKER_CERT_PATH',
  'DOCKER_CONTEXT',
  'DOCKER_HOST',
  'DOCKER_TLS_VERIFY',
  'MYSQL_DATABASE',
  'MYSQL_HOST',
  'MYSQL_PWD',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_TCP_PORT',
  'PLANETSCALE_SERVICE_TOKEN',
]

const offlineEnvironment = () => {
  const environment = { ...process.env }
  for (const key of forbiddenEnvironmentKeys) delete environment[key]
  return environment
}

const runDeniedProof = (args: string[], environment = offlineEnvironment()) => {
  const child = Bun.spawn(
    ['pwsh', '-NoProfile', '-NonInteractive', '-File', scriptPath, ...args],
    { env: environment, stderr: 'pipe', stdout: 'pipe' }
  )
  return Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
}

const runProofFile = (
  proofScript: string,
  environment = offlineEnvironment()
) => {
  const child = Bun.spawn(
    ['pwsh', '-NoProfile', '-NonInteractive', '-File', proofScript],
    { env: environment, stderr: 'pipe', stdout: 'pipe' }
  )
  return Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
}

describe('B4F2B P-02 disposable synthetic MySQL proof', () => {
  test('is pinned to the accepted gate and exact already-local image', async () => {
    const source = await Bun.file(scriptPath).text()
    expect(source).toContain(
      "$gateSha = '44deadc0e89616b31524efed6f70faa2c89e838c'"
    )
    expect(source).toContain(
      "$acceptedContractSha = '33b29ddd80e198725605a85892fb6855437ab061'"
    )
    expect(source).toContain(
      'sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb'
    )
    expect(source).toContain("'image', 'inspect', $imageReference")
    expect(source).toContain("'--pull=never'")
    expect(source).toContain("'--network=none'")
    expect(source).toContain(".StartsWith('npipe://'")
    expect(source).not.toMatch(/docker\s+(pull|build|prune)|'image',\s*'(pull|build|prune)'/i)
  })

  test('allows only the exact labeled container and its anonymous-volume cleanup', async () => {
    const source = await Bun.file(scriptPath).text()
    expect(source).toContain(
      "$proofLabel = 'com.crewframe.proof=CF-P1-B4F2B-P02'"
    )
    expect(source).toContain("'rm', '--force', '--volumes', $containerName")
    expect(source).toContain(
      "'volume', 'ls', '--quiet', '--filter', \"name=^$VolumeName$\""
    )
    expect(source).toContain('Test-ExactProofContainerPresent')
    expect(source).toContain('Find-ExactProofContainerAfterRun')
    expect(source).toContain("'container', 'inspect', '--format', '{{.Image}}'")
    expect(source).toContain(
      "'ps', '--all', '--quiet', '--filter', \"label=$proofLabel\""
    )
    expect(source).toContain('$anonymousVolume = Get-AnonymousDataVolume')
    expect(source).toContain("$parts[2] -notmatch '^[a-f0-9]{64}$'")
    expect(source).not.toContain("'volume', 'inspect', $anonymousVolume")
    const scenario = source.slice(source.indexOf('function Invoke-ContainerScenario'))
    const runCall = scenario.indexOf("'run', '--detach'")
    const reconciliation = scenario.indexOf(
      'Find-ExactProofContainerAfterRun',
      runCall
    )
    const volumeCapture = scenario.indexOf(
      '$anonymousVolume = Get-AnonymousDataVolume',
      reconciliation
    )
    const injectedFailure = scenario.indexOf(
      "throw 'EXPECTED_INJECTED_FAILURE'",
      volumeCapture
    )
    const runResultCheck = scenario.indexOf('$started.ExitCode', volumeCapture)
    const isolationCheck = scenario.indexOf(
      'Assert-ContainerIsolation',
      volumeCapture
    )
    const cleanupFinally = scenario.indexOf('finally {', runCall)
    expect(runCall).toBeGreaterThan(0)
    expect(reconciliation).toBeGreaterThan(runCall)
    expect(volumeCapture).toBeGreaterThan(reconciliation)
    expect(injectedFailure).toBeGreaterThan(volumeCapture)
    expect(runResultCheck).toBeGreaterThan(volumeCapture)
    expect(isolationCheck).toBeGreaterThan(volumeCapture)
    expect(cleanupFinally).toBeGreaterThan(runCall)
    expect(source).not.toMatch(/'--publish'|'--mount'|'--volume'\s*,/)
    expect(source).not.toMatch(/'volume',\s*'(rm|prune)'|'container',\s*'prune'/)
    expect(source).not.toMatch(/docker\s+(rm|volume\s+rm|system\s+prune)/i)
  })

  test('bounds and terminates every Docker subprocess', async () => {
    const source = await Bun.file(scriptPath).text()
    expect(source).toContain('$dockerCommandTimeoutMilliseconds = 30000')
    expect(source).toContain('$dockerTerminationTimeoutMilliseconds = 5000')
    expect(source).toContain(
      '$process.WaitForExit($dockerCommandTimeoutMilliseconds)'
    )
    expect(source).toContain('$process.StandardInput.WriteAsync($InputText)')
    expect(source).toContain(
      '$stdoutTask.Wait($dockerTerminationTimeoutMilliseconds)'
    )
    expect(source).toContain(
      '$stderrTask.Wait($dockerTerminationTimeoutMilliseconds)'
    )
    expect(source).toContain('$process.Kill($true)')
    expect(source).toContain(
      '$script:activeDockerProcessCount = $script:activeDockerProcessCount + 1'
    )
    expect(source).toContain(
      '$script:activeDockerProcessCount = $script:activeDockerProcessCount - 1'
    )
    expect(source).toContain("throw 'DOCKER_PROCESS_HANDLE_REMAINS'")
    expect(source).not.toMatch(/\.WaitForExit\(\s*\)/)
    expect(source).not.toMatch(/StandardInput\.Write\(/)
  })

  test('binds every input hash and keeps permission DDL absent', async () => {
    const source = await Bun.file(scriptPath).text()
    const fixture = await Bun.file(fixturePath).text()
    const b4d = await Bun.file(
      'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql'
    ).text()
    const b4f1 = await Bun.file(
      'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql'
    ).text()
    expect(sha256(normalize(fixture))).toBe(
      '196913a510fc2165c2f4d1ed649a6b6a94124150a8a8f3d09654c913a291d52e'
    )
    expect(sha256(normalize(b4d))).toBe(
      '986397f506dcf9f9d1d163ddda6e403abdcec98da3edfb5dc172a2f279eb6fe7'
    )
    expect(sha256(normalize(b4f1))).toBe(
      '66195477220c545cc75efad4d269443ff0cc0492e2631e6a113cbee6f0f9621d'
    )
    expect(`${source}\n${fixture}`).not.toMatch(
      /\b(ALTER|CREATE|DROP|TRUNCATE)\s+(TABLE\s+)?`?Permissions`?/i
    )
    expect(source).toContain("permissionStage = 'DESIGN_REQUIRED'")
    expect(source).toContain('Get-GitBlobSha1')
  })

  test('covers the complete logical-plan and webhook proof matrix', async () => {
    const source = await Bun.file(scriptPath).text()
    for (const requiredSignal of [
      '5|4|5|1|1|2|1',
      'REPEATED_LOGICAL_DDL_NOT_REJECTED',
      'INCOMPATIBLE_LOGICAL_DDL_NOT_REJECTED',
      'WEBHOOK_RECEIPT_UNIQUENESS_MISSING',
      'WEBHOOK_OBJECT_UNIQUENESS_MISSING',
      'WEBHOOK_CONDITIONAL_CREATE_BEHAVIOR_CHANGED',
      '3|40|0|0|1',
      'EXPECTED_INJECTED_FAILURE',
    ]) {
      expect(source).toContain(requiredSignal)
    }
    expect(source.match(/StripeWebhookReceipt\|\d+\|/g)).toHaveLength(21)
    expect(source.match(/StripeWebhookObjectLease\|\d+\|/g)).toHaveLength(9)
    expect(source.match(/StripeWebhookReplayAudit\|\d+\|/g)).toHaveLength(10)
  })

  test('committed evidence is deterministic, bounded, aggregate-only, and blocked from R', async () => {
    const evidenceText = await Bun.file(evidencePath).text()
    const evidence = JSON.parse(evidenceText) as Record<string, any>
    expect(sha256(evidenceText)).toBe(
      'a522fd9d21984b208a720f356d735fb508997e02ec293b8aeef8e1a2479006ef'
    )
    expect(evidence.boundary).toBe('P')
    expect(evidence.boundaryR).toBe('BLOCKED')
    expect(evidence.representativeState).toBe('NOT_ACCESSED')
    expect(evidence.permissionStage).toBe('DESIGN_REQUIRED')
    expect(evidence.image).toEqual({
      digest:
        'sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb',
      platform: 'linux/amd64',
      pull: 'NEVER',
      network: 'NONE',
      publishedPorts: 0,
      requestedMounts: 0,
      retainedVolumes: 0,
    })
    expect(Object.values(evidence.cleanup).every((count) => count === 0)).toBeTrue()
    expect(evidenceText).not.toMatch(
      /"(command|containerId|containerName|credential|databaseUrl|email|host|path|recordId|rowValue|secret|tenantId|url|volumeId|volumeName)"\s*:/i
    )
    expect(evidenceText).not.toMatch(/record_[a-e]|scope_a|event_a|object_a/)
    expect(evidence.audit).toBe('STALE_UNREVALIDATED')
    expect(evidence.advisories).toBe('UNKNOWN')
    expect(evidence.readiness).toBe('FAIL')
    expect(evidence.openHardGate).toBe('CF-P1-AUDIT-FRESH-01')
  })

  test('rejects every caller argument before Docker with generic output only', async () => {
    const hostileMarker = `--database-${'url'}=must-not-appear`
    const [stdout, stderr, exitCode] = await runDeniedProof([hostileMarker])
    expect(exitCode).not.toBe(0)
    expect(stdout).toBe('')
    expect(stderr.replace(/\r\n/g, '\n')).toBe(
      'Boundary P-02 synthetic MySQL proof failed.\n'
    )
    expect(`${stdout}${stderr}`).not.toContain(hostileMarker)
  }, 15_000)

  test('rejects ambient connection configuration before Docker without echo', async () => {
    const hostileMarker = 'ambient-value-must-not-appear'
    const [stdout, stderr, exitCode] = await runDeniedProof([], {
      ...offlineEnvironment(),
      DOCKER_HOST: hostileMarker,
    })
    expect(exitCode).not.toBe(0)
    expect(stdout).toBe('')
    expect(stderr.replace(/\r\n/g, '\n')).toBe(
      'Boundary P-02 synthetic MySQL proof failed.\n'
    )
    expect(`${stdout}${stderr}`).not.toContain(hostileMarker)
  }, 15_000)

  test('rejects an intermediate output junction without changing the outside sentinel', async () => {
    const ownerDirectory = await mkdtemp(
      path.join(tmpdir(), 'crewframe-b4f2b-p02-output-')
    )
    const repositoryFixture = path.join(ownerDirectory, 'repository')
    const outsideDirectory = path.join(ownerDirectory, 'outside-evidence')
    const copiedScript = path.join(
      repositoryFixture,
      'scripts',
      'verify-b4f2b-p02-synthetic-mysql.ps1'
    )
    const sentinelPath = path.join(outsideDirectory, 'sentinel.txt')
    try {
      await mkdir(path.dirname(copiedScript), { recursive: true })
      await mkdir(path.join(repositoryFixture, 'docs'), { recursive: true })
      await mkdir(outsideDirectory, { recursive: true })
      await copyFile(scriptPath, copiedScript)
      await writeFile(sentinelPath, 'OUTSIDE_SENTINEL_UNCHANGED\n', 'utf8')
      await symlink(
        outsideDirectory,
        path.join(repositoryFixture, 'docs', 'evidence'),
        'junction'
      )

      const [stdout, stderr, exitCode] = await runProofFile(copiedScript)
      expect(exitCode).not.toBe(0)
      expect(stdout).toBe('')
      expect(stderr.replace(/\r\n/g, '\n')).toBe(
        'Boundary P-02 synthetic MySQL proof failed.\n'
      )
      expect(await Bun.file(sentinelPath).text()).toBe(
        'OUTSIDE_SENTINEL_UNCHANGED\n'
      )
      expect(
        await Bun.file(
          path.join(outsideDirectory, path.basename(evidencePath))
        ).exists()
      ).toBeFalse()
    } finally {
      await rm(ownerDirectory, { force: true, recursive: true })
    }
  }, 15_000)

  test('rejects an intermediate fixed-input junction before Docker', async () => {
    const ownerDirectory = await mkdtemp(
      path.join(tmpdir(), 'crewframe-b4f2b-p02-input-')
    )
    const repositoryFixture = path.join(ownerDirectory, 'repository')
    const outsideFixtures = path.join(ownerDirectory, 'outside-fixtures')
    const copiedScript = path.join(
      repositoryFixture,
      'scripts',
      'verify-b4f2b-p02-synthetic-mysql.ps1'
    )
    const sentinelPath = path.join(outsideFixtures, 'sentinel.txt')
    try {
      const manifest = JSON.parse(
        await Bun.file(
          'docs/architecture/CF-P1-B4F2B-boundary-p-manifest.json'
        ).text()
      ) as { protectedSurfaces: Array<{ path: string }> }
      const requiredFiles = new Set([
        ...fixedInputPaths,
        ...manifest.protectedSurfaces.map((surface) => surface.path),
      ])
      requiredFiles.delete(fixturePath)
      for (const requiredFile of Array.from(requiredFiles)) {
        const destination = path.join(repositoryFixture, requiredFile)
        await mkdir(path.dirname(destination), { recursive: true })
        await copyFile(path.resolve(requiredFile), destination)
      }
      await mkdir(path.dirname(copiedScript), { recursive: true })
      await copyFile(scriptPath, copiedScript)
      await mkdir(path.join(repositoryFixture, 'docs', 'evidence'), {
        recursive: true,
      })
      await mkdir(path.join(repositoryFixture, 'tests'), { recursive: true })
      await mkdir(path.join(outsideFixtures, 'mysql'), { recursive: true })
      await copyFile(
        fixturePath,
        path.join(outsideFixtures, 'mysql', path.basename(fixturePath))
      )
      await writeFile(sentinelPath, 'OUTSIDE_SENTINEL_UNCHANGED\n', 'utf8')
      await symlink(
        outsideFixtures,
        path.join(repositoryFixture, 'tests', 'fixtures'),
        'junction'
      )

      const [stdout, stderr, exitCode] = await runProofFile(copiedScript)
      expect(exitCode).not.toBe(0)
      expect(stdout).toBe('')
      expect(stderr.replace(/\r\n/g, '\n')).toBe(
        'Boundary P-02 synthetic MySQL proof failed.\n'
      )
      expect(await Bun.file(sentinelPath).text()).toBe(
        'OUTSIDE_SENTINEL_UNCHANGED\n'
      )
      expect(`${stdout}${stderr}`).not.toContain(sentinelPath)
    } finally {
      await rm(ownerDirectory, { force: true, recursive: true })
    }
  }, 15_000)

  test('has only fixed console output and no diagnostic or log adapter', async () => {
    const source = await Bun.file(scriptPath).text()
    const consoleLines = source.match(/\[Console\]::(?:Out|Error)\.WriteLine\([^\n]+/g)
    expect(consoleLines).toHaveLength(2)
    expect(source).not.toMatch(
      /DIAGNOSTIC_(CODE|STAGE|OUTPUT)|Write-Host|Write-Output|docker\s+logs|'logs'/i
    )
    const argumentCheck = source.indexOf('$scriptArguments.Count')
    const environmentCheck = source.indexOf('foreach ($key in $forbiddenEnvironmentKeys)')
    const dockerResolution = source.indexOf('Get-Command docker.exe')
    expect(argumentCheck).toBeGreaterThan(0)
    expect(environmentCheck).toBeGreaterThan(argumentCheck)
    expect(dockerResolution).toBeGreaterThan(environmentCheck)
  })
})
