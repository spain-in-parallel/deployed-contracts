# Transitive

## The layer under the live set
The main set is *what the gateway and app name directly*. Those contracts in turn depend on a handful of contracts that no config file mentions but that the rail cannot run without. This folder records them, verifies them, and maps **which of the 9 uses each, and how its address is discovered on-chain** (none of these are hard-coded in the app/gateway; they are resolved from the contracts above them).

Everything here is **read-only**: `verify-transitive.mjs` resolves the wiring live from the contracts that point at each dependency, then compares on-chain `eth_getCode` against the golden reference in `golden-refs.json`.

```
cd transitive && node verify-transitive.mjs # 9/9 confirmed (wiring + bytecode)
```

### Result — 9/9 confirmed

| Transitive | Address | Verified against | Wiring (how its address is found) |
|---|---|---|---|
| **BioPassportVotingVerifier** (TD3, 23 signals) | `0x99C2cD5E…55eA` | Hardhat artifact `deployedBytecode` — **EXACT** | `07 BioPassportVoting.getVerifier()` |
| **QueryIdentityTD1Verifier** (TD1, 24 signals) | `0x2f36A419…0144` | fresh-compile solc 0.8.23 — **EXACT** | `08 IDCardVoting.getVerifier()` |
| **ProposalSMT** (impl) | `0xB119EF1C…A8A3` | Hardhat artifact `deployedBytecode` — **EXACT** (norm. `__self` + voto libs) | `06 ProposalsState.proposalSMTImpl()` |
| **MockEvidenceRegistry** | `0xbf43719a…D0B2` | Hardhat artifact `deployedBytecode` — **EXACT** | `03 RegistrationSMT.evidenceRegistry()` |
| **CertificatesSMT** (PoseidonSMT) | `0xEc0A436c…44c5` | proxy == verified `ERC1967Proxy`; impl == `03`'s `PoseidonSMT` (norm. `__self` + libs) | `01 StateKeeper.certificatesSmt()` |
| **Poseidon (voto) 3L** | `0x61bB4Eb6…4100` | circomlibjs `createCode(3)` — matches | linked into `06 ProposalsState` / `ProposalSMT` |
| **Poseidon (registro) 1L** | `0x2dC4f7C5…A20D` | poseidon-solidity wrapper — matches | linked into `01 StateKeeper` / `03 RegistrationSMT` |
| **Poseidon (registro) 2L** | `0x59f9AA33…7DA3` | poseidon-solidity wrapper — matches | linked into `01 StateKeeper` / `03 RegistrationSMT` |
| **Poseidon (registro) 3L** | `0x3A1AD742…f1cf` | poseidon-solidity wrapper — matches | linked into `01 StateKeeper` / `03 RegistrationSMT` |

### Who uses what

```
  07 BioPassportVoting ──getVerifier()──►  BioPassportVotingVerifier   (Groth16, TD3 vote proof, 23 signals)
  08 IDCardVoting      ──getVerifier()──►  QueryIdentityTD1Verifier    (Groth16, TD1 vote proof, 24 signals)

  06 ProposalsState ──proposalSMTImpl()──► ProposalSMT (impl)
        │  createProposal()  deploys one ERC1967 proxy per proposal ─► ProposalSMT proxy #N
        └─ each proxy = the proposal's nullifier tree (one leaf per vote → anti double-vote)

  01 StateKeeper ──certificatesSmt()──► CertificatesSMT (PoseidonSMT proxy, dormant in pilot)
  03 RegistrationSMT ─evidenceRegistry()─► MockEvidenceRegistry (no-op stub; roots never anchored)

  Poseidon hash libraries (linked at deploy, addresses baked into the impls):
    registro subsystem  01 StateKeeper · 03 RegistrationSMT · CertificatesSMT ─► Poseidon (registro) 1L/2L/3L
    voto subsystem      06 ProposalsState · ProposalSMT                       ─► Poseidon (voto)     1L…3L
```

`CertificatesSMT` (CSCA certificate tree) and `MockEvidenceRegistry` (a no-op `IEvidenceRegistry` stub) are deployed but no certificates are added on the passport/DNI path, and the mock never anchors the SMT roots. They are verified here for completeness, not because the live flow exercises them.

The verifiers are the security-critical ones: a rogue verifier would silently accept forged ZK proofs, so both are pinned byte-for-byte to Rarimo's source.

`ProposalSMT` is the anti-double-vote tree — the impl is shared; ProposalsState clones a fresh proxy of it per proposal, so there is no single "the" ProposalSMT address, only the impl above plus one proxy per live proposal.

### Two different Poseidon deployments

The two subsystems link **different Poseidon builds**, and it is worth recording:

- **Voto** (`ProposalsState`, `ProposalSMT`) links **circomlibjs** Poseidon: the large self-contained assembly libraries (3L ≈ 12.5 KB) produced by `poseidonContract.createCode(n)`. This is exactly what the stock passport-voting migration emits, and it matches.
- **Registro** (`StateKeeper`, `RegistrationSMT`, `CertificatesSMT`) links **poseidon-solidity thin wrappers** (≈ 450–510 B). Each `PoseidonUnitNL` wrapper is a tiny library whose body `staticcall`s a **shared poseidon-solidity `PoseidonT` contract** (the heavy assembly, 10–17 KB): 1L→`PoseidonT2` `0x77b8…0552f`, 2L→`PoseidonT3` `0x5c3b…3548`, 3L→`PoseidonT4` `0x54a5…d68e`. This is the `@rarimo/evidence-registry` Poseidon (the registration SMTs bind to the evidence registry), **not** the circomlibjs build.

Both compute the identical hash but only the on-chain shape of the library differs. This does **not** affect the verification dut to those impls only embed the library *address*, and their logic verified EXACT regardless.

**On byte-parity in `deploy/deploy.mjs` (why it stays on circomlibjs):** `deploy.mjs` deploys circomlibjs Poseidon for *both* subsystems. It reproduces the **voto** Poseidon exactly, but for **registro** it is functionally identical, not byte-identical. 

True byte-parity for the **registro** Poseidon on a fresh local chain is **not achievable** anyway: the shared `PoseidonT2/3/4` were deployed on Base Sepolia at **non-deterministic addresses** and each wrapper bakes in both its own address and its `PoseidonT` target. 

So the wrapper bytecode can only ever be *logic*-identical, differing at those embedded addresses (exactly as circomlibjs also differs by address). Switching `deploy.mjs` to the poseidon-solidity shape would add three large deploys and still not yield byte-parity, so it stays on circomlibjs, and the asymmetry is documented here rather than papered over.

### Files
- `verify-transitive.mjs`: read-only wiring + bytecode check (9/9).
- `golden-refs.json`: the on-chain runtime captured at verification time, per contract.
