# Equinox Sui Contracts (Testnet Guide)

## Docker Setup (CRITICAL)

Since you are running `sui client` via Docker, use the **`mysten/sui-tools:testnet`** image.

## Interactive Mode (Recommended)

The easiest way is to enter the container with your code mounted, then run commands inside.

**1. Enter the Container:**
Run this from the project root (`/Volumes/SD512/Hacathons/Equinox`):

```bash
docker run -it --rm \
  -v $(pwd):/app \
  -v $HOME/.sui:/root/.sui \
  mysten/sui-tools:testnet \
  bash
```

_Note: `-v $(pwd):/app` makes your code visible inside the container at `/app`._

**2. Inside the Container:**

Once your terminal prompt changes to something like `root@...:/sui#`, run these commands:

```bash
# Go to the contracts folder
cd /app/contracts/equinox

# Build the contracts
sui move build

# Publish to Testnet
sui client publish --gas-budget 100000000 --skip-dependency-verification
```

## 3. Post-Deployment Setup

After publishing, you will get a **Package ID**.

1. **Mint Mock Tokens (Testnet Only):**

   ```bash
   # Replace with your actual Package ID and Treasury Cap ID
   sui client call --function mint_usdc --module test_coins --package $PACKAGE_ID --args $TREASURY_CAP_ID 1000000000 $YOUR_ADDRESS --gas-budget 10000000
   ```

2. **Update Frontend Config:**
   Update `.env.local` with the new Package ID.

## Modules Overview

- **`market`**: The Order Book. Shared Object.
- **`loan`**: The Loan NFT. Owned Object.
- **`vesting`**: The Vesting Vault. Shared Object + Owned Position NFT.
- **`setup`**: Configures the "Display" standard so your NFTs look correct in the wallet.
- **`test_coins`**: Mock tokens for testing.
