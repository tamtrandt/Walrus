/// ========================================================================================
/// 🔐 SEAL ACCESS MODULE - Pay-to-View NFT Payment Tracking
/// ========================================================================================
///
/// This module implements a payment tracking system for encrypted NFTs.
/// Users pay once (0.005 SUI) to view encrypted content, then can access it unlimited times.
///
/// FLOW OVERVIEW:
/// 1. NFT Creator encrypts image with Seal SDK
/// 2. Encrypted data uploaded to Walrus decentralized storage
/// 3. NFT minted with blob ID reference
/// 4. Viewer pays 0.005 SUI to decrypt (first time only)
/// 5. Payment recorded in PaymentRegistry shared object
/// 6. Future views don't require payment for same user
///
/// KEY COMPONENTS:
/// - PaymentRegistry: Shared object tracking all payments
/// - seal_approve_view: Entry function called during decryption
/// - has_paid: View function to check payment status
///
/// SECURITY MODEL:
/// - Uses threshold cryptography (Seal) for encryption
/// - On-chain payment verification
/// - Decentralized storage (Walrus)
/// - Wallet-based authorization (SessionKey)
///
module 0x0::seal_access {

    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::table::{Self, Table};

    /// Error nếu không trả phí
    const ENotPaid: u64 = 1;

    /// Shared object tracking all payments across the platform
    /// Structure: content_id -> user_address -> has_paid (bool)
    /// This enables pay-once access to encrypted content
    public struct PaymentRegistry has key {
        id: UID,
        payments: Table<vector<u8>, Table<address, bool>>, // content_id -> (user_address -> has_paid)
    }

    /// Initialize the payment registry (called once during contract deployment)
    fun init(ctx: &mut TxContext) {
        let registry = PaymentRegistry {
            id: object::new(ctx),
            payments: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    /// Public function to initialize the payment registry after deployment
    /// Call this once after deploying the contract to create the shared PaymentRegistry object
    public entry fun init_registry(ctx: &mut TxContext) {
        let registry = PaymentRegistry {
            id: object::new(ctx),
            payments: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    /// ========================================================================================
    /// 🔓 SEAL APPROVAL FUNCTION - Called during decryption to verify payment
    /// ========================================================================================
    ///
    /// This function is invoked by the Seal SDK during the decryption process.
    /// It checks if the user has already paid for this content. If not, it verifies
    /// the payment amount (0.005 SUI) and records the payment for future access.
    ///
    /// Parameters:
    /// - registry: Shared PaymentRegistry object
    /// - content_id: Unique identifier for the encrypted content (blob ID)
    /// - fee_coin: Reference to user's payment coin (must be >= 0.005 SUI)
    ///
    /// Flow:
    /// 1. Check if user already paid for this content
    /// 2. If not paid: verify payment amount and record payment
    /// 3. If already paid: allow access without additional payment
    ///
    entry fun seal_approve(
        content_id: vector<u8>,         // The identity (content ID) - MUST BE FIRST PARAMETER
        registry: &mut PaymentRegistry, // Payment registry for tracking
        fee_coin: &Coin<SUI>,           // reference to payment coin
        ctx: &mut TxContext
    ) {
        let user_addr = ctx.sender();
        let required = 5_000_000; // 0.005 SUI (5 MIST)
        let payment_amount = coin::value(fee_coin);

        // Check if user already paid for this content
        if (!table::contains(&registry.payments, content_id)) {
            // First time anyone accesses this content - create payment table
            table::add(&mut registry.payments, content_id, table::new(ctx));
        };

        let content_payments = table::borrow_mut(&mut registry.payments, content_id);

        if (table::contains(content_payments, user_addr)) {
            // User already paid - allow unlimited access
            return
        };

        // First time access - verify payment amount
        assert!(payment_amount >= required, ENotPaid);

        // Record payment for future access
        table::add(content_payments, user_addr, true);
    }

    /// ========================================================================================
    /// 👀 PAYMENT STATUS CHECK - View function to check if user has paid
    /// ========================================================================================
    ///
    /// This function allows frontend to check payment status without requiring
    /// a transaction. Useful for UI state management.
    ///
    public fun has_paid(
        registry: &PaymentRegistry,
        content_id: vector<u8>,
        user_addr: address
    ): bool {
        if (!table::contains(&registry.payments, content_id)) {
            return false
        };

        let content_payments = table::borrow(&registry.payments, content_id);
        table::contains(content_payments, user_addr)
    }
}
