import { playwrightWorker } from '../../utils/playwrightWorker'

export default defineEventHandler(() => {
  return playwrightWorker.getState()
})
