import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), "data", "accounts.json");
function ensureDbExists() {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) {
    const fs = require("fs");
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}
function getAccounts() {
  ensureDbExists();
  try {
    const raw = readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveAccount(account) {
  const accounts = getAccounts();
  const index = accounts.findIndex((a) => a.id === account.id);
  if (index >= 0) {
    accounts[index] = account;
  } else {
    accounts.unshift(account);
  }
  ensureDbExists();
  writeFileSync(DB_PATH, JSON.stringify(accounts, null, 2), "utf-8");
  return account;
}
function getActiveAccount() {
  const accounts = getAccounts();
  return accounts.find((a) => a.status === "active") || accounts[0] || null;
}

export { getActiveAccount as a, getAccounts as g, saveAccount as s };
//# sourceMappingURL=db.mjs.map
