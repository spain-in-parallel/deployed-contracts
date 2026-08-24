/* Deploy the full rail into a local node (anvil / hardhat node).
 *
 * only this folder's local deps (ethers + circomlibjs) and the captured
 * creation artifacts in ./artifacts/. Mirrors the original hardhat
 * migrations (passport-contracts 1_state/2_registration, passport-voting
 * 1_state/2_voting) + deploy-td1.mjs + the IdeaRegistry forge-create.
 *
 * Config: owner = register signer = the deployer key (anvil account #0 by
 * default). StateKeeperMock (parity with Base Sepolia).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
const { poseidonContract } = createRequire(import.meta.url)('circomlibjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';

// anvil / hardhat deterministic account #0
const PRIVKEY = process.env.PRIVKEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// config (mirror of the base-sepolia deploy configs)
const TREE_SIZE = 80;
const ICAO_ROOT = '0x490355b1c9cca56d89c180780c5ea66c1766d57cf22670c7a9a07dc18b835a4f';
const MIN_FUNDING = 0n;
const IDEA_FEE = ethers.parseEther('0.001');
const IDEA_BASE = ethers.parseEther('0.0002');
const SIMPLE_REG_NAME = 'SimpleRegistration';
const BIO_VOTING_NAME = 'BioPassportVoting';
const IDCARD_VOTING_NAME = 'IDCardVoting';

const provider = new ethers.JsonRpcProvider(RPC);
const baseWallet = new ethers.Wallet(PRIVKEY, provider);
// track the nonce locally so rapid sequential deploys/inits don't collide
const wallet = new ethers.NonceManager(baseWallet);
const owner = baseWallet.address;

const load = (n) => JSON.parse(readFileSync(join(HERE, 'artifacts', `${n}.json`), 'utf8'));

function link(art, libs) {
  let hex = (art.bytecode.startsWith('0x') ? art.bytecode.slice(2) : art.bytecode);
  for (const file of Object.keys(art.linkReferences || {}))
    for (const lib of Object.keys(art.linkReferences[file])) {
      const addr = libs[lib].slice(2).toLowerCase();
      for (const { start, length } of art.linkReferences[file][lib]) {
        const s = start * 2, l = length * 2;
        hex = hex.slice(0, s) + addr + hex.slice(s + l);
      }
    }
  return '0x' + hex;
}

async function deploy(name, args = [], libs = null) {
  const art = load(name);
  const bc = libs ? link(art, libs) : art.bytecode;
  const f = new ethers.ContractFactory(art.abi, bc, wallet);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  ${name.padEnd(28)} ${addr}`);
  return addr;
}

async function deployLib(size) {
  const f = new ethers.ContractFactory(poseidonContract.generateABI(size), poseidonContract.createCode(size), wallet);
  const c = await f.deploy(); await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  PoseidonUnit${size}L${''.padEnd(28 - 12)} ${addr}`);
  return addr;
}

const at = (addr, name) => new ethers.Contract(addr, load(name).abi, wallet);
const proxy = (impl) => deploy('ERC1967Proxy', [impl, '0x']);

const A = {}; // collected addresses

async function main() {
  const net = await provider.getNetwork();
  console.log(`\nDeploying full rail → ${RPC} (chainId ${net.chainId})`);
  console.log(`owner / signer = ${owner}\n`);

  console.log('· Poseidon libs');
  const p1 = await deployLib(1), p2 = await deployLib(2), p3 = await deployLib(3);
  const libs = { PoseidonUnit1L: p1, PoseidonUnit2L: p2, PoseidonUnit3L: p3 };
  A.poseidon1 = p1; A.poseidon2 = p2; A.poseidon3 = p3;

  console.log('· Registration');
  A.mockEvidenceRegistry = await deploy('MockEvidenceRegistry');
  const smtImpl = await deploy('PoseidonSMT', [], libs);
  A.registrationSMT = await proxy(smtImpl);
  A.certificatesSMT = await proxy(smtImpl);
  const skImpl = await deploy('StateKeeperMock', [], libs);
  A.stateKeeper = await proxy(skImpl);
  await (await at(A.registrationSMT, 'PoseidonSMT').__PoseidonSMT_init(A.stateKeeper, A.mockEvidenceRegistry, TREE_SIZE)).wait();
  await (await at(A.certificatesSMT, 'PoseidonSMT').__PoseidonSMT_init(A.stateKeeper, A.mockEvidenceRegistry, TREE_SIZE)).wait();
  await (await at(A.stateKeeper, 'StateKeeperMock').__StateKeeper_init(owner, A.registrationSMT, A.certificatesSMT, ICAO_ROOT)).wait();
  const rsImpl = await deploy('RegistrationSimple');
  A.registrationSimple = await proxy(rsImpl);
  await (await at(A.registrationSimple, 'RegistrationSimple').__RegistrationSimple_init(A.stateKeeper, [owner])).wait();
  await (await at(A.stateKeeper, 'StateKeeperMock').mockAddRegistrations([SIMPLE_REG_NAME], [A.registrationSimple])).wait();
  A.registerVerifierTD3 = await deploy('OwnRegisterLight160Verifier');

  console.log('· Voting');
  const proposalSMTImpl = await deploy('ProposalSMT', [], libs);
  A.proposalSMTImpl = proposalSMTImpl;
  const psImpl = await deploy('ProposalsState', [], libs);
  A.proposalsState = await proxy(psImpl);
  await (await at(A.proposalsState, 'ProposalsState').__ProposalsState_init(proposalSMTImpl, MIN_FUNDING)).wait();
  A.bioPassportVotingVerifier = await deploy('BioPassportVotingVerifier');
  const bioImpl = await deploy('BioPassportVoting');
  A.bioPassportVoting = await proxy(bioImpl);
  await (await at(A.bioPassportVoting, 'BioPassportVoting').__BioPassportVoting_init(A.registrationSMT, A.proposalsState, A.bioPassportVotingVerifier)).wait();
  await (await at(A.proposalsState, 'ProposalsState').addVoting(BIO_VOTING_NAME, A.bioPassportVoting)).wait();

  console.log('· IdeaRegistry');
  A.ideaRegistry = await deploy('IdeaRegistry', [owner, owner, A.proposalsState, IDEA_FEE, IDEA_BASE]);

  console.log('· TD1 / DNIe');
  A.registerVerifierTD1 = await deploy('RegisterLightTD1_160Verifier');
  A.queryVerifierTD1 = await deploy('QueryIdentityTD1Verifier');
  const icImpl = await deploy('IDCardVoting');
  A.idCardVoting = await proxy(icImpl);
  await (await at(A.idCardVoting, 'IDCardVoting').__IDCardVoting_init(A.registrationSMT, A.proposalsState, A.queryVerifierTD1)).wait();
  await (await at(A.proposalsState, 'ProposalsState').addVoting(IDCARD_VOTING_NAME, A.idCardVoting)).wait();

  const out = { rpc: RPC, chainId: Number(net.chainId), owner, ...A };
  writeFileSync(join(HERE, 'local-addresses.json'), JSON.stringify(out, null, 2));
  console.log('\nFull rail deployed. Addresses → deploy/local-addresses.json\n');
}

main().catch((e) => { console.error('\n❌ deploy failed:', e.message); process.exit(1); });
