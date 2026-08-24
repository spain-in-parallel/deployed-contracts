# BioPassportVoting (UUPS proxy + impl)

- **Proxy address (Base Sepolia):** `0xdFe18d90F1eCDeF351a09444EAd99A89ec6749e2`
- **Implementation:** resolved from EIP-1967 slot.
- **Type:** ERC1967 UUPS proxy → `BioPassportVoting`. TD3 passport vote front-end (23-signal query circuit), exposes `execute(...)`.
- **Source:** `rarimo/passport-voting-contracts/contracts/voting/BioPassportVoting.sol`.
- **Used by:** app (`getBioPassportVotingAddress`) + gateway relayer (allow-lists `execute`).
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200** (from `hardhat.config`).

## EXACT Verification
- **Proxy:** on-chain == OZ `ERC1967Proxy` (exact byte-for-byte).
- **Implementation:** on-chain == Hardhat artifact `deployedBytecode` (**exact incl. metadata**), after normalizing `__self` (5×).
