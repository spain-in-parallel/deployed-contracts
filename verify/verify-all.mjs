/* Self-contained bytecode verifier for the Spanish Rail contracts.
 *
 *   node verify-all.mjs                 # verify all folders vs Base Sepolia
 *   RPC_URL=<url> node verify-all.mjs   # or against another RPC / a fork
 *
 * Depends only on Node + this folder's local `ethers` and the golden
 * references stored next to each contract (`<NN>-contractName/onchain-expected.json`).
 * Each golden reference is the runtime bytecode that was verified byte-for-byte
 * against the Rarimo source at capture time.
 *
 * For each contract it reads on-chain `getCode`, and for UUPS proxies
 * resolves the EIP-1967 implementation and checks the impl. It normalizes the
 * two per-deployment artifacts that are NOT logic (external library link
 * addresses; the UUPS `__self = address(this)` immutable) and strips the solc
 * metadata trailer, so the match is logic-exact.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ethers } from 'ethers';

const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

const provider = new ethers.JsonRpcProvider(RPC);

const norm = (h) => (h.startsWith('0x') ? h.slice(2) : h).toLowerCase();
function stripMeta(h) {
  if (h.length < 4) return h;
  const n = parseInt(h.slice(-4), 16);
  const t = (n + 2) * 2;
  return t < h.length ? h.slice(0, h.length - t) : h;
}
async function implOf(proxy) {
  const raw = await provider.getStorage(proxy, IMPL_SLOT);
  return ethers.getAddress('0x' + raw.slice(-40));
}

const folders = readdirSync(ROOT).filter((d) => /^\d\d-/.test(d)).sort();
const rows = [];
let ok = 0;

for (const f of folders) {
  let rec;
  try { rec = JSON.parse(readFileSync(join(ROOT, f, 'onchain-expected.json'), 'utf8')); }
  catch { rows.push([f, '⚠️ no reference', '']); continue; }

  let verdict = '❌ DIFFERS', note = '';
  try {
    if (rec.proxy && rec.proxyExpected) {
      const onPx = norm(await provider.getCode(rec.address));
      if (stripMeta(onPx) !== stripMeta(norm(rec.proxyExpected))) {
        rows.push([f, '❌ proxy differs', '']); continue;
      }
    }
    const target = rec.proxy ? await implOf(rec.address) : rec.address;
    let on = norm(await provider.getCode(target));
    for (const [start, len] of (rec.linkOffsets || [])) {
      const s = start * 2, l = len * 2;
      on = on.slice(0, s) + '0'.repeat(l) + on.slice(s + l);
    }
    let selfN = 0;
    if (rec.proxy) {
      const a = target.slice(2).toLowerCase();
      selfN = on.split(a).length - 1;
      if (selfN > 0) on = on.split(a).join('0'.repeat(40));
    }
    const exp = norm(rec.implExpected);
    if (on === exp) verdict = '✓ EXACT';
    else if (stripMeta(on) === stripMeta(exp) && stripMeta(on).length > 0) verdict = '✓ MODULO-META';
    else {
      let i = 0; const A = stripMeta(on), B = stripMeta(exp);
      while (i < A.length && i < B.length && A[i] === B[i]) i++;
      note = `diverge @byte ${Math.floor(i / 2)} (on ${A.length / 2}B vs exp ${B.length / 2}B)`;
    }
    if (verdict.startsWith('✓')) {
      const bits = [];
      if (rec.proxy) bits.push('proxy✓');
      if ((rec.linkOffsets || []).length) bits.push(`${rec.linkOffsets.length}lib`);
      if (selfN) bits.push(`__self×${selfN}`);
      note = bits.join(' ');
    }
  } catch (e) { note = e.message; }

  if (verdict.startsWith('✓')) ok++;
  rows.push([f, verdict, note]);
}

const w = Math.max(...rows.map((r) => r[0].length));
console.log(`\nBytecode verification vs Base Sepolia\n  RPC: ${RPC}\n`);
for (const [f, v, n] of rows) console.log(`  ${f.padEnd(w)}  ${v.padEnd(15)} ${n}`);
console.log(`\n  ${ok}/${rows.length} verified.\n`);
process.exit(ok === rows.length ? 0 : 1);
