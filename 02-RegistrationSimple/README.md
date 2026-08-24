# RegistrationSimple (UUPS proxy + impl)

- **Proxy address (Base Sepolia):** `0x5f5a67ecB87982990F7f7BD0CF3c130059acA5ad`
- **Implementation:** `0xa37b52eBB6C1d87fd577F28dA713e0974b881221` (from EIP-1967 slot)
- **Type:** ERC1967 UUPS proxy → RegistrationSimple implementation.
- **Source:** `rarimo/passport-contracts/contracts/registration/RegistrationSimple.sol` (proxy = OZ `@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol`).
- **Used by:** app (`registerSimpleContractAddress`) + gateway (registrator writes the register tx; relayer allow-lists `registerSimple`).
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200**, evmVersion **london** (from `hardhat.config`).

## EXACT Verification
- **Proxy:** on-chain `eth_getCode` == OZ `ERC1967Proxy` artifact (**exact byte-for-byte** 170 bytes).
- **Implementation:** on-chain == Hardhat artifact `deployedBytecode` (**exact incl. metadata**), after normalizing the UUPS `__self = address(this)` immutable (3×).

→ Both proxy and implementation are the exact compilation of this source with the settings above.

## Files
- `RegistrationSimple.sol`: the Rarimo source file as deployed (imports resolve in the `rarimo/passport-contracts` tree so verification was against that tree + its Hardhat artifact).
