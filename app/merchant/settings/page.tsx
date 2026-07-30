'use client';

import { useState } from 'react';
import { useWallet } from '../../../hooks/useWallet';
import { generateApiKey, saveWebhookUrl } from '../../../lib/api';

export default function MerchantSettings() {
  const { connect, isConnected } = useWallet();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [token] = useState<string | null>(() => {
    try {
      return localStorage.getItem('orbitstream_jwt');
    } catch {
      return null;
    }
  });

  const handleGenerateKey = async () => {
    setError(null);
    setMessage(null);
    if (!token) return setError('Not authenticated');
    try {
      const res = await generateApiKey(token);
      setApiKey(res.key ?? res.apiKey ?? null);
      setMessage('API key generated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate key');
    }
  };

  const handleSaveWebhook = async () => {
    setError(null);
    setMessage(null);
    if (!token) return setError('Not authenticated');
    try {
      await saveWebhookUrl(token, webhookUrl);
      setMessage('Webhook saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save webhook');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Connect your wallet to access settings.</p>
          <button
            onClick={async () => {
              setConnectError(null);
              try {
                await connect();
              } catch (err) {
                setConnectError(err instanceof Error ? err.message : 'Failed to connect wallet');
              }
            }}
            className="px-6 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
          >
            Connect Freighter
          </button>
          {connectError ? <p className="text-sm text-red-400 mt-2">{connectError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <span className="text-xs font-black text-white">O</span>
            </div>
            <span className="text-sm font-bold text-white">OrbitStream</span>
          </div>
          <a href="/merchant" className="text-sm text-zinc-400 hover:text-white">
            Dashboard
          </a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* API Keys */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-bold text-white mb-4">API Keys</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Use API keys to create checkout sessions programmatically.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={handleGenerateKey} className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              Generate New Key
            </button>
            {apiKey ? <code className="text-xs bg-zinc-800 px-2 py-1 rounded">{apiKey}</code> : null}
          </div>
          {message ? <p className="text-sm text-green-400 mt-2">{message}</p> : null}
          {error ? <p className="text-sm text-red-400 mt-2">{error}</p> : null}
        </div>

        {/* Webhook */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Webhook URL</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Receive payment.confirmed events at your endpoint.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks"
              className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleSaveWebhook} className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
