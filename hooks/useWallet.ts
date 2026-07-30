import { useState, useCallback, useEffect } from 'react';
import freighterApi from '@stellar/freighter-api';
import { networkPassphrase } from '../lib/stellar';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const status = await freighterApi.isConnected();
        const available = !!status?.isConnected;
        if (!mounted) return;
        setIsAvailable(available);

        if (available) {
          const resp = await freighterApi.getAddress();
          if (!mounted) return;
          setAddress(resp?.address ?? null);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to detect Freighter:', err);
        setIsAvailable(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);

    try {
      const status = await freighterApi.isConnected();
      const isInstalled = !!status?.isConnected;
      if (!isInstalled) {
        setIsAvailable(false);
        throw new Error('Freighter wallet is not installed. Please install the Freighter browser extension.');
      }

      const access = await freighterApi.requestAccess();
      if (access.error) {
        throw new Error(access.error.message || 'Freighter access request failed.');
      }

      const walletAddress = access.address || (await freighterApi.getAddress()).address;
      setAddress(walletAddress || null);
      setIsAvailable(!!walletAddress);
    } catch (err) {
      setAddress(null);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    try {
      const result = await freighterApi.signTransaction(xdr, {
        networkPassphrase,
      });
      return result.signedTxXdr;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction signing failed';
      throw new Error(message);
    }
  }, []);

  return {
    address,
    connect,
    disconnect,
    signTransaction,
    isConnected: !!address,
    isConnecting,
    isAvailable,
  };
}
