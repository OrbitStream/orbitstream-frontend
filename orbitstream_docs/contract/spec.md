# Escrow Smart Contract Specification

The OrbitStream Escrow contract handles decentralized payments between buyers and sellers on Stellar / Soroban. It acts as a financial escrow mechanism by directly locking, releasing, and refunding asset tokens.

---

## Technical Context & Functions

- `create_escrow`: `src/lib.rs:20-73`
- `release`: `src/lib.rs:76-98`
- `refund`: `src/lib.rs:101-128`
- Soroban token interface: `token::Client::new(&env, &token).transfer(&from, &to, &amount)`

---

## Data Structures

### `Escrow`
```rust
pub struct Escrow {
    pub buyer: Address,
    pub seller: Address,
    pub token: Address,
    pub amount: i128,
    pub status: EscrowStatus,
}
```

### `EscrowStatus`
- `Pending`: Escrow created, tokens locked in contract account.
- `Released`: Buyer released escrow; tokens transferred to seller.
- `Refunded`: Seller refunded escrow (or expired); tokens returned to buyer.

---

## Contract Interface & Token Transfers

### 1. `create_escrow`
Locks tokens from the buyer into the contract address upon creation.

- **Parameters**: `(env: Env, escrow_id: u64, buyer: Address, seller: Address, token: Address, amount: i128)`
- **Authentication**: Requires `buyer.require_auth()`
- **Token Transfer**:
  ```rust
  token::Client::new(&env, &token).transfer(&buyer, &env.current_contract_address(), &amount);
  ```
- **Balance Effects**:
  - `buyer` balance: `-amount`
  - `contract` balance: `+amount`

---

### 2. `release`
Transfers locked escrow funds from the contract address to the seller.

- **Parameters**: `(env: Env, escrow_id: u64)`
- **Authentication**: Requires `escrow.buyer.require_auth()`
- **State Check**: Escrow status must be `Pending`
- **Token Transfer**:
  ```rust
  token::Client::new(&env, &escrow.token).transfer(&env.current_contract_address(), &escrow.seller, &escrow.amount);
  ```
- **Balance Effects**:
  - `contract` balance: `-amount`
  - `seller` balance: `+amount`

---

### 3. `refund`
Returns locked escrow funds from the contract address back to the buyer.

- **Parameters**: `(env: Env, escrow_id: u64)`
- **Authentication**: Requires `escrow.seller.require_auth()`
- **State Check**: Escrow status must be `Pending`
- **Token Transfer**:
  ```rust
  token::Client::new(&env, &escrow.token).transfer(&env.current_contract_address(), &escrow.buyer, &escrow.amount);
  ```
- **Balance Effects**:
  - `contract` balance: `-amount`
  - `buyer` balance: `+amount`

---

## Usage Example & Balance Lifecycle

```rust
// 1. Initial State
// Buyer balance: 1000 tokens, Seller balance: 0, Contract balance: 0

// 2. Buyer creates escrow #1 for 400 tokens
contract.create_escrow(&1, &buyer, &seller, &token, &400);
// Buyer balance: 600 tokens
// Contract balance: 400 tokens

// 3. Buyer releases escrow #1
contract.release(&1);
// Contract balance: 0 tokens
// Seller balance: 400 tokens
```
