# Register verifier TD1 (RegisterLightTD1_160 · Groth16Verifier)

- **Address (Base Sepolia):** `0x79D49CA384a149296A36BA5D4F68aFDd225b490B`
- **Type:** plain contract (snarkJS Groth16 verifier). TD1 register circuit (DNIe), DG_HASH_TYPE 160, DOCUMENT_TYPE 1.
- **Source:** `RegisterLightTD1_160Verifier.sol` (contract `Groth16Verifier`).
- **Used by:** gateway registrator (`registerVerifierByDocType[1]`): the verifier RegistrationSimple checks the TD1 register proof under.
- **Compiler:** solc **0.8.23** (+commit.f704f362), **`--optimize`** (runs 200), evmVersion **shanghai** (0.8.23 default), metadata-hash ipfs.

## EXACT Verification
- Reproduced the deploy settings by matching the artifact's creation `bin` exactly (local solc == deploy solc 0.8.23; swept evm/optimizer → shanghai + `--optimize`).
- **Fresh compile runtime == on-chain `eth_getCode`, byte-for-byte incl. metadata** (1537 bytes).

→ Deployed runtime is the exact compilation of this source with the settings above. Method: `deployed-contracts/verify/`.
