import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildInventoryDraft,
  canonicalDocument,
} from './agency-authority-inventory-lib'

if (process.argv.length !== 2) process.exit(1)

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const parent = 'c6e989f8fb62bd99f28a2c537c57f4d85d069c72'

process.stdout.write(canonicalDocument(buildInventoryDraft(repositoryRoot, parent)))
