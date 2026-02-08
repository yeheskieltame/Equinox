# Equinox Protocol Smart Contracts

This directory contains the Move smart contracts for the Equinox Protocol, a multi-collateral lending platform on Sui with DeepBook integration.

## Deployment Information (Testnet)

| Object Name              | Description                    | Object ID                                                            |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| **Package ID**           | Main contract package          | `0x23cd256d2bb6d5d93dfb57a4e70dc5edd40a4d613d929473c9114e87720b9e23` |
| **Registry**             | Central configuration registry | `0xc1fc221dfb99406f32a1b75c2d4a8765328d0574982eb6c8f8b07605ca6853c5` |
| **Legacy Vesting Vault** | Vault for legacy SUI locking   | `0x30c017eac9f6f614df6fef261202efe23f950ed4f6f932eb1ca708341c97ae0e` |
| **AdminCap**             | Administrative capability      | `0x8161ca3649eab04382071faf6a52030b458bb4bec024004befe4a1b219d21235` |
| **Publisher**            | Package publisher object       | `0x3ab6fec9f73b25651e89ccd3e72f767f57b14d079208d8a21340853fde7915d9` |
| **UpgradeCap**           | Capability to upgrade package  | `0x4fcfcb99b68e1f67707f7ce56b2bfa0ca9c7c868b82e7f6c935afdb5c5e3e01e` |

### Transaction Details

- **Transaction Digest**: `9kMXG5G9jRfMYxKNHWqz74rdjSgrA3YDbGYauycUPn5d`
- **Sender**: `0x5d160e661324a35683964b3d45448eefe2b91054b3c6ea872cb7da32a0dec7c3`
- **Network**: Sui Testnet
- **Deployed At**: 2026-02-08

## Modules

1. **`registry`**: Central hub for protocol configuration, supported assets, and markets.
2. **`market`**: Core lending logic with order book, ZK-hidden orders, and DeepBook integration.
3. **`loan`**: Defines the Loan object and repayment logic.
4. **`vesting`**: Manages collateralized vesting positions.
5. **`mock_coins`**: MOCK_USDC and MOCK_ETH for testing.
6. **`setup`**: Package initialization and Display setup.

## Development

### Build

Use the provided Docker-based build script:

```bash
./build.sh
```

### Test

Run the comprehensive test suite:

```bash
./test.sh
```

### Deploy

Deploy to testnet (requires ~/.sui configuration):

```bash
./deploy.sh [gas_budget]
```
