
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function FacebookAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [processingAccount, setProcessingAccount] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const name = searchParams.get('name');
    if (success === 'account_connected') setMessage({ type: 'success', text: `Connected: ${name || 'Facebook account'}` });
    else if (error === 'already_connected_same_user') setMessage({ type: 'error', text: 'Already connected to your profile' });
    else if (error === 'already_connected_different_user') setMessage({ type: 'error', text: 'Connected to another user' });
    else if (error === 'connection_failed') setMessage({ type: 'error', text: 'Connection failed — please try again' });
    else if (error) setMessage({ type: 'error', text: error });
    fetchAccounts();
  }, [searchParams]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/facebook-accounts');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load accounts' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = () => { window.location.href = '/api/facebook/connect-additional'; };

  const handleSetPrimary = async (accountId) => {
    try {
      setProcessingAccount(accountId);
      const response = await fetch('/api/facebook-accounts/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) throw new Error('Failed');
      setMessage({ type: 'success', text: 'Primary account updated' });
      fetchAccounts();
    } catch { setMessage({ type: 'error', text: 'Failed to update primary account' }); }
    finally { setProcessingAccount(null); }
  };

  const handleDisconnect = async (accountId, accountName) => {
    if (!confirm(`Disconnect "${accountName}"?\n\nThis will remove all associated ad accounts and data.`)) return;
    try {
      setProcessingAccount(accountId);
      const response = await fetch('/api/facebook-accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setMessage({ type: 'success', text: 'Account disconnected' });
      fetchAccounts();
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Disconnect failed' }); }
    finally { setProcessingAccount(null); }
  };

  const getTokenStatus = (expiresAt) => {
    const days = Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0)  return { status: 'expired',  bg: 'bg-red-500',    ring: 'ring-red-200',    text: 'Expired',   label: 'text-red-700',   soft: 'bg-red-50 border-red-200 text-red-800',   days };
    if (days < 7)  return { status: 'critical', bg: 'bg-orange-500', ring: 'ring-orange-200', text: `${days}d`,  label: 'text-orange-700',soft: 'bg-orange-50 border-orange-200 text-orange-800', days };
    if (days < 30) return { status: 'warning',  bg: 'bg-yellow-400', ring: 'ring-yellow-200', text: `${days}d`,  label: 'text-yellow-700',soft: 'bg-yellow-50 border-yellow-200 text-yellow-800', days };
    return          { status: 'good',    bg: 'bg-emerald-500', ring: 'ring-emerald-200',text: `${days}d`,  label: 'text-emerald-700',soft:'bg-emerald-50 border-emerald-200 text-emerald-800', days };
  };

  const FbIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );

  const StarIcon = ({ className = "w-3 h-3" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  const Spinner = ({ className = "w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" }) => (
    <span className={className} />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading accounts…</p>
        </div>
      </div>
    );
  }

  const activeAccounts   = accounts.filter(a => a.isActive).length;
  const totalAdAccounts  = accounts.reduce((sum, a) => sum + a.adAccountsCount, 0);
  const expiringAccounts = accounts.filter(a => Math.floor((new Date(a.tokenExpiresAt) - new Date()) / 86400000) < 30).length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3">

          {/* Title row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow flex-shrink-0">
                <FbIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Facebook Accounts</h1>
                <p className="text-[10px] text-slate-500 hidden sm:block">Manage connected accounts</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`p-1.5 rounded-md transition-colors ${showHelp ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={handleConnectAccount}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 shadow-sm transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden xs:inline sm:inline">Connect</span>
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total',      value: accounts.length,  from: 'from-blue-50',   to: 'to-blue-100',   border: 'border-blue-200',   num: 'text-blue-900',   sub: 'text-blue-600' },
              { label: 'Active',     value: activeAccounts,   from: 'from-emerald-50',to: 'to-emerald-100', border: 'border-emerald-200', num: 'text-emerald-900',sub: 'text-emerald-600' },
              { label: 'Ad Accs',    value: totalAdAccounts,  from: 'from-purple-50', to: 'to-purple-100',  border: 'border-purple-200',  num: 'text-purple-900', sub: 'text-purple-600' },
              { label: expiringAccounts > 0 ? '⚠ Expiring' : 'All Valid', value: expiringAccounts > 0 ? expiringAccounts : '✓', from: expiringAccounts > 0 ? 'from-orange-50' : 'from-slate-50', to: expiringAccounts > 0 ? 'to-orange-100' : 'to-slate-100', border: expiringAccounts > 0 ? 'border-orange-200' : 'border-slate-200', num: expiringAccounts > 0 ? 'text-orange-900' : 'text-slate-700', sub: expiringAccounts > 0 ? 'text-orange-600' : 'text-slate-500' },
            ].map((s, i) => (
              <div key={i} className={`bg-gradient-to-br ${s.from} ${s.to} border ${s.border} rounded-lg p-2 sm:p-2.5 text-center`}>
                <p className={`text-base sm:text-xl font-bold ${s.num} leading-tight`}>{s.value}</p>
                <p className={`text-[9px] sm:text-[10px] font-medium ${s.sub} mt-0.5 truncate`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HELP PANEL ── */}
      {showHelp && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-blue-900 mb-1.5">Quick Guide</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] text-blue-800">
                  {[['⭐ Primary','Main account for operations'],['🔢 Ad Accounts','Linked advertising accounts'],['⏰ Token','Days until reconnect needed'],['✅ Active','Account is operational']].map(([t, d]) => (
                    <div key={t} className="bg-white/60 rounded px-2 py-1.5 border border-blue-100">
                      <p className="font-semibold">{t}</p>
                      <p className="text-blue-600 mt-0.5">{d}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-blue-400 hover:text-blue-700 flex-shrink-0 p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4">

        {/* Alert */}
        {message && (
          <div className={`mb-3 rounded-lg border-l-4 px-3 py-2.5 flex items-center justify-between gap-2 shadow-sm ${message.type === 'success' ? 'bg-emerald-50 border-emerald-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {message.type === 'success'
                  ? <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  : <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                }
              </div>
              <p className={`text-xs font-medium ${message.type === 'success' ? 'text-emerald-900' : 'text-red-900'}`}>{message.text}</p>
            </div>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}

        {/* Legend — desktop only */}
        <div className="hidden sm:flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 mb-3 shadow-sm">
          <div className="flex items-center gap-3 text-[10px] flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                <StarIcon className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-slate-600 font-medium">Primary</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <span className="text-slate-500 font-medium">Token validity:</span>
            {[['bg-emerald-500','30+d'],['bg-yellow-400','7–30d'],['bg-orange-500','<7d'],['bg-red-500','Exp']].map(([bg, t]) => (
              <span key={t} className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${bg}`}>{t}</span>
            ))}
          </div>
          <span className="text-[10px] text-slate-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
        </div>

        {/* ── EMPTY STATE ── */}
        {accounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">No Accounts Connected</h3>
            <p className="text-xs text-slate-500 mb-4">Connect your Facebook account to start managing campaigns.</p>
            <button onClick={handleConnectAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Connect Account
            </button>
          </div>
        ) : (
          <>
            {/* ── MOBILE CARDS (< lg) ── */}
            <div className="lg:hidden space-y-2.5">
              {accounts.map((account) => {
                const ts = getTokenStatus(account.tokenExpiresAt);
                const isProcessing = processingAccount === account.id;
                const isExpanded = expandedAccount === account.id;

                return (
                  <div key={account.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-3">
                      {/* Card header */}
                      <div className="flex items-start gap-2.5 mb-2.5">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
                            <FbIcon className="w-5 h-5 text-white" />
                          </div>
                          {account.isPrimary && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white shadow">
                              <StarIcon className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <h3 className="text-xs font-bold text-slate-900 truncate">
                              {account.facebookUserName || 'Facebook User'}
                            </h3>
                            <button onClick={() => setExpandedAccount(isExpanded ? null : account.id)}
                              className="text-slate-300 hover:text-slate-500 flex-shrink-0 ml-1">
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate mb-1.5">{account.facebookUserId}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {account.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Primary</span>
                            )}
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${account.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              <span className={`w-1 h-1 rounded-full ${account.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {account.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-1.5 text-center">
                          <p className="text-sm font-bold text-blue-900">{account.adAccountsCount}</p>
                          <p className="text-[9px] text-blue-600">Ad Accounts</p>
                        </div>
                        <div className={`rounded-lg p-1.5 text-center border ${ts.soft}`}>
                          <p className="text-sm font-bold">{ts.text}</p>
                          <p className="text-[9px] opacity-80">Token</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-center">
                          <p className="text-[10px] font-bold text-slate-800">
                            {new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-[9px] text-slate-500">Connected</p>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mb-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">Token expires:</span>
                            <span className="font-semibold text-slate-800">{new Date(account.tokenExpiresAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">Connected:</span>
                            <span className="font-semibold text-slate-800">{Math.floor((new Date() - new Date(account.createdAt)) / 86400000)} days ago</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {!account.isPrimary ? (
                        <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                          <button onClick={() => handleSetPrimary(account.id)} disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-all disabled:opacity-50">
                            {isProcessing ? <Spinner /> : <><StarIcon className="w-3 h-3" />Set Primary</>}
                          </button>
                          <button onClick={() => handleDisconnect(account.id, account.facebookUserName)} disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-all disabled:opacity-50">
                            {isProcessing ? <Spinner /> : (
                              <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Disconnect</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 py-1.5 mt-2 border-t border-slate-100 bg-slate-50 rounded-md">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-[10px] text-slate-500 font-medium">Primary (protected)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP TABLE (lg+) ── */}
            <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Account', 'Status', 'Ad Accounts', 'Token', 'Connected', 'Actions'].map((h, i) => (
                        <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider ${i === 0 || i === 1 || i === 4 ? 'text-left' : i === 5 ? 'text-right' : 'text-center'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map((account) => {
                      const ts = getTokenStatus(account.tokenExpiresAt);
                      const isProcessing = processingAccount === account.id;

                      return (
                        <tr key={account.id} className="hover:bg-slate-50/70 transition-colors group">

                          {/* Account */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative flex-shrink-0">
                                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow">
                                  <FbIcon className="w-4.5 h-4.5 text-white" />
                                </div>
                                {account.isPrimary && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white shadow">
                                    <StarIcon className="w-2 h-2 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[160px]">
                                    {account.facebookUserName || 'Facebook User'}
                                  </p>
                                  {account.isPrimary && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">Primary</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono">ID: {account.facebookUserId}</p>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border ${account.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${account.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              {account.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Ad Accounts */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-lg bg-blue-50 text-blue-900 text-xs font-bold border border-blue-200">
                              {account.adAccountsCount}
                            </span>
                          </td>

                          {/* Token */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border ${ts.soft}`}>
                              {ts.text}
                            </span>
                          </td>

                          {/* Connected */}
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-slate-700">
                              {new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {Math.floor((new Date() - new Date(account.createdAt)) / 86400000)}d ago
                            </p>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {!account.isPrimary ? (
                                <>
                                  <button onClick={() => handleSetPrimary(account.id)} disabled={isProcessing}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-all disabled:opacity-50">
                                    {isProcessing ? <Spinner /> : <><StarIcon className="w-3 h-3" />Set Primary</>}
                                  </button>
                                  <button onClick={() => handleDisconnect(account.id, account.facebookUserName)} disabled={isProcessing}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-all disabled:opacity-50">
                                    {isProcessing ? <Spinner /> : (
                                      <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Disconnect</>
                                    )}
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span className="text-[10px] text-slate-500 font-medium">Protected</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span><strong className="text-slate-700">{accounts.length}</strong> account{accounts.length !== 1 ? 's' : ''}</span>
                    <span className="text-slate-300">•</span>
                    <span><strong className="text-emerald-700">{activeAccounts}</strong> active</span>
                    <span className="text-slate-300">•</span>
                    <span><strong className="text-purple-700">{totalAdAccounts}</strong> ad account{totalAdAccounts !== 1 ? 's' : ''}</span>
                    {expiringAccounts > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-orange-600 font-semibold">⚠ {expiringAccounts} expiring</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">Updated {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}