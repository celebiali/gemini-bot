import { getAccounts, getActiveAccount } from '../../utils/db'

export default defineEventHandler(() => {
  const accounts = getAccounts()
  const active = getActiveAccount()
  return {
    accounts,
    activeAccount: active,
  }
})
