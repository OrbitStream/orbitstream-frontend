'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '../../hooks/useWallet';
import { merchantLogin, fetchMerchantStats } from '../../lib/api';

export default function MerchantDashboard() {
  const { address, connect, isConnected, isConnecting, isAvailable } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ sessions: number; payments: number; revenue: string } | null>(null);

  const handleLogin = async () => {
    if (!address) return;
    setLoggingIn(true);
    setLoginError(null);
      try {
        const result = await merchantLogin(address);
        setToken(result.access_token);
        try {
          localStorage.setItem('orbitstream_jwt', result.access_token);
        } catch {
          // ignore localStorage errors
        }
      } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setLoginError(message);
    } finally {
      setLoggingIn(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orbitstream_jwt');
      if (saved) setToken(saved);
    } catch (err) {
      console.error('Unable to read JWT from localStorage:', err);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const s = await fetchMerchantStats(token);
        if (!mounted) return;
        setStats({
          sessions: s.totalSessions ?? 0,
          payments: s.totalPayments ?? 0,
          revenue: s.revenue ?? '$0.00',
        });
      } catch (err) {
        console.error('Unable to fetch merchant stats:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <span className="text-xs font-black text-white">O</span>
            </div>
            <span className="text-sm font-bold text-white">OrbitStream</span>
          </div>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">
            Home
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-4">Merchant Dashboard</h1>
            <p className="text-zinc-400 mb-6">
              Connect your Stellar wallet to access your dashboard.
            </p>
            <button
              onClick={async () => {
                setConnectError(null);
                try {
                  await connect();
                } catch (err) {
                  setConnectError(err instanceof Error ? err.message : 'Failed to connect wallet');
                }
              }}
              disabled={isConnecting}
              className="px-6 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
            >
              {isConnecting ? 'Connecting…' : 'Connect Freighter Wallet'}
            </button>
            {connectError ? <p className="text-sm text-red-400 mt-2">{connectError}</p> : null}
            {isAvailable === false ? (
              <p className="text-sm text-zinc-400 mt-2">
                Freighter not detected — install the extension from{' '}
                <a
                  href="https://www.freighter.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  freighter.app
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : !token ? (
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-4">Welcome Back</h1>
            <p className="text-zinc-400 mb-2">
              Wallet: <code className="text-zinc-300 text-xs">{address}</code>
            </p>
            <button
              onClick={handleLogin}
              disabled={loggingIn}
              className="px-6 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg transition-colors mt-4"
            >
              {loggingIn ? 'Logging in...' : 'Sign In'}
            </button>
            {loginError ? <p className="text-sm text-red-400 mt-2">{loginError}</p> : null}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-zinc-500">{address}</p>
              </div>
              <a
                href="/merchant/settings"
                className="px-4 py-2 text-sm text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors"
              >
                Settings
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs text-zinc-500 mb-1">Total Sessions</p>
                <p className="text-2xl font-black font-mono text-white">{stats ? stats.sessions : '—'}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs text-zinc-500 mb-1">Payments Received</p>
                <p className="text-2xl font-black font-mono text-white">{stats ? stats.payments : '—'}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs text-zinc-500 mb-1">Revenue</p>
                <p className="text-2xl font-black font-mono text-white">{stats ? stats.revenue : '—'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-sm font-bold text-white mb-4">Recent Payments</h2>
              <p className="text-sm text-zinc-500">
                No payments yet. Create a checkout session to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
