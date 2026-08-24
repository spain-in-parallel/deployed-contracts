# RegistrationSMT (PoseidonSMT) (UUPS proxy + impl)

- **Proxy address (Base Sepolia):** `0x8bD3A87E0F334CdfE633f60F725ac8bCEeD81f66`
- **Implementation:** `0xd793C28810280aC9F958C6949EC2c997535D3d98` (EIP-1967 slot)
- **Type:** ERC1967 UUPS proxy → `PoseidonSMT` implementation. (Deployed under the "RegistrationSMT" name but the impl is the plain `PoseidonSMT`; the L1-bridging `RegistrationSMT.sol` path is inert.)
- **Source:** `rarimo/passport-contracts/contracts/state/PoseidonSMT.sol`.
- **Linked libraries:** `PoseidonUnit2L`, `PoseidonUnit3L` (from `contracts/libraries/Poseidon.sol` → poseidon-solidity).
- **Used by:** app (`poseidonSmtAddress`) + gateway (registrator/relayer, via StateKeeper).
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200**, evmVersion **london** (from `hardhat.config`).

## EXACT Verification 
- **Proxy:** on-chain == OZ `ERC1967Proxy` artifact (exact byte-for-byte).
- **Implementation:** on-chain == Hardhat artifact `deployedBytecode` (**exact incl. metadata**), after normalizing the `__self` immutable (3×) and re-linking the 2 Poseidon library references to their on-chain addresses.

## Files
- `PoseidonSMT.sol`: the Rarimo source file as deployed (imports resolve in the `rarimo/passport-contracts` tree so verification was against that tree + its Hardhat artifact).
