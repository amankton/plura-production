import { AccessError } from '@/lib/auth/access-error'

export type ActivityEventDefinition = Readonly<{
  render: (label: string | null) => string
  requiresLabel: boolean
  scope: 'AGENCY' | 'SUBACCOUNT'
}>

export type ActivityFoundationContext = Readonly<{
  actorId: string
  agencyId: string
  subaccountId: string | null
}>

export type AuthoritativeMutationReceipt = Readonly<{
  affectedRows: number
  agencyId: string
  operationId: string
  stale: boolean
  subaccountId: string | null
}>

export type ActivityFoundationStore = Readonly<{
  createOnce: (input: Readonly<{
    actorId: string
    agencyId: string
    event: string
    message: string
    operationId: string
    subaccountId: string | null
  }>) => Promise<'CONFLICT' | 'CREATED' | 'DUPLICATE'>
}>

type ActivityFoundationDependencies = Readonly<{
  registry: ReadonlyMap<string, ActivityEventDefinition>
  store: ActivityFoundationStore
}>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
}

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === value &&
  value.length > 0 && value.length <= 128

const isNullableIdentifier = (value: unknown): value is string | null =>
  value === null || isIdentifier(value)

const parseContext = (value: unknown): ActivityFoundationContext => {
  if (!isRecord(value) || !hasExactKeys(value, ['actorId', 'agencyId', 'subaccountId'])) {
    throw new AccessError('FORBIDDEN')
  }
  if (
    !isIdentifier(value.actorId) ||
    !isIdentifier(value.agencyId) ||
    !isNullableIdentifier(value.subaccountId)
  ) {
    throw new AccessError('FORBIDDEN')
  }
  return {
    actorId: value.actorId,
    agencyId: value.agencyId,
    subaccountId: value.subaccountId,
  }
}

const parseReceipt = (value: unknown): AuthoritativeMutationReceipt => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'affectedRows',
      'agencyId',
      'operationId',
      'stale',
      'subaccountId',
    ]) ||
    value.affectedRows !== 1 ||
    !isIdentifier(value.agencyId) ||
    !isIdentifier(value.operationId) ||
    typeof value.stale !== 'boolean' ||
    value.stale ||
    !isNullableIdentifier(value.subaccountId)
  ) {
    throw new AccessError('CONFLICT')
  }
  return {
    affectedRows: value.affectedRows,
    agencyId: value.agencyId,
    operationId: value.operationId,
    stale: value.stale,
    subaccountId: value.subaccountId,
  }
}

const parseLabel = (value: unknown, required: boolean) => {
  if (!required && (value === undefined || value === null)) return null
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    Array.from(value).length > 128 ||
    /[|\r\n\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new AccessError('CONFLICT')
  }
  return value
}

export const createActivityFoundationService = ({
  registry,
  store,
}: ActivityFoundationDependencies) => ({
  record: async (rawInput: unknown) => {
    if (
      !isRecord(rawInput) ||
      !hasExactKeys(rawInput, ['context', 'event', 'label', 'receipt']) ||
      typeof rawInput.event !== 'string'
    ) {
      throw new AccessError('FORBIDDEN')
    }

    const definition = registry.get(rawInput.event)
    if (!definition) throw new AccessError('FORBIDDEN')
    const context = parseContext(rawInput.context)
    const receipt = parseReceipt(rawInput.receipt)
    const label = parseLabel(rawInput.label, definition.requiresLabel)

    if (
      receipt.agencyId !== context.agencyId ||
      receipt.subaccountId !== context.subaccountId ||
      (definition.scope === 'AGENCY' && context.subaccountId !== null) ||
      (definition.scope === 'SUBACCOUNT' && context.subaccountId === null)
    ) {
      throw new AccessError('CONFLICT')
    }

    let message: string
    try {
      message = definition.render(label)
    } catch {
      throw new AccessError('CONFLICT')
    }
    if (
      typeof message !== 'string' ||
      message.length === 0 ||
      Array.from(message).length > 1024 ||
      /[\r\n\u0000-\u001f\u007f]/.test(message)
    ) {
      throw new AccessError('CONFLICT')
    }

    let result: Awaited<ReturnType<ActivityFoundationStore['createOnce']>>
    try {
      result = await store.createOnce({
        actorId: context.actorId,
        agencyId: context.agencyId,
        event: rawInput.event,
        message,
        operationId: receipt.operationId,
        subaccountId: context.subaccountId,
      })
    } catch {
      throw new AccessError('CONFLICT')
    }
    if (result === 'CREATED' || result === 'DUPLICATE') return result
    throw new AccessError('CONFLICT')
  },
})
