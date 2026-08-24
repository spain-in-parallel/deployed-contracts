# IDCardVoting (TD1 / DNIe) (UUPS proxy + impl)

- **Proxy address (Base Sepolia):** `0xA69CDE67d624e4802516bf470f9645034401167d`
- **Implementation:** resolved from EIP-1967 slot.
- **Type:** ERC1967 UUPS proxy → `IDCardVoting`. TD1 (DNIe) vote front-end (24-signal query circuit), exposes `executeTD1(...)`. `addVoting`'d onto the same official ProposalsState as BioPassportVoting.
- **Source:** `rarimo/passport-voting-contracts/contracts/voting/IDCardVoting.sol`.
- **Used by:** app (`getIDCardVotingAddress`) + gateway relayer (allow-lists `executeTD1`).
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200** (passport-voting-contracts build).

## EXACT Verification
- **Proxy:** on-chain == OZ `ERC1967Proxy` (exact byte-for-byte).
- **Implementation:** on-chain == Hardhat artifact `deployedBytecode` (**exact incl. metadata**), after normalizing `__self` (5×).
