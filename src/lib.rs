#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    InvalidStatus = 3,
    InvalidAmount = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Pending,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub buyer: Address,
    pub seller: Address,
    pub token: Address,
    pub amount: i128,
    pub status: EscrowStatus,
}

#[contracttype]
pub enum DataKey {
    Escrow(u64),
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Creates a new escrow and locks tokens from buyer into the escrow contract.
    pub fn create_escrow(
        env: Env,
        escrow_id: u64,
        buyer: Address,
        seller: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        buyer.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Escrow(escrow_id);
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyExists);
        }

        // Lock funds: transfer tokens from buyer to contract address
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        let escrow = Escrow {
            buyer,
            seller,
            token,
            amount,
            status: EscrowStatus::Pending,
        };

        env.storage().persistent().set(&key, &escrow);

        Ok(())
    }

    /// Releases locked funds from contract address to the seller.
    pub fn release(env: Env, escrow_id: u64) -> Result<(), Error> {
        let key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;

        if escrow.status != EscrowStatus::Pending {
            return Err(Error::InvalidStatus);
        }

        escrow.buyer.require_auth();

        // Release funds: transfer tokens from contract address to seller
        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.seller, &escrow.amount);

        escrow.status = EscrowStatus::Released;
        env.storage().persistent().set(&key, &escrow);

        Ok(())
    }

    /// Refunds locked funds from contract address back to the buyer.
    pub fn refund(env: Env, escrow_id: u64) -> Result<(), Error> {
        let key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;

        if escrow.status != EscrowStatus::Pending {
            return Err(Error::InvalidStatus);
        }

        escrow.seller.require_auth();

        // Refund funds: transfer tokens from contract address back to buyer
        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.buyer, &escrow.amount);

        escrow.status = EscrowStatus::Refunded;
        env.storage().persistent().set(&key, &escrow);

        Ok(())
    }

    /// Returns the escrow record for a given escrow ID.
    pub fn get_escrow(env: Env, escrow_id: u64) -> Option<Escrow> {
        let key = DataKey::Escrow(escrow_id);
        env.storage().persistent().get(&key)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn create_token_contract<'a>(
        env: &Env,
        admin: &Address,
    ) -> (Address, token::Client<'a>, token::StellarAssetClient<'a>) {
        let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_client = token::Client::new(env, &token_address);
        let admin_client = token::StellarAssetClient::new(env, &token_address);
        (token_address, token_client, admin_client)
    }

    #[test]
    fn test_create_escrow_transfers_tokens() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let seller = Address::generate(&env);

        let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);

        let initial_buyer_balance = 1000i128;
        let escrow_amount = 400i128;

        admin_client.mint(&buyer, &initial_buyer_balance);

        assert_eq!(token_client.balance(&buyer), 1000);
        assert_eq!(token_client.balance(&contract_id), 0);
        assert_eq!(token_client.balance(&seller), 0);

        client.create_escrow(&1, &buyer, &seller, &token_address, &escrow_amount);

        // Verify token balance changes
        assert_eq!(token_client.balance(&buyer), 600);
        assert_eq!(token_client.balance(&contract_id), 400);
        assert_eq!(token_client.balance(&seller), 0);

        let escrow = client.get_escrow(&1).unwrap();
        assert_eq!(escrow.status, EscrowStatus::Pending);
    }

    #[test]
    fn test_release_transfers_tokens_to_seller() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let seller = Address::generate(&env);

        let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);

        admin_client.mint(&buyer, &1000);

        client.create_escrow(&1, &buyer, &seller, &token_address, &400);
        assert_eq!(token_client.balance(&contract_id), 400);

        client.release(&1);

        // Verify token balance changes
        assert_eq!(token_client.balance(&buyer), 600);
        assert_eq!(token_client.balance(&contract_id), 0);
        assert_eq!(token_client.balance(&seller), 400);

        let escrow = client.get_escrow(&1).unwrap();
        assert_eq!(escrow.status, EscrowStatus::Released);
    }

    #[test]
    fn test_refund_transfers_tokens_to_buyer() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let seller = Address::generate(&env);

        let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);

        admin_client.mint(&buyer, &1000);

        client.create_escrow(&1, &buyer, &seller, &token_address, &400);
        assert_eq!(token_client.balance(&buyer), 600);
        assert_eq!(token_client.balance(&contract_id), 400);

        client.refund(&1);

        // Verify token balance changes
        assert_eq!(token_client.balance(&buyer), 1000);
        assert_eq!(token_client.balance(&contract_id), 0);
        assert_eq!(token_client.balance(&seller), 0);

        let escrow = client.get_escrow(&1).unwrap();
        assert_eq!(escrow.status, EscrowStatus::Refunded);
    }

    #[test]
    #[should_panic]
    fn test_insufficient_balance_fails_create_escrow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let seller = Address::generate(&env);

        let (token_address, _token_client, admin_client) = create_token_contract(&env, &admin);

        // Buyer only has 100 tokens, trying to lock 500
        admin_client.mint(&buyer, &100);

        client.create_escrow(&1, &buyer, &seller, &token_address, &500);
    }
}
