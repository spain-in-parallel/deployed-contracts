/* Verify deployed runtime bytecode against a locally-compiled artifact.
 *
 *   node verify-bytecode.mjs <address> <artifact.json> [--impl]
 *
 * - Fetches on-chain runtime code (eth_getCode) on Base Sepolia.
 * - Loads the artifact's deployedBytecode (Hardhat/Foundry shapes).
 * - Strips the trailing CBOR metadata from BOTH (solc appends an ipfs/bzzr hash
 *   of the source+settings; it differs unless the build is byte-reproduced).
 * - Reports: EXACT (full match) / MODULO-METADATA (logic identical, only the
 *   metadata hash differs) / DIFFERS.
 * - With --impl, first resolves the EIP-1967 implementation slot and verifies
 *   the IMPLEMENTATION's code (for UUPS/ERC1967 proxies).
 */
import { ethers } from 'ethers';
import { readFileSync } from 'node:fs';

const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const [addrArg, artifactPath, ...flags] = process.argv.slice(2);
if (!addrArg || !artifactPath) {
  console.error('usage: node verify-bytecode.mjs <address> <artifact.json> [--impl]');
  process.exit(1);
}
const resolveImpl = flags.includes('--impl');

const provider = new ethers.JsonRpcProvider(RPC, 84532, { staticNetwork: true });

// strip the CBOR metadata trailer: last 2 bytes = its length in bytes.
function stripMeta(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length < 4) return h;
  const cborLen = parseInt(h.slice(-4), 16);
  const trailer = (cborLen + 2) * 2; // metadata bytes + the 2 length bytes
  if (trailer >= h.length) return h;
  return h.slice(0, h.length - trailer);
}

function artifactDeployed(a) {
  // Hardhat: deployedBytecode is a "0x.." string. Foundry: {deployedBytecode:{object}}.
  const d = a.deployedBytecode;
  if (typeof d === 'string') return d;
  if (d && typeof d.object === 'string') return d.object;
  throw new Error('artifact has no deployedBytecode');
}

let address = ethers.getAddress(addrArg);

if (resolveImpl) {
  const raw = await provider.getStorage(address, EIP1967_IMPL_SLOT);
  const impl = ethers.getAddress('0x' + raw.slice(-40));
  console.log(`proxy   : ${address}`);
  console.log(`impl slot -> ${impl}`);
  if (impl === ethers.ZeroAddress) { console.error('  ⚠️ impl slot is zero — not an EIP-1967 proxy?'); process.exit(2); }
  address = impl;
}

const onchain = await provider.getCode(address);
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
const local = artifactDeployed(artifact);

let onRaw = (onchain.startsWith('0x') ? onchain.slice(2) : onchain).toLowerCase();
let locBc = (local.startsWith('0x') ? local.slice(2) : local).toLowerCase();

// External library links: the artifact carries `__$hash$__` placeholders at
// fixed offsets (deployedLinkReferences); on-chain has the real linked library
// address. Pull it from on-chain and write it into the local placeholder so we
// compare CODE, not the per-deployment library address.
let linksApplied = 0;
const links = artifact.deployedLinkReferences || {};
for (const file of Object.keys(links))
  for (const lib of Object.keys(links[file]))
    for (const ref of links[file][lib]) {
      const s = ref.start * 2, len = ref.length * 2;
      locBc = locBc.slice(0, s) + onRaw.slice(s, s + len) + locBc.slice(s + len);
      linksApplied++;
    }

// UUPS impls bake `__self = address(this)` as an immutable → on-chain has the
// impl address where the artifact has zeros. Normalize it out (safe: it's the
// contract's own address, not logic). Only when we resolved an impl.
let immutablesNormalized = 0;
if (resolveImpl) {
  const a = address.slice(2).toLowerCase();
  immutablesNormalized = (onRaw.split(a).length - 1);
  if (immutablesNormalized > 0) onRaw = onRaw.split(a).join('0'.repeat(40));
}
const onFull = onRaw;
const locFull = locBc;
const onStrip = stripMeta(onFull);
const locStrip = stripMeta(locFull);

console.log(`address : ${address}`);
console.log(`on-chain: ${onFull.length / 2} bytes | local: ${locFull.length / 2} bytes`);
console.log(`stripped: ${onStrip.length / 2} bytes | ${locStrip.length / 2} bytes`);

const imm = (immutablesNormalized > 0 ? ` (+ __self immutable ${immutablesNormalized}×` : '')
  + (linksApplied > 0 ? `${immutablesNormalized > 0 ? ', ' : ' ('}+ ${linksApplied} library link${linksApplied > 1 ? 's' : ''}` : '')
  + (immutablesNormalized > 0 || linksApplied > 0 ? ' normalized)' : '');
if (onFull === locFull) {
  console.log(`\n✓ EXACT MATCH (including metadata)${imm} — byte-for-byte identical.`);
} else if (onStrip === locStrip && onStrip.length > 0) {
  console.log(`\n✓ MODULO-METADATA MATCH${imm} — runtime logic is identical; only the trailing`);
  console.log('   solc metadata hash differs (expected unless the build is byte-reproduced).');
} else {
  console.log('\n❌ DIFFERS — the deployed code does NOT match this source/settings.');
  // small diff hint: first mismatching nibble
  let i = 0; while (i < onStrip.length && i < locStrip.length && onStrip[i] === locStrip[i]) i++;
  console.log(`   first divergence at nibble ${i} (byte ${Math.floor(i/2)}).`);
  process.exit(1);
}
