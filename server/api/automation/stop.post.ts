import { playwrightWorker } from '../../utils/playwrightWorker'

export default defineEventHandler(async () => {
  await playwrightWorker.stopAutomation()
  return { success: true }
})
