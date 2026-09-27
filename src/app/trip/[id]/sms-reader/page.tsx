'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, RefreshCw, Mail, ArrowDownLeft, ArrowUpRight,
  AlertTriangle, Clock, CreditCard, Building2, Inbox, SearchX,
  Zap, Info, ChevronDown, ChevronUp, Copy, Check, ShieldAlert,
  MessageSquare, Banknote, Filter,
} from 'lucide-react';
import type { ParsedSmsTransaction } from '@/lib/sms/types';
import { parseBankSms, isBankSender, getBankInfo } from '@/lib/sms/sms-parser';
import type { RawSmsMessage } from '@/lib/sms/client';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  burgundy: '#791523',
  cream: '#eadecd',
  offWhite: '#fdfbfa',
  rose: '#b83a4b',
  deepWine: '#5a0e1a',
};

// ── Confidence badge helpers ──────────────────────────────────────────────────
function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.6) return 'Medium';
  if (c >= 0.4) return 'Low';
  return 'Very Low';
}

function confidenceColor(c: number) {
  if (c >= 0.8) return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
  if (c >= 0.6) return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
  if (c >= 0.4) return { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' };
  return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
}

// ── View mode types ───────────────────────────────────────────────────────────
type ViewMode = 'all' | 'bank' | 'other';

// ── Page Component ────────────────────────────────────────────────────────────
export default function SmsReaderPage() {
  // Raw SMS from device
  const [allMessages, setAllMessages] = useState<RawSmsMessage[]>([]);
  // Parsed bank transactions
  const [parsedTx, setParsedTx] = useState<ParsedSmsTransaction[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isNative, setIsNative] = useState<boolean | null>(null);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Dynamically import the client so Capacitor doesn't break SSR
      const { readAllDeviceSms, isNativeSmsSupported } = await import('@/lib/sms/client');
      const supported = await isNativeSmsSupported();
      setIsNative(supported);

      if (!supported) {
        setError(
          'SMS reading requires the Android app. This feature reads real SMS from your phone\'s inbox. ' +
          'Please open this app on your Android device to use the SMS Reader.'
        );
        setFetched(true);
        setAllMessages([]);
        setParsedTx([]);
        return;
      }

      // Fetch ALL real SMS from device inbox
      const messages = await readAllDeviceSms(500);
      setAllMessages(messages);

      // Parse bank SMS into structured transactions
      const transactions: ParsedSmsTransaction[] = [];
      for (const msg of messages) {
        if (msg.isBank || isBankSender(msg.sender)) {
          const parsed = parseBankSms(msg.body, msg.sender, msg.timestamp);
          if (parsed) {
            transactions.push(parsed);
          }
        }
      }
      setParsedTx(transactions);
      setFetched(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch SMS messages from your device.');
    } finally {
      setLoading(false);
    }
  }, []);

  const copyText = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Filtered messages based on view mode
  const bankMessages = allMessages.filter(m => m.isBank || isBankSender(m.sender));
  const otherMessages = allMessages.filter(m => !m.isBank && !isBankSender(m.sender));
  const displayMessages = viewMode === 'all' ? allMessages : viewMode === 'bank' ? bankMessages : otherMessages;

  const totalDebit = parsedTx.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0);
  const totalCredit = parsedTx.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0);

  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: `linear-gradient(165deg, ${COLORS.offWhite} 0%, #f7f0e8 50%, ${COLORS.cream}40 100%)` }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-b-3xl"
        style={{
          background: `linear-gradient(135deg, ${COLORS.burgundy} 0%, ${COLORS.deepWine} 40%, ${COLORS.rose} 100%)`,
        }}
      >
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10" style={{ background: 'white' }} />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-[0.07]" style={{ background: 'white' }} />

        <div className="relative px-5 pt-8 pb-7 md:px-10 md:pt-12 md:pb-10">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">SMS Reader</h1>
              <p className="text-xs md:text-sm font-medium text-white/60">Read real SMS from your device</p>
            </div>
          </div>

          <p className="text-white/50 text-xs md:text-sm max-w-lg leading-relaxed">
            Reads <strong className="text-white/70">real SMS messages</strong> directly from your Android phone&apos;s inbox.
            Bank transactions are auto-detected and parsed with amount, merchant, and UPI reference extraction.
          </p>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="px-4 md:px-8 -mt-4 max-w-4xl mx-auto">

        {/* Fetch Button Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="rounded-2xl border shadow-lg p-5 md:p-7 mb-6"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(44,24,16,0.06)',
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
                <Smartphone className="w-5 h-5" style={{ color: COLORS.burgundy }} />
                Device Inbox Scanner
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {fetched
                  ? `Found ${allMessages.length} SMS messages (${bankMessages.length} bank transactions)`
                  : 'Tap the button to read all SMS from your phone\'s inbox'}
              </p>
            </div>

            <button
              onClick={handleFetch}
              disabled={loading}
              className="relative group flex items-center gap-2.5 px-7 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all
                disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${COLORS.burgundy}, ${COLORS.rose})`,
              }}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Reading inbox…
                </>
              ) : (
                <>
                  <Inbox className="w-4 h-4" />
                  {fetched ? 'Re-fetch SMS' : 'Fetch SMS'}
                </>
              )}
              <span
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ boxShadow: `0 0 32px ${COLORS.rose}50` }}
              />
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl border text-xs"
              style={{
                background: isNative === false ? '#fef3c7' : '#fee2e2',
                borderColor: isNative === false ? '#fde68a' : '#fca5a5',
                color: isNative === false ? '#92400e' : '#991b1b',
              }}
            >
              {isNative === false ? <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{error}</span>
            </motion.div>
          )}
        </motion.div>

        {/* ── Stats Bar ──────────────────────────────────────────── */}
        <AnimatePresence>
          {fetched && allMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
            >
              <div
                className="rounded-2xl border p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">Total SMS</div>
                <div className="text-xl font-black text-gray-900">{allMessages.length}</div>
              </div>
              <div
                className="rounded-2xl border p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider mb-1" style={{ color: COLORS.rose }}>Bank SMS</div>
                <div className="text-xl font-black" style={{ color: COLORS.burgundy }}>{bankMessages.length}</div>
              </div>
              <div
                className="rounded-2xl border p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-red-400 mb-1">Total Debits</div>
                <div className="text-lg font-black text-red-700">₹{totalDebit.toLocaleString('en-IN')}</div>
              </div>
              <div
                className="rounded-2xl border p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-emerald-400 mb-1">Total Credits</div>
                <div className="text-lg font-black text-emerald-700">₹{totalCredit.toLocaleString('en-IN')}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter Tabs ────────────────────────────────────────── */}
        <AnimatePresence>
          {fetched && allMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 mb-5 flex-wrap"
            >
              {([
                { key: 'all' as ViewMode, label: `All SMS (${allMessages.length})`, icon: MessageSquare },
                { key: 'bank' as ViewMode, label: `Bank (${bankMessages.length})`, icon: Banknote },
                { key: 'other' as ViewMode, label: `Other (${otherMessages.length})`, icon: Filter },
              ]).map(({ key, label, icon: Icon }) => {
                const active = viewMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      background: active ? COLORS.burgundy : 'rgba(255,255,255,0.7)',
                      color: active ? 'white' : '#666',
                      border: active ? 'none' : '1px solid rgba(44,24,16,0.08)',
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SMS Cards ──────────────────────────────────────────── */}
        <AnimatePresence mode="popLayout">
          {fetched && displayMessages.length === 0 && allMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16 text-gray-400"
            >
              <SearchX className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No {viewMode === 'bank' ? 'bank' : 'other'} messages found.</p>
            </motion.div>
          )}

          {fetched && allMessages.length === 0 && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: `${COLORS.burgundy}10` }}
              >
                <Inbox className="w-7 h-7" style={{ color: COLORS.burgundy }} />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">No SMS messages found</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Your inbox is empty or SMS permission was not granted.
              </p>
            </motion.div>
          )}

          {/* Pre-fetch state */}
          {!fetched && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center py-20"
            >
              <div
                className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.burgundy}15, ${COLORS.rose}15)`,
                }}
              >
                <Zap className="w-9 h-9" style={{ color: COLORS.rose }} />
              </div>
              <p className="text-base font-bold text-gray-800 mb-2">Ready to read your SMS</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Tap <span className="font-bold" style={{ color: COLORS.burgundy }}>&ldquo;Fetch SMS&rdquo;</span> to read
                real SMS messages from your Android phone&apos;s inbox. Bank transactions will be auto-detected
                and parsed.
              </p>

              {/* Supported banks */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {['HDFC', 'SBI', 'ICICI', 'Axis', 'PhonePe', 'GPay', 'Paytm'].map(bank => (
                  <span
                    key={bank}
                    className="px-3 py-1 rounded-full text-[10px] font-bold border"
                    style={{
                      background: `${COLORS.cream}30`,
                      borderColor: `${COLORS.cream}`,
                      color: COLORS.burgundy,
                    }}
                  >
                    {bank}
                  </span>
                ))}
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-bold border"
                  style={{
                    background: `${COLORS.cream}30`,
                    borderColor: `${COLORS.cream}`,
                    color: '#888',
                  }}
                >
                  +28 more
                </span>
              </div>
            </motion.div>
          )}

          {/* SMS message cards */}
          {displayMessages.map((msg, i) => {
            const msgId = `sms-${msg.timestamp}-${i}`;
            const expanded = expandedId === msgId;
            const isBank = msg.isBank || isBankSender(msg.sender);
            const bankInfo = isBank ? getBankInfo(msg.sender) : undefined;
            const parsed = isBank ? parseBankSms(msg.body, msg.sender, msg.timestamp) : null;
            const isDebit = parsed?.direction === 'DEBIT';

            return (
              <motion.div
                key={msgId}
                layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.35 }}
                className="rounded-2xl border shadow-sm mb-3 overflow-hidden transition-shadow hover:shadow-md"
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(12px)',
                  borderColor: isBank ? `${COLORS.burgundy}20` : 'rgba(44,24,16,0.06)',
                  borderLeft: isBank ? `3px solid ${COLORS.burgundy}` : undefined,
                }}
              >
                {/* Main row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : msgId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isBank
                        ? (parsed ? (isDebit ? '#fee2e2' : '#dcfce7') : `${COLORS.burgundy}10`)
                        : '#f3f4f6',
                    }}
                  >
                    {isBank && parsed ? (
                      isDebit
                        ? <ArrowUpRight className="w-5 h-5 text-red-600" />
                        : <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    ) : isBank ? (
                      <Banknote className="w-5 h-5" style={{ color: COLORS.burgundy }} />
                    ) : (
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {parsed?.merchant || bankInfo?.name || msg.sender || 'Unknown'}
                      </span>
                      {isBank && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0"
                          style={{
                            background: `${COLORS.burgundy}15`,
                            color: COLORS.burgundy,
                            border: `1px solid ${COLORS.burgundy}30`,
                          }}
                        >
                          BANK
                        </span>
                      )}
                      {parsed && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0"
                          style={{
                            ...confidenceColor(parsed.confidence),
                            border: `1px solid ${confidenceColor(parsed.confidence).border}`,
                          }}
                        >
                          {confidenceLabel(parsed.confidence)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {msg.body.substring(0, 80)}{msg.body.length > 80 ? '…' : ''}
                    </p>
                  </div>

                  {/* Amount / Time */}
                  <div className="text-right shrink-0">
                    {parsed && parsed.amount > 0 ? (
                      <div
                        className="text-base font-black"
                        style={{ color: isDebit ? '#dc2626' : '#16a34a' }}
                      >
                        {isDebit ? '-' : '+'}₹{parsed.amount.toLocaleString('en-IN')}
                      </div>
                    ) : null}
                    <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(msg.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                      })}
                    </div>
                  </div>

                  <div className="shrink-0 text-gray-300 ml-1">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'rgba(44,24,16,0.06)' }}>
                        {/* Parsed transaction details (bank SMS only) */}
                        {parsed && (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3">
                            <div>
                              <span className="text-gray-400 font-semibold">Amount</span>
                              <p className="font-bold text-gray-800">₹{parsed.amount.toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <span className="text-gray-400 font-semibold">Direction</span>
                              <p className="font-bold text-gray-800">{parsed.direction}</p>
                            </div>
                            <div>
                              <span className="text-gray-400 font-semibold">Confidence</span>
                              <p className="font-bold text-gray-800">{(parsed.confidence * 100).toFixed(0)}%</p>
                            </div>
                            {parsed.merchant && (
                              <div>
                                <span className="text-gray-400 font-semibold">Merchant</span>
                                <p className="font-bold text-gray-800">{parsed.merchant}</p>
                              </div>
                            )}
                            {parsed.upiRef && (
                              <div>
                                <span className="text-gray-400 font-semibold">UPI Ref</span>
                                <p className="font-bold font-mono text-gray-800 text-[11px]">{parsed.upiRef}</p>
                              </div>
                            )}
                            {parsed.accountLast4 && (
                              <div>
                                <span className="text-gray-400 font-semibold">Account</span>
                                <p className="font-bold text-gray-800">••••{parsed.accountLast4}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SMS metadata */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3">
                          <div>
                            <span className="text-gray-400 font-semibold">Sender</span>
                            <p className="font-bold font-mono text-gray-800 text-[11px]">{msg.sender}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 font-semibold">Time</span>
                            <p className="font-bold text-gray-800">
                              {new Date(msg.timestamp).toLocaleString('en-IN', {
                                day: 'numeric', month: 'short', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {bankInfo && (
                            <>
                              <div>
                                <span className="text-gray-400 font-semibold">Bank</span>
                                <p className="font-bold text-gray-800">{bankInfo.name}</p>
                              </div>
                              <div>
                                <span className="text-gray-400 font-semibold">Category</span>
                                <p className="font-bold text-gray-800 capitalize">{bankInfo.category.replace('_', ' ')}</p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Full SMS body */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Full SMS Message
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(msgId, msg.body);
                              }}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors"
                              style={{
                                color: copiedId === msgId ? '#16a34a' : COLORS.burgundy,
                                background: copiedId === msgId ? '#dcfce7' : `${COLORS.burgundy}10`,
                              }}
                            >
                              {copiedId === msgId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedId === msgId ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div
                            className="rounded-lg p-3 text-[11px] font-mono text-gray-700 leading-relaxed break-all whitespace-pre-wrap"
                            style={{ background: `${COLORS.cream}30`, border: `1px solid ${COLORS.cream}` }}
                          >
                            {msg.body}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ── Info Footer ─────────────────────────────────────────── */}
        {fetched && allMessages.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 mb-8 flex items-start gap-2 px-4 py-3 rounded-xl text-[11px] text-gray-500 leading-relaxed"
            style={{
              background: `${COLORS.cream}20`,
              border: `1px solid ${COLORS.cream}60`,
            }}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
            <span>
              All {allMessages.length} SMS messages were read directly from your device inbox.
              Data is processed locally — nothing leaves your phone.
              Bank senders verified against TRAI DLT whitelist covering 35+ Indian banks and UPI providers.
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
