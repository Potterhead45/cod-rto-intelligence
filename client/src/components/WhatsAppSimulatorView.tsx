import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Check,
  CheckCheck,
  Send,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Phone,
  Video,
  MoreVertical,
  ShieldCheck,
  Languages,
  Sparkles
} from 'lucide-react';
import { api, OrderItem } from '../api';

interface WhatsAppSimulatorViewProps {
  initialOrderId?: string;
}

export const WhatsAppSimulatorView: React.FC<WhatsAppSimulatorViewProps> = ({ initialOrderId }) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrderId || '');
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);
  const [conversation, setConversation] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [language, setLanguage] = useState<'english' | 'hinglish'>('hinglish');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Fetch candidate orders for simulation
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const res = await api.getOrders({ limit: 40 });
        setOrders(res.orders);
        if (!selectedOrderId && res.orders.length > 0) {
          // Prefer order with confirmation or prepaid nudge
          const candidate = res.orders.find(
            o => o.action === 'SHIP_AFTER_CONFIRMATION' || o.action === 'NUDGE_TO_PREPAID'
          ) || res.orders[0];
          setSelectedOrderId(candidate.id);
        }
      } catch (err) {
        console.error('Failed to load orders for simulator:', err);
      }
    };
    loadOrders();
  }, []);

  // Load conversation whenever selectedOrderId changes
  useEffect(() => {
    if (!selectedOrderId) return;
    loadConversation(selectedOrderId);
  }, [selectedOrderId]);

  const loadConversation = async (orderId: string) => {
    try {
      setLoading(true);
      const order = await api.getOrder(orderId);
      setCurrentOrder(order);

      // Check if conversation exists, if not start it based on order action
      let conv = await api.getWhatsApp(orderId);
      if (!conv) {
        const workflowType =
          order.action === 'NUDGE_TO_PREPAID' ? 'NUDGE_TO_PREPAID' : 'SHIP_AFTER_CONFIRMATION';
        conv = await api.startWhatsApp(orderId, {
          workflow_type: workflowType,
          language,
          discount_amount: 50
        });
      }
      setConversation(conv);
    } catch (err: any) {
      console.error('Error loading conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async (workflowType: string) => {
    if (!selectedOrderId) return;
    try {
      setLoading(true);
      const conv = await api.startWhatsApp(selectedOrderId, {
        workflow_type: workflowType,
        language,
        discount_amount: 50
      });
      setConversation(conv);
      // Reload order details
      const order = await api.getOrder(selectedOrderId);
      setCurrentOrder(order);
    } catch (err: any) {
      alert(`Failed to start workflow: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (text: string) => {
    if (!text.trim() || !selectedOrderId) return;
    try {
      setSending(true);
      setInputText('');
      const updated = await api.sendWhatsAppReply(selectedOrderId, text);
      setConversation(updated);

      // Check if customer requested payment link
      if (updated.state === 'AWAITING_PAYMENT') {
        setShowPaymentModal(true);
      }

      // Reload order status
      const order = await api.getOrder(selectedOrderId);
      setCurrentOrder(order);
    } catch (err: any) {
      alert(`Failed to deliver message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSimulatePayment = async (outcome: 'SUCCESS' | 'FAILED') => {
    if (!selectedOrderId) return;
    try {
      const updated = await api.triggerMockPayment(selectedOrderId, outcome);
      setConversation(updated);
      setShowPaymentModal(false);
      const order = await api.getOrder(selectedOrderId);
      setCurrentOrder(order);
    } catch (err: any) {
      alert(`Payment simulation failed: ${err.message}`);
    }
  };

  const handleSimulateTimeout = async () => {
    if (!selectedOrderId) return;
    if (!confirm('Simulate 24-hour expiration timeout for this order?')) return;
    try {
      const updated = await api.triggerWhatsAppTimeout(selectedOrderId);
      setConversation(updated);
      const order = await api.getOrder(selectedOrderId);
      setCurrentOrder(order);
    } catch (err: any) {
      alert(`Timeout simulation failed: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Top Header */}
      <div className="p-6 pb-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            WhatsApp Communication Simulator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test buyer confirmation, prepaid discount conversion, payment gateway outcomes, and 24h timeouts.
          </p>
        </div>

        {/* Order Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Select Order:</span>
          <select
            value={selectedOrderId}
            onChange={e => setSelectedOrderId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden"
          >
            {orders.map(o => (
              <option key={o.id} value={o.id}>
                #{o.order_id} — {o.customer_name} ({o.action})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Simulator Workspace Grid */}
      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Order & Scenario Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Order Snapshot Card */}
          {currentOrder && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Target Order Profile
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    currentOrder.risk_score <= 24
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : currentOrder.risk_score <= 44
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : currentOrder.risk_score <= 69
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  Risk: {currentOrder.risk_score}/100
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-base font-bold text-slate-900">{currentOrder.customer_name}</div>
                <div className="text-xs text-slate-600 font-mono">{currentOrder.phone}</div>
                <div className="text-xs text-slate-500">{currentOrder.address}, {currentOrder.city}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400">Order Amount:</span>
                  <div className="font-bold text-slate-900">
                    ₹{currentOrder.order_value.toLocaleString('en-IN')}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">({currentOrder.payment_method})</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Current Status:</span>
                  <div className="font-semibold text-slate-900">{currentOrder.final_status}</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                <strong>Decision Engine Note:</strong> {currentOrder.explanation}
              </div>
            </div>
          )}

          {/* Workflow Mode & Language Switcher */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Workflow & Configuration
            </h4>

            {/* Language Selector */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600 flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-slate-400" />
                Template Language:
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setLanguage('hinglish')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    language === 'hinglish' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Hinglish
                </button>
                <button
                  onClick={() => setLanguage('english')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    language === 'english' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Workflow Buttons */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600 block">Workflow Trigger:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStartWorkflow('SHIP_AFTER_CONFIRMATION')}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    conversation?.workflow_type === 'SHIP_AFTER_CONFIRMATION'
                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold ring-1 ring-amber-400'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs mb-0.5">A. Confirmation</div>
                  <div className="text-[10px] text-slate-500 leading-tight">Request YES/NO reply before dispatch</div>
                </button>

                <button
                  onClick={() => handleStartWorkflow('NUDGE_TO_PREPAID')}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    conversation?.workflow_type === 'NUDGE_TO_PREPAID'
                      ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold ring-1 ring-blue-400'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs mb-0.5">B. Prepaid Nudge</div>
                  <div className="text-[10px] text-slate-500 leading-tight">Offer ₹50 off online checkout link</div>
                </button>
              </div>
            </div>

            {/* Current State Info */}
            {conversation && (
              <div className="pt-3 border-t border-slate-100 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Conversation State:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {conversation.state}
                  </span>
                </div>
                {conversation.payment_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment Status:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded ${
                        conversation.payment_status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {conversation.payment_status}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Interactive Customer Responses
            </h4>
            <p className="text-[11px] text-slate-500">
              Click any realistic customer response to test state transitions instantly:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleSendReply('YES, confirm my order please!')}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold transition-all text-left"
              >
                &ldquo;YES confirm&rdquo;
                <span className="block text-[10px] text-emerald-600 font-normal">Approves shipping</span>
              </button>

              <button
                onClick={() => handleSendReply('NO cancel it')}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg font-semibold transition-all text-left"
              >
                &ldquo;NO cancel&rdquo;
                <span className="block text-[10px] text-rose-600 font-normal">Cancels order</span>
              </button>

              <button
                onClick={() => handleSendReply('PAY online')}
                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold transition-all text-left"
              >
                &ldquo;PAY online&rdquo;
                <span className="block text-[10px] text-blue-600 font-normal">Requests payment link</span>
              </button>

              <button
                onClick={() => handleSendReply('I will pay with COD only')}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg font-semibold transition-all text-left"
              >
                &ldquo;Keep COD&rdquo;
                <span className="block text-[10px] text-slate-500 font-normal">Declines discount</span>
              </button>

              <button
                onClick={() => handleSendReply('Kab tak deliver hoga?')}
                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-semibold transition-all text-left"
              >
                &ldquo;Kab deliver hoga?&rdquo;
                <span className="block text-[10px] text-amber-600 font-normal">Tests clarification</span>
              </button>

              <button
                onClick={handleSimulateTimeout}
                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg font-semibold transition-all text-left"
              >
                &ldquo;Simulate Timeout&rdquo;
                <span className="block text-[10px] text-purple-600 font-normal">24h expiration</span>
              </button>
            </div>

            {conversation?.workflow_type === 'NUDGE_TO_PREPAID' && (
              <div className="pt-2">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Launch Simulated Payment Gateway</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Smartphone WhatsApp Mockup Frame (7 cols) */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-[400px] h-[660px] bg-[#EFEAE2] rounded-[40px] shadow-2xl border-[10px] border-slate-900 flex flex-col overflow-hidden relative">
            {/* Phone Top Speaker & Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-32 bg-slate-900 rounded-b-xl z-20" />

            {/* WhatsApp App Header */}
            <div className="bg-[#075E54] text-white pt-6 pb-2.5 px-4 flex items-center justify-between shrink-0 z-10 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-slate-300 text-slate-700 font-bold flex items-center justify-center text-xs shadow-inner">
                  {currentOrder?.customer_name ? currentOrder.customer_name[0] : 'C'}
                </div>
                <div>
                  <div className="font-semibold text-sm leading-tight flex items-center gap-1">
                    <span>{currentOrder?.customer_name || 'Customer'}</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <div className="text-[10px] text-emerald-100 font-mono">
                    {currentOrder?.phone || '+91 98765 43210'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-emerald-100">
                <Phone className="w-4 h-4 cursor-pointer hover:text-white" />
                <Video className="w-4 h-4 cursor-pointer hover:text-white" />
                <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
              </div>
            </div>

            {/* Chat Bubble Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:16px_16px]">
              {/* Security Banner */}
              <div className="text-center my-2">
                <span className="inline-block bg-[#FFF9C4] text-[#5D4037] text-[10px] px-3 py-1 rounded-md shadow-xs max-w-xs font-sans">
                  Messages are end-to-end simulated. No real SMS or WhatsApp messages are sent.
                </span>
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-slate-500" />
                  Loading WhatsApp chat...
                </div>
              ) : (!conversation?.messages || conversation.messages.length === 0) ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No messages yet. Trigger a workflow to begin.
                </div>
              ) : (
                conversation.messages.map((msg: any) => {
                  const isSystem = msg.sender === 'system';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSystem ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[82%] p-2.5 rounded-lg text-xs shadow-xs relative leading-relaxed ${
                          isSystem
                            ? 'bg-white text-slate-900 rounded-tl-none'
                            : 'bg-[#DCF8C6] text-slate-900 rounded-tr-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message_text}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                          <span>{msg.created_at ? msg.created_at.slice(11, 16) : 'Just now'}</span>
                          {isSystem && <CheckCheck className="w-3 h-3 text-blue-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* WhatsApp Chat Input Footer */}
            <div className="p-2.5 bg-[#F0F2F5] border-t border-slate-200 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Type customer reply..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSendReply(inputText);
                  }
                }}
                className="flex-1 py-2 px-3 bg-white rounded-full text-xs border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
              <button
                disabled={sending || !inputText.trim()}
                onClick={() => handleSendReply(inputText)}
                className="w-8 h-8 rounded-full bg-[#075E54] text-white flex items-center justify-center shadow-md hover:bg-[#128C7E] disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Payment Gateway Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="font-bold text-sm">Simulated Fast Checkout</h4>
                  <p className="text-[11px] text-slate-400">Razorpay / Cashfree Mock Gateway</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Payable Amount:</span>
                  <span className="text-lg font-bold text-blue-950 font-mono">
                    ₹{Math.max(0, (currentOrder?.order_value || 649) - 50).toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="bg-blue-200 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  ₹50 Prepaid Discount Applied
                </span>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-700 block">Select Mock Outcome:</span>
                <p className="text-slate-500 text-[11px]">
                  Simulate real payment gateway webhooks to verify automatic status transitions:
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleSimulatePayment('SUCCESS')}
                    className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-center shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-white" />
                    Simulate Payment Success
                  </button>

                  <button
                    onClick={() => handleSimulatePayment('FAILED')}
                    className="p-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-center shadow-xs transition-colors"
                  >
                    <XCircle className="w-5 h-5 mx-auto mb-1 text-white" />
                    Simulate Payment Failure
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
