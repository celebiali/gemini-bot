import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface MonthlyPaymentSchedule {
  month: number // 1, 2, 3
  dueDate: string
  status: 'paid' | 'upcoming' | 'due'
  description: string
}

export interface GeminiAccount {
  id: string
  email: string
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

const DB_PATH = join(process.cwd(), 'data', 'accounts.json')

function ensureDbExists() {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) {
    const fs = require('fs')
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify([], null, 2), 'utf-8')
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
  writeFileSync(DB_PATH, JSON.stringify(accounts, null, 2), 'utf-8')
  return account
}

export function getActiveAccount(): GeminiAccount | null {
  const accounts = getAccounts()
  return accounts.find(a => a.status === 'active') || accounts[0] || null
}
