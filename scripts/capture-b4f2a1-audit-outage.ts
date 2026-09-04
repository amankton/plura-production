import { randomUUID } from 'node:crypto'
import path from 'node:path'

type Attempt = {
  advisoryJsonBytes: number
  advisoryJsonReceived: boolean
  command: string
  durationMilliseconds: number
  exitCode: number | null
  finishedAt: string
  label: string
  outputBytes: number
  sanitizedOutput: string
  startedAt: string
  timedOut: boolean
  timeoutMilliseconds: number
}

const timeoutMilliseconds = 15_000

const sanitize = (value: string) =>
  value
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, 500)

const runAttempt = async (
  label: string,
  command: string[]
): Promise<Attempt> => {
  const started = Date.now()
  const startedAt = new Date(started).toISOString()
  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const output = Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  let timer: ReturnType<typeof setTimeout> | undefined
  const result = await Promise.race([
    child.exited.then((exitCode) => ({ exitCode, timedOut: false })),
    new Promise<{ exitCode: null; timedOut: true }>((resolve) => {
      timer = setTimeout(
        () => resolve({ exitCode: null, timedOut: true }),
        timeoutMilliseconds
      )
    }),
  ])
  if (timer) clearTimeout(timer)
  if (result.timedOut) {
    child.kill()
    await child.exited.catch(() => undefined)
  }
  const [stdout, stderr] = await output
  const combined = `${stdout}${stderr}`
  const advisoryJsonReceived = /^\s*\{/.test(stdout)
  const finished = Date.now()
  return {
    advisoryJsonBytes: advisoryJsonReceived ? Buffer.byteLength(stdout) : 0,
    advisoryJsonReceived,
    command: command.join(' ').replaceAll(process.cwd(), '<repository>'),
    durationMilliseconds: finished - started,
    exitCode: result.exitCode,
    finishedAt: new Date(finished).toISOString(),
    label,
    outputBytes: Buffer.byteLength(combined),
    sanitizedOutput: sanitize(combined),
    startedAt,
    timedOut: result.timedOut,
    timeoutMilliseconds,
  }
}

const main = async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const containerName = `crewframe-b4f2a1-audit-${suffix}`
  const attempts: Attempt[] = []

  attempts.push(await runAttempt('native_bun', ['bun', 'audit', '--json']))
  try {
    attempts.push(
      await runAttempt('official_bun_container', [
        'docker',
        'run',
        '--rm',
        '--name',
        containerName,
        '--volume',
        `${process.cwd()}:/workspace`,
        '--workdir',
        '/workspace',
        'oven/bun:1.3.11',
        'bun',
        'audit',
        '--json',
      ])
    )
  } finally {
    const cleanup = Bun.spawn(
      ['docker', 'rm', '--force', containerName],
      { stderr: 'ignore', stdout: 'ignore' }
    )
    await cleanup.exited
  }
  attempts.push(
    await runAttempt('direct_npm_bulk_post', [
      'curl.exe',
      '--silent',
      '--show-error',
      '--max-time',
      '15',
      '--request',
      'POST',
      '--header',
      'Content-Type: application/json',
      '--data-binary',
      '{}',
      'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
    ])
  )

  const evidence = {
    attempts,
    conclusion:
      'STALE_UNREVALIDATED: no attempt returned advisory JSON; current vulnerability data is unavailable.',
    format: 'Crewframe dependency-audit service outage evidence v1',
    image: 'oven/bun:1.3.11@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7',
  }
  const outputPath = path.join(
    process.cwd(),
    'docs',
    'evidence',
    'CF-P1-B4F2A1-audit-outage.json'
  )
  await Bun.write(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)

  if (attempts.some((attempt) => attempt.advisoryJsonReceived)) {
    throw new Error('An attempt returned advisory data; run the fresh audit')
  }
  console.log('PASS captured three bounded audit-service outage attempts')
}

void main()
