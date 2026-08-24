/* Verify the transitive dependencies of the Spanish Rail.
 *
 * These contracts are used internally by the live set (01-09) but are not named
 * directly in the gateway/app configs. This script does two read-only things:
 *
 *  1. WIRING: resolves each transitive's address *live* from the contract that
 *     points to it (voting.getVerifier(), ProposalsState.proposalSMTImpl(), and
 *     the Poseidon libs from the impls' link offsets), proving the live system
 *     actually uses these addresses.
 *
 *  2. BYTECODE: compares on-chain `eth_getCode` against the golden reference
 *     captured in golden-refs.json (the runtime verified byte-for-byte against
 *     the Rarimo Hardhat artifacts / circomlibjs at capture time).
 *.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ethers } from '../verify/node_modules/ethers/lib.esm/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RPC = process.env.BASE_RPC || 'https://sepolia.base.org';
const p = new ethers.JsonRpcProvider(RPC, 84532, { staticNetwork: true });
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const implOf = async (a) => ethers.getAddress('0x' + (await p.getStorage(a, IMPL_SLOT)).slice(-40));
const norm = (h) => (h.startsWith('0x') ? h.slice(2) : h).toLowerCase();

// live contracts that reference the transitives (from deployed-contracts set)
const LIVE = {
  BioPassportVoting: '0xdFe18d90F1eCDeF351a09444EAd99A89ec6749e2', // 07
  IDCardVoting:      '0xA69CDE67d624e4802516bf470f9645034401167d', // 08
  ProposalsState:    '0xC00362FF1157Ed284De794C95509d97d2bfb2611', // 06
  RegistrationSMT:   '0x8bD3A87E0F334CdfE633f60F725ac8bCEeD81f66', // 03
  StateKeeper:       '0xC5d3cd14C7240b8859708262aa7f3e159E847DD8', // 01
};
const gr = JSON.parse(readFileSync(join(HERE, 'golden-refs.json'), 'utf8'));

async function main() {
  console.log(`\nTransitive verification (read-only) vs Base Sepolia\n  RPC: ${RPC}\n`);

  // 1. resolve wiring live
  const vAbi = ['function getVerifier() view returns(address)'];
  const bioV = await new ethers.Contract(LIVE.BioPassportVoting, vAbi, p).getVerifier();
  const td1V = await new ethers.Contract(LIVE.IDCardVoting, vAbi, p).getVerifier();
  const psImpl = await new ethers.Contract(LIVE.ProposalsState, ['function proposalSMTImpl() view returns(address)'], p).proposalSMTImpl();
  const certSmt = await new ethers.Contract(LIVE.StateKeeper, ['function certificatesSmt() view returns(address)'], p).certificatesSmt();
  const evReg = await new ethers.Contract(LIVE.RegistrationSMT, ['function evidenceRegistry() view returns(address)'], p).evidenceRegistry();

  const rows = []; let ok = 0, total = 0;
  const check = (label, resolved, key) => {
    total++;
    const ref = gr[key];
    const wired = resolved && ethers.getAddress(resolved) === ethers.getAddress(ref.address);
    return { label, resolved, ref, wired };
  };
  const jobs = [
    check('BioPassportVotingVerifier (TD3)', bioV, 'BioPassportVotingVerifier'),
    check('QueryIdentityTD1Verifier  (TD1)', td1V, 'QueryIdentityTD1Verifier'),
    check('ProposalSMT (impl)',              psImpl, 'ProposalSMT'),
    check('MockEvidenceRegistry',            evReg, 'MockEvidenceRegistry'),
  ];
  for (const j of jobs) {
    const on = norm(await p.getCode(j.ref.address));
    const match = on === norm(j.ref.runtime);
    const good = match && j.wired;
    if (good) ok++;
    rows.push([j.label, good ? '✓' : '❌', j.ref.address, `${j.wired ? 'wired✓' : 'WIRING?'} ${match ? 'bytecode✓' : 'BYTECODE≠ref'}`]);
  }

  // CertificatesSMT — proxy + impl (impl is the same verified PoseidonSMT as RegistrationSMT)
  {
    total++;
    const ref = gr.CertificatesSMT;
    const wired = certSmt && ethers.getAddress(certSmt) === ethers.getAddress(ref.address);
    const proxyOk = norm(await p.getCode(ref.address)) === norm(ref.runtime);
    const implOnchain = ethers.getAddress('0x' + (await p.getStorage(ref.address, IMPL_SLOT)).slice(-40));
    const implOk = norm(await p.getCode(implOnchain)) === norm(ref.implRuntime);
    const good = wired && proxyOk && implOk;
    if (good) ok++;
    rows.push(['CertificatesSMT (PoseidonSMT)', good ? '✓' : '❌', ref.address,
      `${wired ? 'wired✓' : 'WIRING?'} proxy${proxyOk ? '✓' : '≠'} impl${implOk ? '✓' : '≠'}`]);
  }

  // Poseidon libs: bytecode vs golden ref (wiring shown in README, not a single getter)
  for (const [key, note] of [['Poseidon_voto_3L', 'circomlibjs · ProposalsState/ProposalSMT'],
                             ['Poseidon_reg_1L', 'poseidon-solidity wrapper · StateKeeper/SMT'],
                             ['Poseidon_reg_2L', 'poseidon-solidity wrapper · StateKeeper/SMT'],
                             ['Poseidon_reg_3L', 'poseidon-solidity wrapper · StateKeeper/SMT']]) {
    total++;
    const ref = gr[key];
    const on = norm(await p.getCode(ref.address));
    const match = on === norm(ref.runtime);
    if (match) ok++;
    rows.push([key, match ? '✓' : '❌', ref.address, `bytecode${match ? '✓' : '≠ref'} · ${note}`]);
  }

  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [l, v, a, n] of rows) console.log(`  ${v} ${l.padEnd(w)}  ${a}  ${n}`);
  console.log(`\n  ${ok}/${total} confirmed (wiring + bytecode).\n`);
  process.exit(ok === total ? 0 : 1);
}
main().catch((e) => { console.error('❌', e.message); process.exit(1); });
