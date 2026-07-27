import { d as defineEventHandler } from '../../nitro/nitro.mjs';
import { g as getAccounts, a as getActiveAccount } from '../../_/db.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'fs';
import 'path';

const index_get = defineEventHandler(() => {
  const accounts = getAccounts();
  const active = getActiveAccount();
  return {
    accounts,
    activeAccount: active
  };
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
