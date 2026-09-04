import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

type CommandResult = {
  exitCode: number
  stderr: string
  stdout: string
}

const run = async (command: string[]): Promise<CommandResult> => {
  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { exitCode, stderr, stdout }
}

const normalize = (value: string) =>
  `${value.replace(/\r\n/g, '\n').trimEnd()}\n`

const hash = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex')

const main = async () => {
  const repositoryRoot = process.cwd()
  const evidenceDirectory = path.join(repositoryRoot, 'docs', 'evidence')
  await mkdir(evidenceDirectory, { recursive: true })

  const inventoryResult = await run(['bun', 'pm', 'ls', '--all'])
  if (inventoryResult.exitCode !== 0) {
    throw new Error('Could not generate the installed dependency inventory')
  }
  const inventory = normalize(inventoryResult.stdout).replace(
    /^.+ node_modules$/m,
    '. node_modules'
  )
  const lock = await Bun.file(path.join(repositoryRoot, 'bun.lockb')).bytes()
  const packageManifest = normalize(
    await Bun.file(path.join(repositoryRoot, 'package.json')).text()
  )
  const lockSha256 = hash(lock)
  const sealedEvidence = JSON.parse(
    await Bun.file(
      path.join(evidenceDirectory, 'CF-P1-B4F1-dependency-evidence.json')
    ).text()
  ) as {
    audit: {
      severity: { critical: number; high: number; low: number; moderate: number }
      total: number
    }
    artifacts: { audit: { path: string; sha256: string }; lockfile: { sha256: string } }
  }
  if (sealedEvidence.artifacts.lockfile.sha256 !== lockSha256) {
    throw new Error('Current lockfile does not match the sealed B4F1 audit')
  }
  const outage = normalize(
    await Bun.file(
      path.join(evidenceDirectory, 'CF-P1-B4F2A2-audit-outage.json')
    ).text()
  )

  const summary = {
    audit: {
      currentQuery: 'INCONCLUSIVE_REGISTRY_UNAVAILABLE',
      disposition:
        'Release and public-runtime HOLD until a fresh authoritative advisory query succeeds or a separately reviewed change-control amendment is accepted.',
      fresh: false,
      provenance: 'SEALED_B4F1_SAME_LOCK_STALE_UNREVALIDATED',
      sealedBaseline: {
        artifact: sealedEvidence.artifacts.audit,
        severity: sealedEvidence.audit.severity,
        sourceCommit: '0da47545c1a8d2ec833f89c36030b9e182349fc8',
        sourceCommitTimestamp: '2026-09-03T17:46:44-07:00',
        total: sealedEvidence.audit.total,
      },
    },
    artifacts: {
      auditOutage: {
        path: 'docs/evidence/CF-P1-B4F2A2-audit-outage.json',
        sha256: hash(outage),
      },
      installedDependencyInventory: {
        path: 'docs/evidence/CF-P1-B4F2A2-sbom.txt',
        sha256: hash(inventory),
      },
      lockfile: { path: 'bun.lockb', sha256: lockSha256 },
      packageManifest: { path: 'package.json', sha256: hash(packageManifest) },
    },
    command: {
      audit:
        'No fresh result: bounded native Bun, official Bun container, and direct npm bulk POST attempts returned no advisory JSON.',
      installedDependencyInventory: 'bun pm ls --all',
    },
    format: 'Crewframe installed-component inventory and audit evidence v1',
    hashNormalization: 'UTF-8, LF line endings, one trailing newline',
  }

  await Promise.all([
    Bun.write(
      path.join(evidenceDirectory, 'CF-P1-B4F2A2-sbom.txt'),
      inventory
    ),
    Bun.write(
      path.join(
        evidenceDirectory,
        'CF-P1-B4F2A2-dependency-evidence.json'
      ),
      `${JSON.stringify(summary, null, 2)}\n`
    ),
  ])
  console.log(
    `PASS B4F2A2 same-lock evidence: audit STALE_UNREVALIDATED; SBOM SHA-256 ${summary.artifacts.installedDependencyInventory.sha256}`
  )
}

void main()
