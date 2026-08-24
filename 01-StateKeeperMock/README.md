# StateKeeper (UUPS proxy + impl)

- **Proxy address (Base Sepolia):** `0xC5d3cd14C7240b8859708262aa7f3e159E847DD8`
- **Implementation:** `0x359cFC9ACA1Ca359D6a484b25B8D081842E3a785` (EIP-1967 slot)
- **Type:** ERC1967 UUPS proxy → **`StateKeeperMock`** implementation. The deployed impl is the **Mock** (ungated setters + empty `_authorizeUpgrade`), NOT the real `StateKeeper`. Known pilot-only security hole **MUST BE replaced** before mainnet.
- **Source:** `rarimo/passport-contracts/contracts/mock/state/StateKeeperMock.sol`.
- **Linked libraries:** Poseidon (`PoseidonUnit2L/3L`, 6 references).
- **Used by:** app (`stateKeeperAddress`, `getPassportInfo` in reset flow) + gateway (registration path).
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200**, evmVersion **london** (from `hardhat.config`).

## EXACT verification
- **Proxy:** on-chain == OZ `ERC1967Proxy` artifact (exact byte-for-byte).
- **Implementation:** on-chain == Hardhat artifact `deployedBytecode` (**exact incl. metadata**), after normalizing the `__self` immutable (3×) and re-linking the 6 Poseidon library references to their on-chain addresses.

→ Confirms the deployed code IS `StateKeeperMock`, matching the source.

## Files
- `StateKeeperMock.sol`: the Rarimo source file as deployed (imports resolve in the `rarimo/passport-contracts` tree so verification was against that tree + its Hardhat artifact).
