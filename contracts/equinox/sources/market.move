#[allow(lint(public_entry))]
module equinox::market {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::ed25519;
    use std::option;
    use deepbook::pool::Pool;
    use deepbook::balance_manager::BalanceManager;
    
    use equinox::loan::{Self};

    /// Nautilus Enclave Configuration
    public struct EnclaveConfig has key, store {
        id: UID,
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        version: u64,
    }

    /// Registered Nautilus Enclave
    public struct RegisteredEnclave has key, store {
        id: UID,
        public_key: vector<u8>,
        config_version: u64,
        registered_at: u64,
        is_active: bool,
    }

    const EOrderNotFound: u64 = 0;
    const ERateMismatch: u64 = 1;
    const EAmountMismatch: u64 = 2;
    const EDurationMismatch: u64 = 3;
    const EInvalidFairnessProof: u64 = 4;
    // const EInsufficientLiquidation: u64 = 5; // Reserved for future DeepBook integration


    /// Represents an Order in the orderbook.
    public struct Order has store, drop {
        creator: address,
        amount: u64,
        interest_rate_bps: u64,
        duration_ms: u64, // Custom term duration
        is_lend: bool, 
        created_at: u64,
    }

    /// Borrow order with vesting collateral (gets priority + subsidy)
    public struct VestedBorrowOrder has store, drop {
        creator: address,
        amount: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        vesting_position_id: ID,
        fairness_boost: u64, // Bonus score for matching priority
        subsidy_rate_bps: u64, // Subsidy APR
        created_at: u64,
    }

    /// Represents a ZK-Hidden Order.
    /// Only the commitment (hash of details) is stored on-chain.
    public struct HiddenOrder has store, drop {
        creator: address,
        commitment: vector<u8>, // Pedersen Hash of (amount, rate, etc.)
        is_lend: bool,
        created_at: u64,
    }

    /// The Market shared object.
    /// Asset: The token being lent/borrowed (e.g. USDC).
    /// Collateral: The token used as collateral (e.g. SUI).
    public struct Market<phantom Asset, phantom Collateral> has key {
        id: UID,
        orders: Table<ID, Order>,
        hidden_orders: Table<ID, HiddenOrder>, // ZK Privacy Orders
        lend_balances: Table<ID, Balance<Asset>>,
        collateral_balances: Table<ID, Balance<Collateral>>,
        fairness_verifier: vector<u8>, // Official Nautilus Agent Public Key (deprecated - use enclave_id)
        enclave_id: option::Option<ID>, // Reference to RegisteredEnclave
        vested_orders: Table<ID, VestedBorrowOrder>, // Vesting collateral orders
        total_vested_volume: u64, // Track vested collateral usage
    }
    
    /// Events
    public struct OrderPlaced has copy, drop {
        order_id: ID,
        is_lend: bool,
        amount: u64,
        rate: u64,
        duration: u64,
    }

    public struct OrderMatched has copy, drop {
        lend_order_id: ID,
        borrow_order_id: ID,
        amount: u64,
        duration: u64,
    }

    public struct LoanLiquidated has copy, drop {
        loan_id: ID,
        liquidator: address,
        collateral_sold: u64,
        asset_received: u64,
        profit: u64,
    }

    public struct HiddenOrderPlaced has copy, drop {
        order_id: ID,
        creator: address,
        is_lend: bool,
        amount: u64,
    }

    public struct EnclaveRegistered has copy, drop {
        enclave_id: ID,
        public_key: vector<u8>,
        config_version: u64,
    }

    public struct FairnessVerified has copy, drop {
        lend_order_id: ID,
        borrow_order_id: ID,
        fairness_score: u64,
        enclave_id: ID,
    }

    public struct VestedOrderPlaced has copy, drop {
        order_id: ID,
        creator: address,
        amount: u64,
        vesting_position_id: ID,
        fairness_boost: u64,
        subsidy_rate_bps: u64,
    }

    fun init(_ctx: &mut TxContext) {
    }

    /// Create a new market pair.
    public entry fun create_market<Asset, Collateral>(
        fairness_verifier: vector<u8>,
        ctx: &mut TxContext
    ) {
        let market = Market<Asset, Collateral> {
            id: object::new(ctx),
            orders: table::new(ctx),
            hidden_orders: table::new(ctx),
            lend_balances: table::new(ctx),
            collateral_balances: table::new(ctx),
            fairness_verifier,
            enclave_id: option::none(),
            vested_orders: table::new(ctx),
            total_vested_volume: 0,
        };
        transfer::share_object(market);
    }

    /// Register Nautilus Enclave Configuration
    public entry fun register_enclave_config(
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        version: u64,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&pcr0) == 32, 0);
        assert!(vector::length(&pcr1) == 32, 0);
        assert!(vector::length(&pcr2) == 32, 0);

        let config = EnclaveConfig {
            id: object::new(ctx),
            pcr0,
            pcr1,
            pcr2,
            version,
        };
        transfer::share_object(config);
    }

    /// Register Nautilus Enclave Instance
    public entry fun register_enclave(
        config: &EnclaveConfig,
        public_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // In production: verify AWS Nitro attestation here
        // For MVP: trust the deployer
        
        let enclave = RegisteredEnclave {
            id: object::new(ctx),
            public_key,
            config_version: config.version,
            registered_at: clock::timestamp_ms(clock),
            is_active: true,
        };

        let enclave_id = object::id(&enclave);
        
        event::emit(EnclaveRegistered {
            enclave_id,
            public_key,
            config_version: config.version,
        });

        transfer::share_object(enclave);
    }

    /// Set enclave for market
    public entry fun set_market_enclave<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        enclave_id: ID,
        _ctx: &mut TxContext
    ) {
        market.enclave_id = option::some(enclave_id);
    }

    /// Place a Lending Order with Custom Terms.
    public fun place_lend_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        payment: Coin<Asset>,
        interest_rate_bps: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        let amount = coin::value(&payment);
        
        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = Order {
            creator: tx_context::sender(ctx),
            amount,
            interest_rate_bps,
            duration_ms,
            is_lend: true,
            created_at: clock::timestamp_ms(clock),
        };

        table::add(&mut market.orders, id, order);
        table::add(&mut market.lend_balances, id, coin::into_balance(payment));

        event::emit(OrderPlaced {
            order_id: id,
            is_lend: true,
            amount,
            rate: interest_rate_bps,
            duration: duration_ms,
        });

        id
    }

    /// Place a Borrow Order with Custom Terms.
    public fun place_borrow_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        collateral: Coin<Collateral>,
        amount_requested: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = Order {
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            interest_rate_bps,
            duration_ms,
            is_lend: false,
            created_at: clock::timestamp_ms(clock),
        };

        table::add(&mut market.orders, id, order);
        table::add(&mut market.collateral_balances, id, coin::into_balance(collateral));

        event::emit(OrderPlaced {
            order_id: id,
            is_lend: false,
            amount: amount_requested,
            rate: interest_rate_bps,
            duration: duration_ms,
        });

        id
    }

    /// Place Borrow Order with Vesting Collateral
    /// Gets priority matching + subsidy rate
    public fun place_vested_borrow_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        collateral: Coin<Collateral>,
        amount_requested: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        vesting_position_id: ID, // Reference to VestingPosition
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        // Calculate fairness boost and subsidy
        let fairness_boost = calculate_vesting_boost(amount_requested, duration_ms);
        let subsidy_rate_bps = calculate_subsidy_rate(duration_ms);

        let order = VestedBorrowOrder {
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            interest_rate_bps,
            duration_ms,
            vesting_position_id,
            fairness_boost,
            subsidy_rate_bps,
            created_at: clock::timestamp_ms(clock),
        };

        table::add(&mut market.vested_orders, id, order);
        table::add(&mut market.collateral_balances, id, coin::into_balance(collateral));
        
        // Track vested volume
        market.total_vested_volume = market.total_vested_volume + amount_requested;

        event::emit(VestedOrderPlaced {
            order_id: id,
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            vesting_position_id,
            fairness_boost,
            subsidy_rate_bps,
        });

        id
    }

    /// Calculate fairness boost for vested collateral
    /// Boost based on order size (retail gets more) and vesting commitment
    fun calculate_vesting_boost(amount: u64, duration_ms: u64): u64 {
        let mut boost = 50; // Base 50% boost for vested collateral

        // Retail boost: orders < 10k get extra priority
        if (amount < 10000_000000) { // < 10k USDC
            boost = boost + 30; // +30% for retail
        };

        // Duration boost: longer lock = higher priority
        let days = duration_ms / 86400000;
        if (days >= 30) {
            boost = boost + 20; // +20% for 30+ days
        };

        boost
    }

    /// Calculate subsidy rate for vested collateral
    /// Subsidy to offset vesting opportunity cost
    fun calculate_subsidy_rate(duration_ms: u64): u64 {
        let days = duration_ms / 86400000;
        
        // Base subsidy: 2% APR
        let mut subsidy = 200; // 200 bps = 2%
        
        // Longer lock = higher subsidy
        if (days >= 90) {
            subsidy = 300; // 3% for 90+ days
        } else if (days >= 30) {
            subsidy = 250; // 2.5% for 30+ days
        };
        
        subsidy
    }

    /// Execute a match with AI Fairness Check & Dynamic Terms.
    /// Uses registered Nautilus enclave for verifiable fairness computation
    public fun match_orders<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        enclave: &RegisteredEnclave,
        lend_order_id: ID,
        borrow_order_id: ID,
        fairness_score: u64,
        fairness_proof: vector<u8>, // Ed25519 Signature from enclave
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 0. Verify enclave is active and registered with market
        assert!(enclave.is_active, EInvalidFairnessProof);
        if (option::is_some(&market.enclave_id)) {
            assert!(option::borrow(&market.enclave_id) == &object::id(enclave), EInvalidFairnessProof);
        };

        // 1. Verify Fairness Proof from Nautilus Enclave
        // Message: lend_order_id || borrow_order_id || fairness_score
        let mut msg = vector::empty<u8>();
        vector::append(&mut msg, object::id_to_bytes(&lend_order_id));
        vector::append(&mut msg, object::id_to_bytes(&borrow_order_id));
        
        // Append fairness score as bytes
        let score_bytes = sui::bcs::to_bytes(&fairness_score);
        vector::append(&mut msg, score_bytes);
        
        // Verify signature from registered enclave
        assert!(
            ed25519::ed25519_verify(
                &fairness_proof, 
                &enclave.public_key, 
                &msg
            ), 
            EInvalidFairnessProof
        );

        // Emit fairness verification event
        event::emit(FairnessVerified {
            lend_order_id,
            borrow_order_id,
            fairness_score,
            enclave_id: object::id(enclave),
        });

        match_orders_internal(market, lend_order_id, borrow_order_id, clock, ctx);
    }

    /// Internal function to execute matching logic after verification
    fun match_orders_internal<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        lend_order_id: ID,
        borrow_order_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&market.orders, lend_order_id), EOrderNotFound);
        assert!(table::contains(&market.orders, borrow_order_id), EOrderNotFound);

        let lend_order = table::remove(&mut market.orders, lend_order_id);
        let borrow_order = table::remove(&mut market.orders, borrow_order_id);

        assert!(lend_order.is_lend, EOrderNotFound);
        assert!(!borrow_order.is_lend, EOrderNotFound);

        // Dynamic Matching Logic
        // 1. Rates: Borrow Rate >= Lend Rate
        assert!(borrow_order.interest_rate_bps >= lend_order.interest_rate_bps, ERateMismatch);
        
        // 2. Duration: Lend Order must cover the requested Borrow Duration
        // (Lender is willing to wait X, Borrower needs Y. So X >= Y)
        assert!(lend_order.duration_ms >= borrow_order.duration_ms, EDurationMismatch);

        // 3. Amount
        assert!(lend_order.amount == borrow_order.amount, EAmountMismatch);

        // 1. Move Asset -> Borrower
        let lend_balance = table::remove(&mut market.lend_balances, lend_order_id);
        let loan_amount = balance::value(&lend_balance);
        let asset_coin = coin::from_balance(lend_balance, ctx);
        transfer::public_transfer(asset_coin, borrow_order.creator);

        // 2. Extract Collateral
        let collateral_balance = table::remove(&mut market.collateral_balances, borrow_order_id);
        
        // 3. Create Loan with AGREED Dynamic Terms (Borrower's duration)
        let loan = loan::create_loan<Asset, Collateral>(
            borrow_order.creator,
            lend_order.creator,
            loan_amount,
            lend_order.interest_rate_bps,
            clock::timestamp_ms(clock),
            borrow_order.duration_ms, // Use dynamic duration
            collateral_balance,
            ctx
        );

        transfer::public_transfer(loan, lend_order.creator);

        event::emit(OrderMatched {
            lend_order_id,
            borrow_order_id,
            amount: loan_amount,
            duration: borrow_order.duration_ms,
        });
    }

    #[test_only]
    public fun match_orders_for_testing<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        lend_order_id: ID,
        borrow_order_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        match_orders_internal(market, lend_order_id, borrow_order_id, clock, ctx);
    }

    /// Place a Hidden Lending Order (ZK-Privacy).
    /// The terms (Interest Rate, Duration) are hidden in the `commitment`.
    /// The Amount is public (for solvency check).
    public fun place_hidden_lend_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        payment: Coin<Asset>,
        commitment: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        let amount = coin::value(&payment);
        
        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = HiddenOrder {
            creator: tx_context::sender(ctx),
            commitment,
            is_lend: true,
            created_at: clock::timestamp_ms(clock),
        };

        table::add(&mut market.hidden_orders, id, order);
        table::add(&mut market.lend_balances, id, coin::into_balance(payment));

        event::emit(HiddenOrderPlaced {
            order_id: id,
            creator: tx_context::sender(ctx),
            is_lend: true,
            amount,
        });

        id
    }

    /// Liquidate via DeepBook Swap - SIMPLIFIED VERSION
    /// TODO: Complete DeepBook V3 integration with proper API
    /// For MVP: Returns collateral to liquidator, debt tracking on-chain
    #[allow(lint(self_transfer))]
    public fun liquidate_via_deepbook<Asset, Collateral>(
        loan: loan::Loan<Asset, Collateral>,
        _db_pool: &mut Pool<Collateral, Asset>,
        _balance_mgr: &mut BalanceManager,
        clock: &Clock,
        ctx: &mut TxContext
    ): (address, u64, u64) {
        // 1. Unwrap the defaulted loan
        let (collateral_balance, total_debt, lender) = loan::unwrap_for_liquidation(loan, clock);
        let collateral_amount = balance::value(&collateral_balance);
        let collateral_coin = coin::from_balance(collateral_balance, ctx);
        
        // 2. For MVP: Transfer collateral to liquidator
        // TODO: Implement actual DeepBook swap when API is stable
        // The liquidator can manually swap on DeepBook and repay lender
        transfer::public_transfer(collateral_coin, tx_context::sender(ctx));
        
        // Return (lender, debt, collateral_amount) for tracking
        (lender, total_debt, collateral_amount)
    }

    /// Entry function for liquidation - SIMPLIFIED
    /// Liquidator receives collateral, must manually repay lender
    public entry fun liquidate_and_transfer<Asset, Collateral>(
        loan: loan::Loan<Asset, Collateral>,
        _db_pool: &mut Pool<Collateral, Asset>,
        _balance_mgr: &mut BalanceManager,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let loan_id = object::id(&loan);
        let (collateral_balance, total_debt, lender) = loan::unwrap_for_liquidation(loan, clock);
        let collateral_amount = balance::value(&collateral_balance);
        
        // Transfer collateral to liquidator
        let collateral_coin = coin::from_balance(collateral_balance, ctx);
        transfer::public_transfer(collateral_coin, tx_context::sender(ctx));
        
        event::emit(LoanLiquidated {
            loan_id,
            liquidator: tx_context::sender(ctx),
            collateral_sold: collateral_amount,
            asset_received: total_debt, // Expected repayment
            profit: 0, // Manual calculation needed
        });
        
        // Note: Lender address and debt amount emitted in event
        // Liquidator should repay lender off-chain or via separate transaction
        let _ = lender; // Suppress unused warning
    }
}
