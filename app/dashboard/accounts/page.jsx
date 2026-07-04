'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Facebook Accounts Management Page - Fully Responsive
 * Optimized for Mobile, Tablet, Laptop, and Desktop
 */
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

    if (success === 'account_connected') {
      setMessage({ type: 'success', text: `Successfully connected: ${name || 'Facebook account'}` });
    } else if (error === 'already_connected_same_user') {
      setMessage({ type: 'error', text: 'This account is already connected to your profile' });
    } else if (error === 'already_connected_different_user') {
      setMessage({ type: 'error', text: 'This account is connected to another user' });
    } else if (error === 'connection_failed') {
      setMessage({ type: 'error', text: 'Connection failed - please try again' });
    } else if (error) {
      setMessage({ type: 'error', text: error });
    }

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
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Failed to load accounts' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = () => {
    window.location.href = '/api/facebook/connect-additional';
  };

  const handleSetPrimary = async (accountId) => {
    try {
      setProcessingAccount(accountId);
      const response = await fetch('/api/facebook-accounts/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) throw new Error('Failed');
      setMessage({ type: 'success', text: 'Primary account updated successfully' });
      fetchAccounts();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update primary account' });
    } finally {
      setProcessingAccount(null);
    }
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
      setMessage({ type: 'success', text: 'Account disconnected successfully' });
      fetchAccounts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Disconnect failed' });
    } finally {
      setProcessingAccount(null);
    }
  };

  const getTokenStatus = (expiresAt) => {
    const days = Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { 
      status: 'expired', 
      color: 'bg-red-500 text-white', 
      text: 'Expired',
      description: 'Token has expired. Reconnect this account.',
      days 
    };
    if (days < 7) return { 
      status: 'critical', 
      color: 'bg-orange-500 text-white', 
      text: `${days}d`,
      description: 'Token expires very soon.',
      days 
    };
    if (days < 30) return { 
      status: 'warning', 
      color: 'bg-yellow-500 text-white', 
      text: `${days}d`,
      description: 'Token will expire soon.',
      days 
    };
    return { 
      status: 'good', 
      color: 'bg-green-500 text-white', 
      text: `${days}d`,
      description: 'Token is valid.',
      days 
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-slate-600 font-medium">Loading accounts...</p>
        </div>
      </div>
    );
  }

  const activeAccounts = accounts.filter(a => a.isActive).length;
  const totalAdAccounts = accounts.reduce((sum, a) => sum + a.adAccountsCount, 0);
  const expiringAccounts = accounts.filter(a => {
    const days = Math.floor((new Date(a.tokenExpiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    return days < 30;
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Responsive Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Facebook Accounts</h1>
                <p className="text-xs sm:text-sm text-slate-600 hidden sm:block">Manage all your accounts in one place</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Toggle help"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <div className="relative group">
                <button
                  onClick={handleConnectAccount}
                  className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden xs:inline">Connect Account</span>
                </button>
                {/* Hover Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none shadow-xl">
                  <p className="font-medium">Connect your other Facebook accounts</p>
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 transform rotate-45"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid - Responsive */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-xs sm:text-sm font-medium text-blue-900">Total</span>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-blue-900">{accounts.length}</p>
              <p className="text-xs text-blue-700 mt-1">Accounts</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 sm:p-4 border border-green-200">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-xs sm:text-sm font-medium text-green-900">Active</span>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-green-900">{activeAccounts}</p>
              <p className="text-xs text-green-700 mt-1">Running</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 sm:p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-xs sm:text-sm font-medium text-purple-900">Ad Accounts</span>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-purple-900">{totalAdAccounts}</p>
              <p className="text-xs text-purple-700 mt-1">Total</p>
            </div>

            <div className={`bg-gradient-to-br rounded-lg p-3 sm:p-4 border ${
              expiringAccounts > 0 
                ? 'from-orange-50 to-orange-100 border-orange-200' 
                : 'from-slate-50 to-slate-100 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className={`text-xs sm:text-sm font-medium ${expiringAccounts > 0 ? 'text-orange-900' : 'text-slate-900'}`}>
                  Expiring
                </span>
                <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${expiringAccounts > 0 ? 'text-orange-600' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${expiringAccounts > 0 ? 'text-orange-900' : 'text-slate-900'}`}>
                {expiringAccounts}
              </p>
              <p className={`text-xs mt-1 ${expiringAccounts > 0 ? 'text-orange-700' : 'text-slate-700'}`}>
                {expiringAccounts > 0 ? 'Soon' : 'All valid'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Help Panel - Responsive */}
      {showHelp && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-blue-900 mb-2">Quick Guide</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm text-blue-800">
                  <div>
                    <p className="font-medium mb-0.5">⭐ Primary Account</p>
                    <p className="text-blue-700">Main account for operations</p>
                  </div>
                  <div>
                    <p className="font-medium mb-0.5">🔢 Ad Accounts</p>
                    <p className="text-blue-700">Linked advertising accounts</p>
                  </div>
                  <div>
                    <p className="font-medium mb-0.5">⏰ Token Expiry</p>
                    <p className="text-blue-700">Days until reconnect needed</p>
                  </div>
                  <div>
                    <p className="font-medium mb-0.5">✅ Active Status</p>
                    <p className="text-blue-700">Account is operational</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-blue-600 hover:text-blue-800 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Alert Messages - Responsive */}
        {message && (
          <div className={`mb-4 sm:mb-6 rounded-lg border-l-4 p-3 sm:p-4 shadow-sm ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-500' 
              : 'bg-red-50 border-red-500'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                {message.type === 'success' ? (
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <p className={`text-xs sm:text-sm font-medium ${
                  message.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {message.text}
                </p>
              </div>
              <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Legend - Mobile Optimized */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 hidden sm:block">
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-amber-400 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <span className="text-slate-700">Primary</span>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="font-medium text-slate-700 hidden lg:inline">Status:</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500 text-white">30+d</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500 text-white">7-30d</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500 text-white">&lt;7d</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500 text-white">Expired</span>
              </div>
            </div>
            <span className="text-xs text-slate-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Accounts - Mobile Cards / Desktop Table */}
        {accounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-12 lg:p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No Accounts Connected</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-6">
                Connect your first Facebook account to start managing campaigns.
              </p>
              <button
                onClick={handleConnectAccount}
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Connect Account
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {accounts.map((account) => {
                const tokenStatus = getTokenStatus(account.tokenExpiresAt);
                const isProcessing = processingAccount === account.id;
                const isExpanded = expandedAccount === account.id;

                return (
                  <div key={account.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                          </div>
                          {account.isPrimary && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-base font-semibold text-slate-900 truncate">
                              {account.facebookUserName || 'Facebook User'}
                            </h3>
                            <button
                              onClick={() => setExpandedAccount(isExpanded ? null : account.id)}
                              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                            >
                              <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 font-mono truncate mb-2">{account.facebookUserId}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {account.isPrimary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Primary
                              </span>
                            )}
                            {account.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats Row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100 text-center">
                          <p className="text-lg font-bold text-blue-900">{account.adAccountsCount}</p>
                          <p className="text-xs text-blue-700">Ad Accounts</p>
                        </div>
                        <div className={`rounded-lg p-2 border text-center ${tokenStatus.color.replace('text-white', 'text-white')}`}>
                          <p className="text-lg font-bold">{tokenStatus.text}</p>
                          <p className="text-xs opacity-90">Token</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center">
                          <p className="text-xs font-semibold text-slate-900">
                            {new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-slate-600">Connected</p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Token Expires:</span>
                            <span className="font-medium text-slate-900">
                              {new Date(account.tokenExpiresAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Connected:</span>
                            <span className="font-medium text-slate-900">
                              {Math.floor((new Date() - new Date(account.createdAt)) / (1000 * 60 * 60 * 24))} days ago
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {!account.isPrimary && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                          <button
                            onClick={() => handleSetPrimary(account.id)}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <div className="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Set Primary
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDisconnect(account.id, account.facebookUserName)}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-all disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <div className="w-3.5 h-3.5 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Disconnect
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {account.isPrimary && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 py-2 bg-slate-50 rounded-lg">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-xs text-slate-600 font-medium">Primary account (protected)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Account</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Ad Accounts</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Token</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Connected</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map((account) => {
                      const tokenStatus = getTokenStatus(account.tokenExpiresAt);
                      const isProcessing = processingAccount === account.id;

                      return (
                        <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative flex-shrink-0">
                                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                  </svg>
                                </div>
                                {account.isPrimary && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-slate-900 truncate">
                                    {account.facebookUserName || 'Facebook User'}
                                  </p>
                                  {account.isPrimary && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-mono">ID: {account.facebookUserId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {account.isActive ? (
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div className="inline-flex items-center justify-center min-w-[2.5rem] h-10 px-3 rounded-lg bg-blue-100 text-blue-900 text-base font-bold border border-blue-200">
                                {account.adAccountsCount}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border ${tokenStatus.color}`}>
                                {tokenStatus.text}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-700">
                              {new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-slate-500">
                              {Math.floor((new Date() - new Date(account.createdAt)) / (1000 * 60 * 60 * 24))} days ago
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {!account.isPrimary ? (
                                <>
                                  <button
                                    onClick={() => handleSetPrimary(account.id)}
                                    disabled={isProcessing}
                                    className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isProcessing ? (
                                      <div className="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        Set Primary
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDisconnect(account.id, account.facebookUserName)}
                                    disabled={isProcessing}
                                    className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isProcessing ? (
                                      <div className="w-3.5 h-3.5 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Disconnect
                                      </>
                                    )}
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span className="text-xs text-slate-500 font-medium">Protected</span>
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

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6 text-slate-600">
                    <span>
                      <strong className="text-slate-900">{accounts.length}</strong> account{accounts.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>
                      <strong className="text-green-700">{activeAccounts}</strong> active
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>
                      <strong className="text-purple-700">{totalAdAccounts}</strong> ad account{totalAdAccounts !== 1 ? 's' : ''}
                    </span>
                    {expiringAccounts > 0 && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-orange-700 font-medium">
                          ⚠️ {expiringAccounts} expiring soon
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    Updated {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}