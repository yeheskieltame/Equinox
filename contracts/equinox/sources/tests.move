#[test_only]
module equinox::tests {
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::test_scenario::{Self as ts};
    use sui::object::{Self, ID};
    use std::debug;
    use std::string::{Self, String};
    use equinox::market::{Self, Market};
    use equinox::loan::{Self, Loan};


    // Mock Coins
    public struct USDC has drop {}
    public struct SUI has drop {}



    #[test]
    fun test_lend_borrow_match_repay() {
        let lender = @0xA;
        let borrower = @0xB;
        let nautilus_agent = @0xC;
        
        debug::print(&string::utf8(b"🚀 STARTING EQUINOX LENDING TEST FLOW"));

        let mut scenario = ts::begin(nautilus_agent);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // 1. Setup Market
        market::create_market<USDC, SUI>(vector::empty(), ts::ctx(&mut scenario));
        debug::print(&string::utf8(b"✅ Market Created"));
        
        // ---------------------------------------------------------
        // 2. Lender Places Order
        // ---------------------------------------------------------
        let mut _lend_id: Option<ID> = option::none();
        
        ts::next_tx(&mut scenario, lender);
        {
            let mut market = ts::take_shared<Market<USDC, SUI>>(&scenario);
            
            // Amount: 1000 USDC
            // Use mint_for_testing to avoid TreasuryCap/OTW requirement
            let coin_usdc = coin::mint_for_testing<USDC>(1000_000000, ts::ctx(&mut scenario));
            let id = market::place_lend_order(&mut market, coin_usdc, 500, 86400000 * 10, &clock, ts::ctx(&mut scenario));
            _lend_id = option::some(id);

            debug::print(&string::utf8(b"💰 Lender Placed Order: 1000 USDC @ 5% APY"));
            ts::return_shared(market);
        };

        // ---------------------------------------------------------
        // 3. Borrower Places Order
        // ---------------------------------------------------------
        let mut _borrow_id: Option<ID> = option::none();

        ts::next_tx(&mut scenario, borrower);
        {
            let mut market = ts::take_shared<Market<USDC, SUI>>(&scenario);
            
            // Wants 1000 USDC, Offers SUI Collateral worth 2000 USD
            let coin_sui = coin::mint_for_testing<SUI>(2000_000000000, ts::ctx(&mut scenario));
            let id = market::place_borrow_order(&mut market, coin_sui, 1000_000000, 600, 86400000 * 5, &clock, ts::ctx(&mut scenario));
            _borrow_id = option::some(id);

            debug::print(&string::utf8(b"🙋 Borrower Placed Order: Request 1000 USDC / Offers 2000 SUI Collateral"));
            ts::return_shared(market);
        };

        // ---------------------------------------------------------
        // 4. Nautilus Agent Matches
        // ---------------------------------------------------------
        ts::next_tx(&mut scenario, nautilus_agent);
        {
             let mut market = ts::take_shared<Market<USDC, SUI>>(&scenario);
             
             market::match_orders_for_testing(
                 &mut market, 
                 option::extract(&mut _lend_id), 
                 option::extract(&mut _borrow_id), 
                 &clock, 
                 ts::ctx(&mut scenario)
             );

             debug::print(&string::utf8(b"🤖 Nautilus AI Agent: Orders Matched Successfully!"));
             ts::return_shared(market);
        };

        // ---------------------------------------------------------
        // 5. Borrower Receives Funds
        // ---------------------------------------------------------
        ts::next_tx(&mut scenario, borrower);
        {
            let coin_usdc = ts::take_from_sender<Coin<USDC>>(&scenario);
            assert!(coin::value(&coin_usdc) == 1000_000000, 0);
            debug::print(&string::utf8(b"💵 Borrower Wallet: Received 1000 USDC"));
            ts::return_to_sender(&scenario, coin_usdc);
        };

        // ---------------------------------------------------------
        // 6. Lender Receives Loan Object
        // ---------------------------------------------------------
        ts::next_tx(&mut scenario, lender);
        {
             let loan = ts::take_from_sender<Loan<USDC, SUI>>(&scenario);
             debug::print(&string::utf8(b"📜 Lender Wallet: Received Loan NFT Object"));
             ts::return_to_sender(&scenario, loan);
        };

        // ---------------------------------------------------------
        // 7. Repayment
        // ---------------------------------------------------------
        clock::increment_for_testing(&mut clock, 86400000); 
        debug::print(&string::utf8(b"⏳ Time Passes: 1 Day Later..."));

        ts::next_tx(&mut scenario, lender);
        {
             let loan = ts::take_from_sender<Loan<USDC, SUI>>(&scenario);
             // Mint repayment coin
             let payment = coin::mint_for_testing<USDC>(1000_200_000, ts::ctx(&mut scenario));
             loan::repay(loan, payment, &clock, ts::ctx(&mut scenario));
             debug::print(&string::utf8(b"✅ Loan Repaid: Principal + Interest Payment Processed"));
        };

        // 8. Verify Collateral Return
        ts::next_tx(&mut scenario, borrower); 
        {
             let collateral = ts::take_from_sender<Coin<SUI>>(&scenario);
             assert!(coin::value(&collateral) == 2000_000000000, 1);
             debug::print(&string::utf8(b"🔓 Collateral Unlocked: 2000 SUI returned to Borrower"));
             ts::return_to_sender(&scenario, collateral);
        };
        
        debug::print(&string::utf8(b"🎉 EQUINOX TEST FLOW COMPLETED SUCCESSFULLY"));

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
