import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'

const scriptPath = 'scripts/verify-b4f2b-p02-synthetic-mysql.ps1'
const fixturePath = 'tests/fixtures/mysql/b4f2b-p02-synthetic-schema.sql'
const evidencePath = 'docs/evidence/CF-P1-B4F2B-P02-synthetic-mysql.json'

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
    expect(source).toContain("'volume', 'inspect', $anonymousVolume")
    expect(source).toContain(
      "'ps', '--all', '--quiet', '--filter', \"label=$proofLabel\""
    )
    expect(source).not.toMatch(/'--publish'|'--mount'|'--volume'\s*,/)
    expect(source).not.toMatch(/'volume',\s*'(rm|prune)'|'container',\s*'prune'/)
    expect(source).not.toMatch(/docker\s+(rm|volume\s+rm|system\s+prune)/i)
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
  })

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
  })

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
