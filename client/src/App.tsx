import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { WhatsAppSimulatorView } from './components/WhatsAppSimulatorView';
import { FinancialView } from './components/FinancialView';
import { SettingsView } from './components/SettingsView';
import { api } from './api';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedOrderIdForWhatsApp, setSelectedOrderIdForWhatsApp] = useState<string>('');
  const [selectedOrderIdForOrderView, setSelectedOrderIdForOrderView] = useState<string>('');
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(2018);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const stats = await api.getDashboardStats();
        setTotalOrdersCount(stats.kpi.total_orders);
      } catch (err) {
        console.error('Failed to load total orders count:', err);
      }
    };
    fetchCount();
  }, [currentTab]);

  const handleNavigateToOrder = (orderId: string) => {
    setSelectedOrderIdForOrderView(orderId);
    setCurrentTab('orders');
  };

  const handleOpenWhatsApp = (orderId: string) => {
    setSelectedOrderIdForWhatsApp(orderId);
    setCurrentTab('whatsapp');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-900">
      {/* Deep Navy Fintech Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          if (tab === 'whatsapp') {
            // Keep selected order if any
          }
          setCurrentTab(tab);
        }}
        ordersCount={totalOrdersCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateToOrder={handleNavigateToOrder}
            onOpenWhatsApp={handleOpenWhatsApp}
          />
        )}

        {currentTab === 'orders' && (
          <OrdersView
            onOpenWhatsApp={handleOpenWhatsApp}
            selectedOrderId={selectedOrderIdForOrderView}
          />
        )}

        {currentTab === 'whatsapp' && (
          <WhatsAppSimulatorView initialOrderId={selectedOrderIdForWhatsApp} />
        )}

        {currentTab === 'financials' && <FinancialView />}

        {currentTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default App;
