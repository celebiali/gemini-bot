import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface MonthlyPaymentSchedule {
  month: number // 1, 2, 3
  dueDate: string
  status: 'paid' | 'upcoming' | 'due'
  description: string
}

export interface GeminiAccount {
  id: string
  email: string
  password?: string
  passwordHash?: string
  recoveryEmail?: string
  createdDate: string
  expiresDate: string
  monthlyPayments: MonthlyPaymentSchedule[]
  status: 'active' | 'expired' | 'pending_payment'
  geminiPlan: string
  antigravitySynced: boolean
  youtubeSynced: boolean
  notes?: string
}

function getDbPath(): string {
  try {
    const defaultDir = join(process.cwd(), 'data')
    if (!existsSync(defaultDir)) {
      mkdirSync(defaultDir, { recursive: true })
    }
    return join(defaultDir, 'accounts.json')
  } catch {
    // Fallback to /tmp on serverless environments like Vercel
    const tmpDir = tmpdir()
    return join(tmpDir, 'gemini_accounts.json')
  }
}

const DB_PATH = getDbPath()

function ensureDbExists() {
  try {
    if (!existsSync(DB_PATH)) {
      writeFileSync(DB_PATH, JSON.stringify([], null, 2), 'utf-8')
    }
  } catch {
    // Graceful error handling
  }
}

export function getAccounts(): GeminiAccount[] {
  ensureDbExists()
  try {
    const raw = readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw) as GeminiAccount[]
  } catch {
    return []
  }
}

export function saveAccount(account: GeminiAccount): GeminiAccount {
  const accounts = getAccounts()
  const index = accounts.findIndex(a => a.id === account.id)
  if (index >= 0) {
    accounts[index] = account
  } else {
    accounts.unshift(account)
  }
  ensureDbExists()
  try {
    writeFileSync(DB_PATH, JSON.stringify(accounts, null, 2), 'utf-8')
  } catch {
    // Graceful write handling
  }
  return account
}

export function getActiveAccount(): GeminiAccount | null {
  const accounts = getAccounts()
  return accounts.find(a => a.status === 'active') || accounts[0] || null
}

