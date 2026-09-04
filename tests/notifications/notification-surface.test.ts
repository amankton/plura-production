import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  verifyB5A2BSourceSnapshot,
  type B5A2BSourceSnapshot,
} from '../../scripts/verify-b5a2b-notification-boundary'

const root = process.cwd()

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const sourceFiles = walk(join(root, 'src')).filter((path) => /\.tsx?$/.test(path))
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const sourceSnapshot = (): B5A2BSourceSnapshot => ({
  activityFoundation: read(
    'src/features/notifications/activity-foundation-service.ts'
  ),
  agencyLayout: read('src/app/(main)/agency/[agencyId]/layout.tsx'),
  infoBar: read('src/components/global/infobar.tsx'),
  notificationView: read(
    'src/features/notifications/notification-view-service.ts'
  ),
  serverView: read(
    'src/features/notifications/server-notification-view-service.ts'
  ),
  sourceText: sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n'),
  subaccountLayout: read(
    'src/app/(main)/subaccount/[subaccountId]/layout.tsx'
  ),
})

describe('B5A2B notification surface', () => {
  test('retires both legacy exports and the complete temporary name chain', () => {
    const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
    for (const retired of [
      'getNotificationAndUser',
      'saveActivityLogsNotification',
      'legacyActivityActorName',
      'listLegacyActorNames',
      'getLegacyActorName',
      'includeLegacyName',
    ]) {
      expect(source.includes(retired)).toBe(false)
    }
    expect(/\buserName\b/.test(source)).toBe(false)
  })

  test('keeps the activity foundation unreachable from production', () => {
    const importers = sourceFiles.filter((path) => {
      const normalized = relative(root, path).replaceAll('\\', '/')
      return normalized !==
        'src/features/notifications/activity-foundation-service.ts' &&
        readFileSync(path, 'utf8').includes('activity-foundation-service')
    })
    expect(importers).toEqual([])

    const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
    expect(/db\.notification\.(create|createMany|update|upsert)/.test(source)).toBe(
      false
    )
    expect(source.includes('FOUNDATION_VALIDATION_ONLY')).toBe(false)
  })

  test('binds the two server-only persistence predicates and fixed bound', () => {
    const source = read(
      'src/features/notifications/server-notification-view-service.ts'
    )
    expect(source.startsWith("import 'server-only'")).toBe(true)
    expect((source.match(/take: 101/g) ?? []).length).toBe(2)
    expect(
      (
        source.match(
          /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/g
        ) ?? []
      ).length
    ).toBe(2)
    expect(source.includes('subAccountId: subaccountId')).toBe(true)
    expect(source.includes('User: { agencyId }')).toBe(true)
    expect(source.includes("const agencyAction = 'notification:view-agency'")).toBe(
      true
    )
  })

  test('has exactly the three declared production modules', () => {
    const files = readdirSync(join(root, 'src/features/notifications')).sort()
    expect(files).toEqual([
      'activity-foundation-service.ts',
      'notification-view-service.ts',
      'server-notification-view-service.ts',
    ])
  })

  test('passes the fixed verifier and rejects arguments', () => {
    const pass = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2b-notification-boundary.ts',
    ])
    expect(pass.exitCode).toBe(0)
    expect(pass.stderr.toString()).toBe('')
    expect(pass.stdout.toString()).toBe(
      'B5A2B_PASS records=2 readers=2 writer_imports=16 writer_calls=18 legacy_files=8 feed_limit=100 production_events=0\n'
    )

    const denied = Bun.spawnSync([
      process.execPath,
      'scripts/verify-b5a2b-notification-boundary.ts',
      'unexpected',
    ])
    expect(denied.exitCode).toBe(1)
    expect(denied.stdout.toString()).toBe('')
    expect(denied.stderr.toString()).toBe('B5A2B_FAIL argument-count\n')
  }, 15_000)

  test('rejects fixed authority, DTO, reachability, and policy mutations', () => {
    const baseline = sourceSnapshot()
    expect(verifyB5A2BSourceSnapshot(baseline)).toEqual([])
    const mutations: Array<Readonly<{
      label: string
      snapshot: B5A2BSourceSnapshot
    }>> = [
      {
        label: 'legacy alias',
        snapshot: {
          ...baseline,
          sourceText: `${baseline.sourceText}\ngetNotificationAndUser()`,
        },
      },
      {
        label: 'foundation importer',
        snapshot: {
          ...baseline,
          sourceText:
            `${baseline.sourceText}\n` +
            "import { createActivityFoundationService } from '@/features/notifications/activity-foundation-service'",
        },
      },
      {
        label: 'notification write',
        snapshot: {
          ...baseline,
          sourceText: `${baseline.sourceText}\ndb.notification.create({})`,
        },
      },
      {
        label: 'broad type',
        snapshot: {
          ...baseline,
          notificationView: `${baseline.notificationView}\ntype Drift = any`,
        },
      },
      {
        label: 'raw log',
        snapshot: {
          ...baseline,
          serverView: `${baseline.serverView}\nconsole.error('drift')`,
        },
      },
      {
        label: 'extra runtime export',
        snapshot: {
          ...baseline,
          notificationView:
            `${baseline.notificationView}\nexport const drift = () => null`,
        },
      },
      {
        label: 'server-only removed',
        snapshot: {
          ...baseline,
          serverView: baseline.serverView.replace("import 'server-only'", ''),
        },
      },
      {
        label: 'silent truncation',
        snapshot: {
          ...baseline,
          serverView: baseline.serverView.replace('take: 101', 'take: 100'),
        },
      },
      {
        label: 'unstable order',
        snapshot: {
          ...baseline,
          serverView: baseline.serverView.replace(
            "orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]",
            "orderBy: [{ createdAt: 'desc' }]"
          ),
        },
      },
      {
        label: 'caller action',
        snapshot: {
          ...baseline,
          serverView: `${baseline.serverView}\nconst requestedAction = input.action`,
        },
      },
      {
        label: 'reader bypass',
        snapshot: {
          ...baseline,
          subaccountLayout: baseline.subaccountLayout.replace(
            'notificationViewService.getSubaccountFeed(',
            'notificationViewService.getAgencyFeed('
          ),
        },
      },
      {
        label: 'HTML rendering',
        snapshot: {
          ...baseline,
          infoBar: `${baseline.infoBar}\n<div dangerouslySetInnerHTML={{}} />`,
        },
      },
      {
        label: 'foundation runtime import',
        snapshot: {
          ...baseline,
          activityFoundation:
            "import { db } from '@/lib/db'\n" + baseline.activityFoundation,
        },
      },
      {
        label: 'production event',
        snapshot: {
          ...baseline,
          activityFoundation:
            `${baseline.activityFoundation}\nconst event = 'AGENCY_UPDATED'`,
        },
      },
      {
        label: 'input key drift',
        snapshot: {
          ...baseline,
          activityFoundation: baseline.activityFoundation.replace(
            "['context', 'event', 'label', 'receipt']",
            "['context', 'event', 'message', 'receipt']"
          ),
        },
      },
    ]

    for (const mutation of mutations) {
      expect(
        verifyB5A2BSourceSnapshot(mutation.snapshot).length,
        mutation.label
      ).toBeGreaterThan(0)
    }
  })
})
