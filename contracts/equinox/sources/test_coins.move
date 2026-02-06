#[allow(lint(public_entry))]
module equinox::test_coins {
    use sui::coin::{Self, TreasuryCap};
    use sui::url;

    /// One-Time-Witness (OTW) must match the module name uppercased
    public struct TEST_COINS has drop {}

    /// Mock USDC tag (we can't use this as OTW if it doesn't match module name)
    public struct USDC has drop {}

    #[allow(lint(share_owned), deprecated_usage)]
    fun init(witness: TEST_COINS, ctx: &mut TxContext) {
        // We use the OTW to create the USDC currency metadata for this test module
        // Note: For a real token, the module name should match the coin symbol or we use a separate module.
        // Here we just use create_currency with the OTW.
        
        let (treasury, metadata) = coin::create_currency(
            witness, 
            6, 
            b"USDC", 
            b"USDC Coin", 
            b"Testnet USDC", 
            option::some(url::new_unsafe_from_bytes(b"https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdc.png/public")), 
            ctx
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }

    public entry fun mint_usdc(
        treasury: &mut TreasuryCap<USDC>, 
        amount: u64, 
        recipient: address, 
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
