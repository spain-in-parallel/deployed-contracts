# Deploy

## Bring up the full Spanish Rail (local network)
Redeploy the entire verified set (`deployed-contracts/`) on a local EVM node for testing/forking without touching Base Sepolia. `deploy.mjs` brings up the whole
rail from the captured creation artifacts (tested on anvil). This README is the map of *what talks to what*.

---

### System diagram: who talks to whom

See **[`architecture.txt`](./architecture.txt)**, that shows the system diagram (OFF-CHAIN people/services ↔ ON-CHAIN contracts, grouped by the three flows: governance, registration, voting, and the shared state layer).

#### The three core flows
- **Governance (1→4):** proposer pins the idea JSON to IPFS → `IdeaRegistry.submit(cid)` (fee escrow) → the Council Safe `resolve(approve, cfg)` → `ProposalsState.createProposal`. The app then lists it via `promotedProposalIds()`.
- **Registration (5):** app scans the doc + builds a Groth16 proof → gateway **registrator** passive-auths + signs an attestation → `RegistrationSimple.registerSimple(...)` verifies the register proof (**04/05**) + the signer + replay → `StateKeeper.addBond` → leaf into **RegistrationSMT**.
- **Voting (6):** app builds the vote proof → gateway **relayer** (allow-list + pays gas) → `BioPassportVoting.execute` (TD3) / `IDCardVoting.executeTD1` (TD1) verifies the vote proof (23/24 signals) → `ProposalsState.vote` → nullifier into the proposal's **ProposalSMT** (anti double-vote).

#### Address legend
See the per-folder READMEs (`01-…` … `09-…`): each has its address, proxy/impl, source, compiler settings and the byte-for-byte verification result.

---

### Run it

```bash
# 1) start a local node (Foundry)
anvil   # 127.0.0.1:8545, chainId 31337

# 2) deploy the full rail (another terminal)
cd deployed-contracts/deploy
node deploy.mjs

# to override node / deployer
# RPC_URL=... PRIVKEY=... node deploy.mjs
```

Deploys in migration order: **Poseidon 1L/2L/3L → registro (MockEvidenceRegistry, RegistrationSMT+CertificatesSMT, StateKeeperMock, RegistrationSimple + authorize, RegisterVerifierTD3) → voto (ProposalSMT, ProposalsState, BioPassportVotingVerifier, BioPassportVoting + addVoting) → IdeaRegistry → TD1 (RegisterVerifierTD1, QueryVerifierTD1, IDCardVoting + addVoting)**.

All `__*_init` and `addVoting` calls succeed (they revert on bad wiring), so a clean exit means the whole rail is wired.

#### Config (top of `deploy.mjs`)
- **owner = register signer = deployer** (anvil account #0 by default).
- **StateKeeper = Mock** (parity with Base Sepolia).
- treeSize 80 · icaoRoot mirrors base-sepolia · minFunding 0 · IdeaRegistry fee 0.001 / base 0.0002.

#### Autonomy
`deploy/` needs only its local deps (`ethers`, `circomlibjs`) + `artifacts/` (creation bytecode + ABI + linkReferences captured from the same artifacts the `deployed-contracts` set was verified against). Poseidon libs are generated at deploy time by `circomlibjs` (the exact mechanism the original migrations used). No external project folder is referenced at runtime.
