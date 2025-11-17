# reNFT - A decentralized platform for renting NFTs

---

reNFT is a marketplace where DAO's can list NFTs for rental purposes. They can be used for event passes, membership benefits, and to generate publicity for new projects.

## Quick Start
---
#### Prerequisites

  - Node.js 18+
  - Rust 1.70+
  - Solana CLI 1.18+
  - Anchor CLI 0.32+


## Installation
```bash
  # Clone repository
  git clone https://github.com/asa/reNFT.git
  cd reNFT

# Install dependencies
npm install
# or
yarn install

# Build programs
anchor build

```

### Development Setup
1. **Start local validator**:
```bash
solana-test-validator

```
2. **Deploy to local** (optional):
```bash
anchor deploy
```
3. **Run tests**:
```bash
anchor test
```

### Devnet Interaction
The programs are already deployed on devnet. To interact:
```bash
solana config set --url devnet

# Airdrop SOL for testing
solana airdrop 2

# Run tests against devnet deployment
anchor test --skip-deploy
```

## Current Features
- Initialize a global marketplace admin.
- Whitelist DAOs to list NFTs with configurable rental prices and durations.
- List NFTs and transfer them to a vault.
### Features to be Added
- Rent NFTs by paying the specified rental fee
- Store rental payments in escrow until the rental period expires
- Grant delegate authority to renters for the rental duration
- Enforce time-bound access and revoke delegate authority after expiry
- Release escrowed funds to the DAO upon successful rental completion
- Return NFTs to DAO vaults and enable delisting
- Prevent premature delisting of actively rented NFTs
- Close inactive vault and escrow accounts to reclaim lamports

##  Resources
- [Solana Documentation](https://docs.solana.com/)
-  [Anchor Framework](https://anchor-lang.com/)
