import { d as defineEventHandler, r as readBody } from '../../../nitro/nitro.mjs';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { a as getActiveAccount } from '../../../_/db.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';

const sync_post = defineEventHandler(async (event) => {
  await readBody(event).catch(() => ({}));
  const account = getActiveAccount();
  if (!account) {
    return { success: false, error: "Aktif hesab\u0131 bulunamad\u0131." };
  }
  const antigravityConfigDir = join(process.env.HOME || "/Users/alirizacelebi", ".gemini", "config");
  const configExportPath = join(process.cwd(), "data", "antigravity_gemini_config.env");
  const envContent = `# Gemini Bot - Antigravity Active Account Credentials
# Generated on ${(/* @__PURE__ */ new Date()).toLocaleString()}
GEMINI_ACTIVE_EMAIL="${account.email}"
GEMINI_PLAN="${account.geminiPlan}"
GEMINI_EXPIRES="${account.expiresDate}"
GEMINI_STATUS="${account.status}"
`;
  try {
    writeFileSync(configExportPath, envContent, "utf-8");
    if (existsSync(antigravityConfigDir)) {
      const activeFile = join(antigravityConfigDir, "active_gemini_account.json");
      writeFileSync(activeFile, JSON.stringify(account, null, 2), "utf-8");
    }
    return {
      success: true,
      message: "Antigravity konfig\xFCrasyonu ve aktif hesap bilgileri g\xFCncellendi!",
      accountEmail: account.email,
      configExportPath
    };
  } catch (err) {
    return { success: false, error: (err == null ? void 0 : err.message) || "G\xFCncelleme hatas\u0131" };
  }
});

export { sync_post as default };
//# sourceMappingURL=sync.post.mjs.map
