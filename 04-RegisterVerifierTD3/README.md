# Register verifier TD3 (OwnRegisterLight160Verifier)

- **Address (Base Sepolia):** `0x87C19Fee055Fb44463ddf712b8141B1A21A5e819`
- **Type:** plain contract (snarkJS Groth16 verifier). 3 public signals `[dg1Hash, dgCommit, pkIdentityHash]`.
- **Source:** `OwnRegisterLight160Verifier.sol`
- **Used by:** gateway registrator (`registerVerifierByDocType[3]`): the verifier RegistrationSimple checks the TD3 register proof under.
- **Compiler:** solc **0.8.28** (+commit.7893614a), optimizer **runs 200**, evmVersion **london** (from `hardhat.config`), metadata-hash ipfs.

## EXACT Verification
Triple-checked:
1. On-chain `eth_getCode` == Hardhat artifact `deployedBytecode` (**exact, incl. metadata** 1561 bytes).
2. Artifact is not stale (built after the source file).
3. **Fresh compile with the real solc 0.8.28** (Hardhat-cached binary, same settings) == on-chain (**exact byte-for-byte**).

→ The deployed runtime code is the exact compilation of this source with the settings above. Method: `deployed-contracts/verify/verify-bytecode.mjs`.
