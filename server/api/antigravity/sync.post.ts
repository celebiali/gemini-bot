import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getActiveAccount } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const account = getActiveAccount()

  if (!account) {
    return { success: false, error: 'Aktif hesabı bulunamadı.' }
  }

  // Create an environment/config export file for Antigravity & local tools
  const antigravityConfigDir = join(process.env.HOME || '/Users/alirizacelebi', '.gemini', 'config')
  const configExportPath = join(process.cwd(), 'data', 'antigravity_gemini_config.env')

  const envContent = `# Gemini Bot - Antigravity Active Account Credentials
# Generated on ${new Date().toLocaleString()}
GEMINI_ACTIVE_EMAIL="${account.email}"
GEMINI_PLAN="${account.geminiPlan}"
GEMINI_EXPIRES="${account.expiresDate}"
GEMINI_STATUS="${account.status}"
`

  try {
    writeFileSync(configExportPath, envContent, 'utf-8')

    // If local Antigravity user config exists, write active info
    if (existsSync(antigravityConfigDir)) {
      const activeFile = join(antigravityConfigDir, 'active_gemini_account.json')
      writeFileSync(activeFile, JSON.stringify(account, null, 2), 'utf-8')
    }

    return {
      success: true,
      message: 'Antigravity konfigürasyonu ve aktif hesap bilgileri güncellendi!',
      accountEmail: account.email,
      configExportPath,
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Güncelleme hatası' }
  }
})
