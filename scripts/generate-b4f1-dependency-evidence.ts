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

  const auditResult = await run(['bun', 'audit', '--json'])
  if (auditResult.exitCode !== 0 && auditResult.exitCode !== 1) {
    throw new Error('The dependency audit did not return a supported result')
  }
  const auditReport = JSON.parse(auditResult.stdout) as Record<
    string,
    Array<{ id: number; severity: 'critical' | 'high' | 'low' | 'moderate' }>
  >
  const severity = { critical: 0, high: 0, low: 0, moderate: 0 }
  for (const advisories of Object.values(auditReport)) {
    for (const advisory of advisories) severity[advisory.severity] += 1
  }
  const total = Object.values(severity).reduce((sum, count) => sum + count, 0)
  const audit = `${JSON.stringify(auditReport, null, 2)}\n`
  const lock = await Bun.file(path.join(repositoryRoot, 'bun.lockb')).bytes()

  const summary = {
    audit: {
      baselineTotal: 63,
      disposition:
        'Inherited release blocker pending the dependency-upgrade checkpoint; B4F1 does not authorize dependency or lockfile changes.',
      nonRegression: total <= 63,
      severity,
      total,
    },
    artifacts: {
      audit: {
        path: 'docs/evidence/CF-P1-B4F1-audit.json',
        sha256: hash(audit),
      },
      installedDependencyInventory: {
        path: 'docs/evidence/CF-P1-B4F1-sbom.txt',
        sha256: hash(inventory),
      },
      lockfile: {
        path: 'bun.lockb',
        sha256: hash(lock),
      },
    },
    command: {
      audit: 'bun audit --json',
      installedDependencyInventory: 'bun pm ls --all',
    },
    format: 'Crewframe installed-component inventory and audit evidence v1',
    hashNormalization: 'UTF-8, LF line endings, one trailing newline',
  }

  await Promise.all([
    Bun.write(
      path.join(evidenceDirectory, 'CF-P1-B4F1-sbom.txt'),
      inventory
    ),
    Bun.write(path.join(evidenceDirectory, 'CF-P1-B4F1-audit.json'), audit),
    Bun.write(
      path.join(evidenceDirectory, 'CF-P1-B4F1-dependency-evidence.json'),
      `${JSON.stringify(summary, null, 2)}\n`
    ),
  ])

  if (!summary.audit.nonRegression) {
    throw new Error(
      `Dependency audit regressed from 63 to ${summary.audit.total} advisories`
    )
  }

  console.log(
    `PASS dependency evidence: ${total} advisories; SBOM SHA-256 ${summary.artifacts.installedDependencyInventory.sha256}`
  )
}

void main()
