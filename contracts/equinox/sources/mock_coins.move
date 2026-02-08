#[allow(lint(public_entry), unused_variable, unused_mut_parameter, lint(self_transfer))]
/// Mock Coins Module for Equinox MVP
/// Provides USDC (stablecoin) and ETH (wrapped ETH) mock tokens for testing
/// along with native SUI support
module equinox::mock_coins {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::url;

    // ============== MOCK USDC ==============
    /// One-Time-Witness for USDC
    public struct MOCK_USDC has drop {}

    /// USDC Admin capability for minting
    public struct USDCAdminCap has key, store {
        id: UID,
        treasury: TreasuryCap<MOCK_USDC>,
    }

    // ============== MOCK ETH ==============
    /// One-Time-Witness for ETH
    public struct MOCK_ETH has drop {}

    /// ETH Admin capability for minting  
    public struct ETHAdminCap has key, store {
        id: UID,
        treasury: TreasuryCap<MOCK_ETH>,
    }

    // ============== CONSTANTS ==============
    const USDC_DECIMALS: u8 = 6;  // Standard USDC decimals
    const ETH_DECIMALS: u8 = 8;   // 8 decimals for wrapped ETH

    // ============== INIT ==============
    #[allow(lint(share_owned), deprecated_usage)]
    fun init(ctx: &mut TxContext) {
        // Note: In a real deployment, we would need separate modules for each coin
        // For MVP testing, we'll create both coins here
        // The actual OTW creation happens via the publish process
    }

    // ============== USDC FUNCTIONS ==============
    /// Initialize USDC mock token (call this separately with OTW)
    #[allow(lint(share_owned), deprecated_usage)]
    public fun init_usdc(witness: MOCK_USDC, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            USDC_DECIMALS,
            b"USDC",
            b"USD Coin (Mock)",
            b"Mock USDC for Equinox testnet - 6 decimals",
            option::some(url::new_unsafe_from_bytes(
                b"https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdc.png/public"
            )),
            ctx
        );
        
        transfer::public_freeze_object(metadata);
        
        let admin = USDCAdminCap {
            id: object::new(ctx),
            treasury,
        };
        transfer::transfer(admin, tx_context::sender(ctx));
    }

    /// Mint USDC to recipient
    public entry fun mint_usdc(
        admin: &mut USDCAdminCap,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut admin.treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Mint USDC and return the coin (for composability)
    public fun mint_usdc_coin(
        admin: &mut USDCAdminCap,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<MOCK_USDC> {
        coin::mint(&mut admin.treasury, amount, ctx)
    }

    // ============== ETH FUNCTIONS ==============
    /// Initialize ETH mock token (call this separately with OTW)
    #[allow(lint(share_owned), deprecated_usage)]
    public fun init_eth(witness: MOCK_ETH, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            ETH_DECIMALS,
            b"ETH",
            b"Wrapped Ether (Mock)",
            b"Mock wETH for Equinox testnet - 8 decimals",
            option::some(url::new_unsafe_from_bytes(
                b"https://cryptologos.cc/logos/ethereum-eth-logo.png"
            )),
            ctx
        );
        
        transfer::public_freeze_object(metadata);
        
        let admin = ETHAdminCap {
            id: object::new(ctx),
            treasury,
        };
        transfer::transfer(admin, tx_context::sender(ctx));
    }

    /// Mint ETH to recipient
    public entry fun mint_eth(
        admin: &mut ETHAdminCap,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut admin.treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Mint ETH and return the coin (for composability)
    public fun mint_eth_coin(
        admin: &mut ETHAdminCap,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<MOCK_ETH> {
        coin::mint(&mut admin.treasury, amount, ctx)
    }

    // ============== HELPER FUNCTIONS ==============
    /// Get USDC amount from human-readable format (e.g., 100 USDC = 100_000000)
    public fun usdc_amount(amount: u64): u64 {
        amount * 1_000_000 // 6 decimals
    }

    /// Get ETH amount from human-readable format (e.g., 1 ETH = 1_00000000)
    public fun eth_amount(amount: u64): u64 {
        amount * 100_000_000 // 8 decimals
    }

    // ============== TEST ONLY ==============
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init_usdc(MOCK_USDC {}, ctx);
        init_eth(MOCK_ETH {}, ctx);
    }

    #[test_only]
    public fun get_usdc_witness(): MOCK_USDC {
        MOCK_USDC {}
    }

    #[test_only]
    public fun get_eth_witness(): MOCK_ETH {
        MOCK_ETH {}
    }
}
