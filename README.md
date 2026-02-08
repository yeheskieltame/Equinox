# Equinox

A Fair and Inclusive Order Book-Based Multi-Collateral DeFi Lending Protocol Native to Sui Blockchain

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Advantages](#key-advantages)
- [Core Features](#core-features)
- [Target Market](#target-market)
- [Concept and Mechanism](#concept-and-mechanism)
  - [How It Works](#how-it-works)
  - [Multi-Collateral System](#multi-collateral-system)
  - [Hidden Position Privacy](#hidden-position-privacy)
  - [Lender Journey](#lender-journey)
  - [Borrower Journey](#borrower-journey)
  - [Matching Engine](#matching-engine)
  - [Vesting Integration](#vesting-integration)
- [Technical Architecture](#technical-architecture)
- [Deployed Contracts](#deployed-contracts)
- [Why Sui Blockchain](#why-sui-blockchain)
- [Links](#links)

---

## Problem Statement

Current DeFi lending protocols on Sui and other blockchains face significant limitations:

1. **Fragmented Liquidity** - Pooled lending models create isolated liquidity pools, leading to inefficient capital allocation and inconsistent rates across similar assets.

2. **Inflexible Interest Rates** - Users cannot customize their lending or borrowing terms. Rates are algorithmically determined by pool utilization, offering no personalization.

3. **Cold-Start Problem** - New or emerging assets struggle to bootstrap liquidity, as pooled models require critical mass before becoming useful.

4. **Vesting Pressure on Ecosystem** - Large vesting schedules from early investors and team allocations create sustained selling pressure, destabilizing token prices and ecosystem health.

5. **Inequity Between Retail and Institutional Users** - Institutional players with larger capital have inherent advantages in current systems, while retail users lack privacy options and face higher relative costs.

6. **Front-Running and Order Manipulation** - Transparent order books allow malicious actors to front-run trades and manipulate pricing.

7. **Whale Position Exposure** - Large lenders face privacy risks as their position sizes and strategies become visible to the market, enabling targeted manipulation.

---

## Solution

Equinox introduces an order book-based multi-collateral lending protocol that addresses these fundamental issues through core innovations:

1. **Multi-Collateral Lending System** - Support for multiple asset types (USDC, SUI, ETH) as both lending assets and collateral. Users can diversify their collateral portfolio and access better rates through flexible collateral composition.

2. **Dynamic Order Book Matching** - Users place custom limit or market orders specifying their exact terms (interest rate, LTV ratio, term duration, collateral preferences). Orders are matched dynamically based on compatibility, enabling true price discovery and capital efficiency.

3. **Zero-Knowledge Privacy Orders with Hidden Positions** - Order details and position sizes remain hidden using native Sui zero-knowledge proofs until a match is achieved. Pending orders display no position details, protecting whale lenders from targeted attacks and front-running.

4. **AI-Verifiable Fair Matching via Nautilus** - Off-chain AI compute through Sui's Nautilus ensures fairness in matching by prioritizing retail users, diversifying counterparty risk, and maintaining inclusive access. All computations are verifiable on-chain.

5. **Vesting-Integrated Collateral Vault** - Holders of vested tokens can lock their assets as collateral with ZK proofs of vesting status, earning yield while reducing ecosystem selling pressure.

---

## Key Advantages

| Advantage                | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Multi-Collateral Support | Accept multiple asset types (USDC, SUI, ETH) as collateral with flexible composition |
| Capital Efficiency       | Order book model eliminates idle liquidity common in pooled systems                  |
| Customizable Terms       | Users define their own rates, LTV, and duration instead of accepting pool rates      |
| Privacy Protection       | ZK-hidden orders and positions prevent information leakage and front-running         |
| Whale Privacy            | Pending order positions are hidden to protect large lenders from targeted attacks    |
| Algorithmic Fairness     | AI-verified matching ensures retail users receive priority access                    |
| Ecosystem Stability      | Vesting vault mechanism reduces token selling pressure                               |
| Fast Finality            | Sui's Mysticeti consensus provides sub-second transaction confirmation               |
| Frictionless Onboarding  | zkLogin enables access via existing Google, email, or social accounts                |
| Low Transaction Costs    | Sui's efficient execution allows frequent order adjustments without prohibitive fees |

---

## Core Features

### 1. Multi-Collateral Lending System

Equinox supports multiple asset types for both lending and collateral:

- USDC, SUI, and ETH as accepted collateral types
- Flexible collateral composition for improved capital efficiency
- Cross-asset lending and borrowing opportunities
- Dynamic collateral ratio calculations based on asset volatility
- Seamless integration with DeepBook for liquidation routing

### 2. Dynamic Order Book Matching

Place limit and market orders with fully customizable parameters:

- Minimum or maximum interest rate
- Loan-to-Value (LTV) ratio preferences
- Term duration (fixed or flexible)
- Collateral asset preferences and requirements

Orders are matched when lender and borrower terms align, creating efficient two-sided markets.

### 3. ZK-Privacy Orders with Hidden Position Details

Order details are encrypted using zero-knowledge proofs native to Sui blockchain:

- Order parameters remain hidden until matched
- Pending orders show no position size or value details for whale privacy
- Prevents front-running and sandwich attacks
- Provides institutional-grade privacy for all users
- No information leakage during order placement

### 4. AI-Verifiable Fair Matching

Nautilus enables off-chain AI computation with on-chain verification:

- Fairness scoring prioritizes smaller retail orders
- Risk diversification algorithms prevent concentration
- Inclusive matching boosts for underserved user segments
- Fully verifiable and auditable matching logic

### 5. Vesting-Integrated Collateral Vault

Designed specifically for Sui ecosystem stability:

- Lock vested tokens as collateral with ZK proof of vesting status
- Earn subsidy APR for contributing to liquidity stability
- Receive priority matching as a reward for lock-up commitment
- Reduces circulating supply pressure from vesting unlocks

### 6. Gamified and Inclusive User Experience

Engagement-focused design with practical benefits:

- Fairness badges for consistent participation
- Sponsored transactions for small retail orders
- Referral revenue sharing via DeepBook integration
- Interactive dashboard with real-time metrics

---

## Target Market

### Primary Users

**Retail and Emerging Market Users**

- First-time DeFi users seeking simple onboarding via zkLogin
- Users in regions with limited banking infrastructure
- Small-scale lenders and borrowers seeking fair rates

**Institutional and High-Net-Worth Users**

- Traders requiring privacy for large positions
- Whale lenders seeking hidden order details to prevent targeted attacks
- Funds needing customizable lending terms with multi-collateral support
- Market makers seeking efficient capital deployment

**Vested Token Holders**

- Early investors with locked Sui or partner tokens
- Team members with vesting schedules
- Ecosystem participants seeking yield on illiquid positions

**Developers and Builders**

- Protocols seeking composable lending primitives
- Applications requiring programmable loan objects
- Builders extending the Sui DeFi ecosystem

---

## Concept and Mechanism

### How It Works

Equinox operates as a two-sided order book where lenders and borrowers place orders with specific terms. The matching engine finds compatible counterparties, creates on-chain loan objects, and manages the lifecycle from origination to repayment or liquidation.

### Multi-Collateral System

The multi-collateral system enables flexible asset management:

1. **Asset Registration** - USDC, SUI, and ETH are registered as supported assets in the protocol
2. **Collateral Deposit** - Users can deposit multiple asset types as collateral
3. **Weighted Valuation** - Collateral value is calculated based on oracle prices with asset-specific risk weights
4. **Cross-Asset Loans** - Borrow one asset while providing different assets as collateral
5. **Liquidation Routing** - DeepBook integration enables efficient liquidation across all supported pairs

### Hidden Position Privacy

Position privacy is designed to protect whale lenders:

1. **Pending Order Masking** - When orders are pending (not yet matched), position details are hidden from public view
2. **ZK Proof Verification** - Cryptographic proofs verify order validity without revealing amounts
3. **Match Revelation** - Position details only become visible after successful order matching
4. **Anti-Front-Running** - Hidden positions prevent targeted manipulation of large orders
5. **Dashboard Privacy Mode** - Users can toggle visibility of their own position details

### Lender Journey

1. **Authentication** - Connect via zkLogin using Google, email, or social account
2. **Deposit** - Transfer assets to the Equinox vault (USDC, SUI, or ETH)
3. **Order Placement** - Create a hidden limit lend order specifying minimum rate, maximum LTV, term, size, and accepted collateral types
4. **AI Fairness Check** - Order enters the matching queue with fairness scoring
5. **Match Execution** - When a compatible borrower order exists, a loan object is created
6. **Monitoring** - Track yield accrual and earn fairness badges through the dashboard (position details hidden until matched)

### Borrower Journey

1. **Authentication** - Connect via zkLogin
2. **Collateral Deposit** - Provide multi-asset collateral including vested assets if applicable
3. **Order Placement** - Create a borrow order with maximum acceptable rate, minimum LTV, and term
4. **Matching with Boost** - Retail users receive priority in fair matching algorithm
5. **Loan Execution** - Receive borrowed assets upon successful match
6. **Repayment** - Pay back principal plus interest, with sponsored transactions for small amounts

### Matching Engine

The matching engine operates in two phases:

**Phase 1: Criteria Verification**

- Borrower rate >= Lender minimum rate
- Borrower LTV <= Lender maximum LTV
- Compatible term durations
- Acceptable collateral types match across supported assets

**Phase 2: Fairness Optimization (Nautilus AI)**

- Calculate fairness score for each potential match
- Apply retail boost for smaller orders
- Penalize over-concentration with single counterparties
- Verify computation on-chain
- Finalize via Mysticeti consensus with approximately 400ms latency

### Vesting Integration

Vested token holders follow a specialized flow:

1. **Proof Generation** - Upload ZK proof of vesting status and schedule
2. **Vault Lock** - Lock vested assets in the specialized vesting vault
3. **Yield Earning** - Receive subsidy APR for liquidity contribution
4. **Priority Matching** - Gain matching priority as collateral provider
5. **Ecosystem Impact** - Contribute to reduced selling pressure and improved token stability

---

## Technical Architecture

### Smart Contracts (Move Language)

- **Market Module** - Multi-collateral order book management with support for USDC, SUI, and ETH
- **LoanObject Module** - Creates independent objects for each loan position
- **Registry Module** - Asset registry for supported collateral types and configurations
- **VestingVault Module** - Manages lock-up mechanics with subsidy distribution

### Off-Chain Infrastructure

- **Nautilus** - Verifiable AI compute for fairness scoring and match optimization
- **Walrus** - Decentralized storage for vesting proofs and historical order data

### Frontend Application

- **Framework** - Next.js with React
- **Authentication** - Sui zkLogin SDK integration
- **Interface** - Gamified dashboard with real-time fairness metrics and position privacy controls

### External Integrations

- **DeepBook** - Liquidation routing and referral revenue
- **Price Oracles** - Supra or Pyth for accurate collateral valuation
- **Mysticeti** - Sui's consensus mechanism for fast finality

---

## Deployed Contracts

The following contracts are deployed on Sui Testnet:

### Package and Module Addresses

| Component          | Address                                                              |
| ------------------ | -------------------------------------------------------------------- |
| Package ID         | `0x60db99c5af7bea80b5ff36922cf73964688923449e59347457be8e6e20e4c13a` |
| Registry           | `0xa62c9a091b001bb7e76fb416c8a87e426e468bca4d05a01f8c0418d4b762b741` |
| Vesting Vault      | `0x8b6592ee78b218513582a509f68fe1905ac3dc2d7d122c1a51a50f4e9be1ddf1` |
| Market (Orderbook) | `0x0878c322476450da4ba9b5abd7e6cec4c2db1a9ab14fc77bde3237858f6cb86e` |

### Admin Capabilities

| Asset          | Admin Cap ID                                                         |
| -------------- | -------------------------------------------------------------------- |
| USDC Admin Cap | `0xffa94cd074e29ce7fbe7aa43690144b53afeec6aaa5c6239eb3090434c78c62d` |
| ETH Admin Cap  | `0x9e18bfaa3227bc3ff2117d38a061fbdba372f02c66581ce7279b264a73573e5c` |

### Network Configuration

- **Network**: Sui Testnet
- **RPC URL**: https://fullnode.testnet.sui.io:443
- **Deployment Date**: 2026-02-08

---

## Why Sui Blockchain

Equinox leverages Sui's unique capabilities that make this design possible:

| Sui Feature          | Equinox Application                                              |
| -------------------- | ---------------------------------------------------------------- |
| Mysticeti Consensus  | Sub-second finality enables real-time dynamic matching           |
| Object-Centric Model | Each loan is an independent object for parallel processing       |
| Parallel Execution   | High throughput without congestion during peak demand            |
| Native ZK Support    | Efficient zero-knowledge proof verification for hidden positions |
| Nautilus Stack       | Verifiable off-chain compute exclusive to Sui                    |
| Walrus Storage       | Trusted decentralized storage for sensitive data                 |
| zkLogin              | Frictionless onboarding without wallet complexity                |
| Low Fees             | Frequent order updates remain economically viable                |

---

## Links

| Resource          | Link                                                  |
| ----------------- | ----------------------------------------------------- |
| Live Application  | [Launch App](https://equinox-fi.vercel.app)           |
| GitHub Repository | [View Code](https://github.com/yeheskieltame/Equinox) |

---

Built for HackMoney x Sui 2026
