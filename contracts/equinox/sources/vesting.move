#[allow(lint(public_entry), lint(share_owned))]
module equinox::vesting {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    
    /// Error codes
    const EPositionNotMature: u64 = 0;
    const EInvalidProof: u64 = 1;

    /// The Vault that holds the locked tokens
    public struct VestingVault has key {
        id: UID,
        balance: Balance<SUI>,
        // In a real implementation, we would likely track total staked, etc.
    }

    /// Represents a user's locked position
    public struct VestingPosition has key, store {
        id: UID,
        amount: u64,
        start_timestamp: u64,
        lock_duration: u64,
        owner: address,
    }

    /// Event emitted when tokens are locked
    public struct Locked has copy, drop {
        position_id: ID,
        user: address,
        amount: u64,
        unlock_time: u64,
    }

    /// Event emitted when tokens are unlocked
    public struct Unlocked has copy, drop {
        position_id: ID,
        user: address,
        amount: u64,
        reward: u64, // Simulated reward
    }

    #[allow(lint(share_owned))]
    fun init(ctx: &mut TxContext) {
        let vault = VestingVault {
            id: object::new(ctx),
            balance: balance::zero(),
        };
        transfer::share_object(vault);
    }

    /// Lock tokens to receive a VestingPosition.
    /// Uses Groth16 ZK Proof to valid vesting status.
    /// The proof confirms the user is eligible without revealing sensitive off-chain data.
    public entry fun lock(
        vault: &mut VestingVault,
        payment: Coin<SUI>,
        duration: u64,
        // ZK Proof Inputs (Bytes)
        zk_proof_points: vector<u8>, 
        zk_public_inputs: vector<u8>,
        zk_verifying_key: vector<u8>, // Canonical serialization of VK
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify ZK Proof (Groth16 - BN254)
        let curve = sui::groth16::bn254();
        
        // Prepare VK
        let pvk = sui::groth16::prepare_verifying_key(&curve, &zk_verifying_key);
        
        // Deserialize Proof and Inputs
        let proof_points = sui::groth16::proof_points_from_bytes(zk_proof_points);
        let public_inputs = sui::groth16::public_proof_inputs_from_bytes(zk_public_inputs);

        let verified = sui::groth16::verify_groth16_proof(
            &curve, 
            &pvk, 
            &public_inputs, 
            &proof_points
        );
        assert!(verified, EInvalidProof);

        let amount = coin::value(&payment);
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut vault.balance, coin_balance);

        let start_time = clock::timestamp_ms(clock);
        
        let position = VestingPosition {
            id: object::new(ctx),
            amount,
            start_timestamp: start_time,
            lock_duration: duration,
            owner: tx_context::sender(ctx),
        };

        event::emit(Locked {
            position_id: object::id(&position),
            user: tx_context::sender(ctx),
            amount,
            unlock_time: start_time + duration,
        });

        transfer::public_transfer(position, tx_context::sender(ctx));
    }

    /// Unlock tokens after duration.
    public entry fun unlock(
        vault: &mut VestingVault,
        position: VestingPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= position.start_timestamp + position.lock_duration, EPositionNotMature);

        let VestingPosition { id, amount, start_timestamp: _, lock_duration: _, owner: _ } = position;
        let position_id = object::uid_to_inner(&id);
        object::delete(id);

        // Simulate a reward/yield (e.g. 5% simple interest logic could go here)
        // For now, we just return the principal.
        let principal = balance::split(&mut vault.balance, amount);
        let coin = coin::from_balance(principal, ctx);

        event::emit(Unlocked {
            position_id,
            user: tx_context::sender(ctx),
            amount,
            reward: 0, 
        });

        transfer::public_transfer(coin, tx_context::sender(ctx));
    }
}
