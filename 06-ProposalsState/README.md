# ProposalsState (UUPS proxy + impl)

- **Proxy address (Base Sepolia):** `0xC00362FF1157Ed284De794C95509d97d2bfb2611`
- **Implementation:** resolved from EIP-1967 slot.
- **Type:** ERC1967 UUPS proxy → `ProposalsState`. Central registry of proposals, configs, per-proposal SMTs and tallies.
- **Source:** `rarimo/passport-voting-contracts/contracts/state/ProposalsState.sol`.
- **Linked libraries:** 1 (Poseidon).
- **Used by:** app (`proposalStateAddress` tally / verifier / getProposalInfo).
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200** (from `hardhat.config`).

## EXACT Verification 
- **Proxy:** on-chain == OZ `ERC1967Proxy` (exact byte-for-byte).
- **Implementation:** on-chain == Hardhat artifact `deployedBytecode` (**exact incl. metadata**), after normalizing `__self` (5×) and 1 Poseidon library link.
