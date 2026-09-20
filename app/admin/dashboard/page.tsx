'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GST_STATES } from '@/lib/constants/gstStates';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'orders' | 'domains' | 'hosting' | 'customers' | 'tickets' | 'taxes' | 'gateway'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Financial & Reports State
  const [reportPeriod, setReportPeriod] = useState<'allTime' | 'mtd' | 'last30d' | 'last7d'>('allTime');
  const [reportCurrency, setReportCurrency] = useState<'CONSOLIDATED' | 'INR' | 'USD'>('CONSOLIDATED');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  // Expiration & Lifecycle Filter States
  const [domainFilter, setDomainFilter] = useState<'all' | 'warning' | 'critical' | 'expired'>('all');
  const [hostingFilter, setHostingFilter] = useState<'all' | 'warning' | 'critical' | 'expired'>('all');

  // Orders Ledger Filters
  const [orderGatewayFilter, setOrderGatewayFilter] = useState<'ALL' | 'RAZORPAY' | 'INSTAMOJO' | 'MANUAL'>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PAID' | 'PENDING'>('ALL');
  const [orderCurrencyFilter, setOrderCurrencyFilter] = useState<'ALL' | 'INR' | 'USD'>('ALL');

  // Tax & GST Engine Settings state
  const [taxSettings, setTaxSettings] = useState<any>({
    gstRate: 18.0,
    legalBusinessName: 'Hostmattic Technologies / OfinIT Solutions',
    sellerGstin: '32AABCO1234F1Z5',
    registeredAddress: 'Building 4B, Infopark Technology Hub',
    city: 'Kochi',
    state: 'Kerala',
    stateCode: '32',
    panNumber: 'AABCO1234F',
    defaultSacCode: '998315',
    lutNumber: 'LUT/AD320324001928K',
    usdGstPolicy: 'LUT_EXPORT',
  });
  const [savingTaxSettings, setSavingTaxSettings] = useState(false);
  const [taxNotice, setTaxNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedAdminInvoice, setSelectedAdminInvoice] = useState<any | null>(null);

  // Drill-down Modal States (Option 1)
  const [selectedStaffTicket, setSelectedStaffTicket] = useState<any | null>(null);
  const [staffReplyText, setStaffReplyText] = useState('');
  const [submittingStaffReply, setSubmittingStaffReply] = useState(false);
  const [ticketActionMsg, setTicketActionMsg] = useState('');

  const [selectedCustomerDossier, setSelectedCustomerDossier] = useState<any | null>(null);
  const [selectedHostingForAction, setSelectedHostingForAction] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState('Payment Overdue / Policy Violation');
  const [suspensionActionMsg, setSuspensionActionMsg] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncingUpstream, setSyncingUpstream] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination states
  const [customerPage, setCustomerPage] = useState(1);
  const [domainPage, setDomainPage] = useState(1);
  const [hostingPage, setHostingPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // CSV Export for Financial Ledger & P&L
  const exportFinancialsCsv = () => {
    const ordersList = data?.orders || [];
    if (ordersList.length === 0) return;
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Customer Email',
      'Customer GSTIN',
      'Currency',
      'Gross Total',
      'Subtotal (Ex-Tax)',
      'Tax (GST)',
      'Wholesale COGS',
      'Gross Profit',
      'Margin %',
      'Payment Gateway',
      'Gateway Payment ID',
      'Payment Status',
    ];
    const rows = ordersList.map((o: any) => [
      `"${o.orderNumber}"`,
      `"${new Date(o.createdAt).toISOString().split('T')[0]}"`,
      `"${(o.user?.name || '').replace(/"/g, '""')}"`,
      `"${(o.user?.email || '').replace(/"/g, '""')}"`,
      `"${(o.customerGstin || '').replace(/"/g, '""')}"`,
      o.currency || 'INR',
      o.totalAmount || 0,
      o.subtotalAmount || o.totalAmount || 0,
      o.taxAmount || 0,
      o.financials?.wholesaleCost || 0,
      o.financials?.grossProfit || 0,
      (o.financials?.profitMargin || 0).toFixed(2) + '%',
      o.gatewayName || o.paymentMethod || 'MANUAL',
      `"${(o.gatewayPaymentId || '').replace(/"/g, '""')}"`,
      o.paymentStatus || 'PAID',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hostmattic_financial_pnl_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchTaxSettings = () => {
    fetch('/api/admin/settings/tax')
      .then((res) => res.json())
      .then((d) => {
        if (d.success && d.settings) {
          setTaxSettings(d.settings);
        }
      })
      .catch(() => {});
  };

  const fetchAdminData = () => {
    fetch('/api/admin/overview')
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/admin/login';
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.success) {
          setData(d);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleSyncLiveUpstream = async () => {
    setSyncingUpstream(true);
    setSyncNotice(null);
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncNotice({
          type: 'success',
          message: json.message || 'Successfully synchronized live data from upstream gateway!',
        });
        fetchAdminData();
      } else {
        setSyncNotice({
          type: 'error',
          message: json.error || 'Failed to sync upstream data.',
        });
      }
    } catch (err: any) {
      setSyncNotice({
        type: 'error',
        message: err.message || 'Error communicating with sync gateway.',
      });
    } finally {
      setSyncingUpstream(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchTaxSettings();
  }, []);

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTaxSettings(true);
    setTaxNotice(null);
    try {
      const res = await fetch('/api/admin/settings/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taxSettings),
      });
      const d = await res.json();
      if (d.success) {
        setTaxNotice({ type: 'success', message: 'GST Tax Configuration & SAC settings updated successfully!' });
        if (d.settings) setTaxSettings(d.settings);
      } else {
        setTaxNotice({ type: 'error', message: d.error || 'Failed to update GST tax settings.' });
      }
    } catch (err: any) {
      setTaxNotice({ type: 'error', message: err.message || 'Error communicating with Tax Engine API.' });
    } finally {
      setSavingTaxSettings(false);
    }
  };

  useEffect(() => {
    setCustomerPage(1);
    setDomainPage(1);
    setHostingPage(1);
    setOrderPage(1);
    setTicketPage(1);
  }, [searchQuery, activeTab]);

  const handleAdminLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  // Staff Ticket Actions
  const handleStaffReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffReplyText.trim() || !selectedStaffTicket) return;

    setSubmittingStaffReply(true);
    try {
      const res = await fetch('/api/client/tickets/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedStaffTicket.id,
          message: staffReplyText.trim(),
          senderType: 'STAFF',
        }),
      });
      const json = await res.json();
      if (json.success && json.reply) {
        const updatedReplies = [...(selectedStaffTicket.replies || []), json.reply];
        setSelectedStaffTicket({ ...selectedStaffTicket, replies: updatedReplies, status: 'ANSWERED' });
        setStaffReplyText('');
        setTicketActionMsg('Staff reply transmitted to customer successfully.');
        setTimeout(() => setTicketActionMsg(''), 4000);
        fetchAdminData();
      }
    } catch {
      alert('Failed to send staff reply.');
    } finally {
      setSubmittingStaffReply(false);
    }
  };

  const handleUpdateTicketStatus = async (newStatus: string) => {
    if (!selectedStaffTicket) return;
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-ticket',
          targetId: selectedStaffTicket.id,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedStaffTicket({ ...selectedStaffTicket, status: newStatus });
        setTicketActionMsg(`Ticket marked as ${newStatus}`);
        setTimeout(() => setTicketActionMsg(''), 3000);
        fetchAdminData();
      }
    } catch {
      alert('Failed to update ticket.');
    }
  };

  // Hosting Suspension Actions
  const handleToggleHostingSuspension = async (action: 'suspend' | 'unsuspend') => {
    if (!selectedHostingForAction) return;
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'suspend' ? 'suspend-hosting' : 'unsuspend-hosting',
          targetId: selectedHostingForAction.id,
          reason: suspendReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedHostingForAction({ ...selectedHostingForAction, status: json.status });
        setSuspensionActionMsg(json.message);
        setTimeout(() => setSuspensionActionMsg(''), 4000);
        fetchAdminData();
      }
    } catch {
      alert('Action failed.');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090D12', color: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-dot" style={{ background: '#FFCD00', width: '16px', height: '16px', margin: '0 auto 16px', boxShadow: '0 0 16px #FFCD00' }}></div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Staff Operations Console...</h3>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Authenticating telemetry with Hostmattic Infrastructure</p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalCustomers: 0,
    activeDomains: 0,
    activeHosting: 0,
    totalOrders: 0,
    openTickets: 0,
    gatewayStatus: { mode: 'SANDBOX_SIMULATION', upstreamConnected: true },
  };

  const customers = (data?.customers || []).filter((c: any) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.upstreamCustomerId || '').includes(searchQuery)
  );

  const hosting = (data?.hosting || []).filter((h: any) => {
    const matchesSearch =
      (h.domainName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.planName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.cpanelUsername || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.serverIp || '').includes(searchQuery);
    if (!matchesSearch) return false;
    if (hostingFilter === 'critical') return h.daysUntilExpiry !== undefined && h.daysUntilExpiry <= 7 && h.daysUntilExpiry >= 0;
    if (hostingFilter === 'warning') return h.daysUntilExpiry !== undefined && h.daysUntilExpiry <= 30 && h.daysUntilExpiry >= 0;
    if (hostingFilter === 'expired') return h.daysUntilExpiry !== undefined && h.daysUntilExpiry < 0;
    return true;
  });

  const domains = (data?.domains || []).filter((d: any) => {
    const matchesSearch = (d.domainName || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (domainFilter === 'critical') return d.daysUntilExpiry !== undefined && d.daysUntilExpiry <= 7 && d.daysUntilExpiry >= 0;
    if (domainFilter === 'warning') return d.daysUntilExpiry !== undefined && d.daysUntilExpiry <= 30 && d.daysUntilExpiry >= 0;
    if (domainFilter === 'expired') return d.daysUntilExpiry !== undefined && d.daysUntilExpiry < 0;
    return true;
  });

  const orders = (data?.orders || []).filter((o: any) => {
    const matchesSearch =
      (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.gatewayPaymentId || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (orderGatewayFilter !== 'ALL') {
      const gw = (o.gatewayName || o.paymentMethod || '').toUpperCase();
      if (!gw.includes(orderGatewayFilter)) return false;
    }
    if (orderStatusFilter !== 'ALL') {
      const st = (o.paymentStatus || '').toUpperCase();
      if (st !== orderStatusFilter) return false;
    }
    if (orderCurrencyFilter !== 'ALL') {
      if (o.currency !== orderCurrencyFilter) return false;
    }
    return true;
  });

  const tickets = (data?.tickets || []).filter((t: any) =>
    (t.ticketNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Paginated items
  const totalCustomerPages = Math.ceil(customers.length / pageSize) || 1;
  const paginatedCustomers = customers.slice((customerPage - 1) * pageSize, customerPage * pageSize);

  const totalDomainPages = Math.ceil(domains.length / pageSize) || 1;
  const paginatedDomains = domains.slice((domainPage - 1) * pageSize, domainPage * pageSize);

  const totalHostingPages = Math.ceil(hosting.length / pageSize) || 1;
  const paginatedHosting = hosting.slice((hostingPage - 1) * pageSize, hostingPage * pageSize);

  const totalOrderPages = Math.ceil(orders.length / pageSize) || 1;
  const paginatedOrders = orders.slice((orderPage - 1) * pageSize, orderPage * pageSize);

  const totalTicketPages = Math.ceil(tickets.length / pageSize) || 1;
  const paginatedTickets = tickets.slice((ticketPage - 1) * pageSize, ticketPage * pageSize);

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    itemName: string,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems <= pageSize && pageSize === 10) return null;
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.84rem', color: '#94A3B8' }}>
          <span>
            Showing <strong style={{ color: '#FFFFFF' }}>{start}</strong> to <strong style={{ color: '#FFFFFF' }}>{end}</strong> of <strong style={{ color: '#FFFFFF' }}>{totalItems}</strong> {itemName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCustomerPage(1);
                setDomainPage(1);
                setHostingPage(1);
                setOrderPage(1);
                setTicketPage(1);
              }}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              background: currentPage <= 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: currentPage <= 1 ? '#475569' : '#CBD5E1',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ← Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const hasGap = prev && p - prev > 1;
              return (
                <React.Fragment key={p}>
                  {hasGap && <span style={{ color: '#64748B', padding: '0 4px', fontSize: '0.82rem' }}>…</span>}
                  <button
                    onClick={() => onPageChange(p)}
                    style={{
                      background: currentPage === p ? 'var(--brand-action-green, #4F7C12)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${currentPage === p ? 'var(--brand-action-green, #4F7C12)' : 'rgba(255, 255, 255, 0.12)'}`,
                      color: currentPage === p ? '#FFFFFF' : '#CBD5E1',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: currentPage === p ? 700 : 500,
                      cursor: 'pointer',
                      minWidth: '34px',
                      transition: 'all 0.2s',
                    }}
                  >
                    {p}
                  </button>
                </React.Fragment>
              );
            })}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{
              background: currentPage >= totalPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: currentPage >= totalPages ? '#475569' : '#CBD5E1',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#090D12', color: '#F1F5F9', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      {/* Admin Top Navigation */}
      <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px 20px' }} className="admin-subheader-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <picture>
                <source srcSet="/assets/img/hostmattic-logo-icon.webp" type="image/webp" />
                <img src="/assets/img/hostmattic-logo-icon.png" alt="Hostmattic" width="36" height="36" style={{ height: '36px', width: 'auto' }} />
              </picture>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#FFFFFF' }}>Hostmattic</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(255, 205, 0, 0.15)', color: '#FFCD00', border: '1px solid rgba(255, 205, 0, 0.35)', fontWeight: 700 }}>
                    OPERATIONS
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Staff Infrastructure &amp; Reseller Controls</div>
              </div>
            </div>

            <div style={{ marginLeft: '12px', paddingLeft: '16px', borderLeft: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="pulse-dot" style={{ background: metrics.gatewayStatus?.mode === 'LIVE_PRODUCTION' ? '#9BCB44' : '#FFCD00' }}></span>
              <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontWeight: 600 }}>
                {metrics.gatewayStatus?.mode === 'LIVE_PRODUCTION' ? 'Upstream Gateway: LIVE' : 'Provisioning Mode: SANDBOX'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleSyncLiveUpstream}
              disabled={syncingUpstream}
              title="Fetch latest customers and domains from upstream gateway"
              style={{
                background: 'rgba(155, 203, 68, 0.15)',
                border: '1px solid rgba(155, 203, 68, 0.35)',
                color: '#9BCB44',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: syncingUpstream ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <span className={syncingUpstream ? 'spinner-inline' : ''}>🔄</span>
              <span>{syncingUpstream ? 'Syncing...' : 'Sync Live Upstream'}</span>
            </button>
            <Link
              href="/client/dashboard"
              target="_blank"
              style={{ fontSize: '0.8rem', color: '#94A3B8', textDecoration: 'none', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>View Customer Portal</span>
              <span style={{ fontSize: '0.85rem' }}>↗</span>
            </Link>
            <div style={{ height: '24px', width: '1px', background: 'rgba(255, 255, 255, 0.12)' }}></div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>Super Administrator</div>
              <div style={{ fontSize: '0.75rem', color: '#FFCD00' }}>Master Role</div>
            </div>
            <button
              onClick={handleAdminLogout}
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#FCA5A5', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Console Layout */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        {syncNotice && (
          <div
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: syncNotice.type === 'success' ? 'rgba(155, 203, 68, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${syncNotice.type === 'success' ? 'rgba(155, 203, 68, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: syncNotice.type === 'success' ? '#9BCB44' : '#FCA5A5',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <span>{syncNotice.type === 'success' ? '✓ ' : '⚠️ '}{syncNotice.message}</span>
            <button
              onClick={() => setSyncNotice(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', marginLeft: '12px' }}
            >
              ✕
            </button>
          </div>
        )}
        {/* TOP EXPIRATION & LIFECYCLE ALERT BANNER */}
        {data?.expirations?.totalRequiringAttention > 0 && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: (data.expirations.criticalCount > 0 || data.expirations.expiredCount > 0)
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.12) 100%)'
                : 'linear-gradient(135deg, rgba(255, 205, 0, 0.2) 0%, rgba(217, 119, 6, 0.12) 100%)',
              border: (data.expirations.criticalCount > 0 || data.expirations.expiredCount > 0)
                ? '1px solid rgba(239, 68, 68, 0.45)'
                : '1px solid rgba(255, 205, 0, 0.45)',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '1.6rem' }}>
                {(data.expirations.criticalCount > 0 || data.expirations.expiredCount > 0) ? '🚨' : '⚠️'}
              </span>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>30-Day Service Expiration Alert:</span>
                  <span style={{ color: (data.expirations.criticalCount > 0 || data.expirations.expiredCount > 0) ? '#FCA5A5' : '#FFCD00' }}>
                    {data.expirations.totalRequiringAttention} Service{data.expirations.totalRequiringAttention > 1 ? 's' : ''} Require Immediate Attention
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#CBD5E1', marginTop: '3px' }}>
                  {data.expirations.criticalCount > 0 && (
                    <strong style={{ color: '#F87171' }}>{data.expirations.criticalCount} critical in ≤7 days &bull; </strong>
                  )}
                  {data.expirations.warningCount > 0 && (
                    <span style={{ color: '#FDE047' }}>{data.expirations.warningCount} expiring in ≤30 days &bull; </span>
                  )}
                  {data.expirations.expiredCount > 0 && (
                    <span style={{ color: '#FCA5A5' }}>{data.expirations.expiredCount} past expiration &bull; </span>
                  )}
                  <span>Notify registrants or process upstream registrar renewal.</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setActiveTab('domains');
                  setDomainFilter('warning');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Filter Domains (≤30d)</span>
                <span>🌐</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('hosting');
                  setHostingFilter('warning');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Filter Hosting (≤30d)</span>
                <span>☁️</span>
              </button>
            </div>
          </div>
        )}

        {/* KPI Telemetry Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Customers</span>
              <span style={{ color: '#FFCD00' }}>👥</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFFFFF', marginTop: '6px' }}>{metrics.totalCustomers}</div>
            <div style={{ fontSize: '0.72rem', color: '#9BCB44', marginTop: '4px' }}>● Verified in database</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Active Hosting</span>
              <span style={{ color: '#29B4D5' }}>☁️</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#29B4D5', marginTop: '6px' }}>{metrics.activeHosting}</div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>US, IN, UK Server Nodes</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Managed Domains</span>
              <span style={{ color: '#9BCB44' }}>🌐</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#9BCB44', marginTop: '6px' }}>{metrics.activeDomains}</div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>100% DNS Zone Protected</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Orders Processed</span>
              <span style={{ color: '#FFCD00' }}>💳</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFFFFF', marginTop: '6px' }}>{metrics.totalOrders}</div>
            <div style={{ fontSize: '0.72rem', color: '#9BCB44', marginTop: '4px' }}>Automated Provisioning</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Open Tickets</span>
              <span style={{ color: '#F87171' }}>🎫</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.openTickets > 0 ? '#F87171' : '#9BCB44', marginTop: '6px' }}>
              {metrics.openTickets}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>Customer Support Queue</div>
          </div>
        </div>

        {/* Tab Selection Bar & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="horizontal-scroll-touch" style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '4px', gap: '4px', maxWidth: '100%' }}>
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'reports', label: 'Reports & P&L', icon: '📈' },
              { id: 'orders', label: `Orders (${orders.length})`, icon: '💳' },
              { id: 'domains', label: `Domains (${domains.length})${data?.expirations?.domains?.warning > 0 ? ' ⚠️' : ''}`, icon: '🌐' },
              { id: 'hosting', label: `Hosting (${hosting.length})${data?.expirations?.hosting?.warning > 0 ? ' ⚠️' : ''}`, icon: '☁️' },
              { id: 'customers', label: `Customers (${customers.length})`, icon: '👥' },
              { id: 'tickets', label: `Support Queue (${tickets.length})`, icon: '🎫' },
              { id: 'taxes', label: 'Tax & GST Settings', icon: '🏛️' },
              { id: 'gateway', label: 'API Gateway', icon: '⚙️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id ? '#FFCD00' : 'transparent',
                  color: activeTab === tab.id ? '#090D12' : '#94A3B8',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab !== 'overview' && activeTab !== 'gateway' && activeTab !== 'taxes' && (
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 14px 10px 38px',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}>🔍</span>
            </div>
          )}
        </div>

        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', margin: 0 }}>Recent Customers</h3>
                <button onClick={() => setActiveTab('customers')} style={{ background: 'none', border: 'none', color: '#FFCD00', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  View All →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {customers.slice(0, 4).map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerDossier(c)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{c.email}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', fontWeight: 600 }}>
                        {c._count?.hostingAccounts || 1} Hosting · {c._count?.domains || 1} Domains
                      </span>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Click to inspect dossier ↗</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 30-Day Expiration & Renewal Monitor */}
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏳</span>
                  <span>30-Day Expiration Monitor</span>
                </h3>
                <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '999px', background: data?.expirations?.totalRequiringAttention > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(155, 203, 68, 0.2)', color: data?.expirations?.totalRequiringAttention > 0 ? '#FCA5A5' : '#9BCB44', fontWeight: 700 }}>
                  {data?.expirations?.totalRequiringAttention || 0} Alert{data?.expirations?.totalRequiringAttention !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Status summary pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#FCA5A5', fontWeight: 600 }}>Critical (≤7d)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F87171', marginTop: '2px' }}>
                    {data?.expirations?.criticalCount || 0}
                  </div>
                </div>
                <div style={{ background: 'rgba(255, 205, 0, 0.12)', border: '1px solid rgba(255, 205, 0, 0.25)', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#FDE047', fontWeight: 600 }}>Expiring (≤30d)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFCD00', marginTop: '2px' }}>
                    {data?.expirations?.warningCount || 0}
                  </div>
                </div>
                <div style={{ background: 'rgba(148, 163, 184, 0.12)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Past Due</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#CBD5E1', marginTop: '2px' }}>
                    {data?.expirations?.expiredCount || 0}
                  </div>
                </div>
              </div>

              {/* Top expiring items preview list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {(data?.expirations?.upcomingExpiringItems || []).slice(0, 3).map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        {item.type === 'DOMAIN' ? '🌐 Domain' : '☁️ Hosting'} &bull; {item.customerName}
                      </div>
                    </div>
                    <div>
                      {item.daysUntilExpiry < 0 ? (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Expired ({Math.abs(item.daysUntilExpiry)}d ago)
                        </span>
                      ) : item.daysUntilExpiry <= 7 ? (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.25)', color: '#F87171', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {item.daysUntilExpiry}d left 🚨
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 205, 0, 0.2)', color: '#FFCD00', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {item.daysUntilExpiry}d left
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(!data?.expirations?.upcomingExpiringItems || data.expirations.upcomingExpiringItems.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#94A3B8', fontSize: '0.8rem' }}>
                    ✓ All customer services are healthy and active (&gt;30 days remaining).
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  onClick={() => { setActiveTab('domains'); setDomainFilter('warning'); }}
                  style={{ background: 'rgba(155, 203, 68, 0.15)', border: '1px solid rgba(155, 203, 68, 0.35)', color: '#9BCB44', padding: '8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Expiring Domains →
                </button>
                <button
                  onClick={() => { setActiveTab('hosting'); setHostingFilter('warning'); }}
                  style={{ background: 'rgba(41, 180, 213, 0.15)', border: '1px solid rgba(41, 180, 213, 0.35)', color: '#29B4D5', padding: '8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Expiring Hosting →
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', marginBottom: '16px' }}>Gateway &amp; Provisioning Engine</h3>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Upstream API Endpoint:</span>
                  <span style={{ color: '#CBD5E1', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{metrics.gatewayStatus?.targetEndpoint}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Operating Mode:</span>
                  <span style={{ color: metrics.gatewayStatus?.mode === 'LIVE_PRODUCTION' ? '#9BCB44' : '#FFCD00', fontSize: '0.85rem', fontWeight: 700 }}>
                    {metrics.gatewayStatus?.mode}
                  </span>
                </div>
                {metrics.gatewayStatus?.resellerBalance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Reseller Balance:</span>
                    <span style={{ color: '#FFCD00', fontSize: '0.85rem', fontWeight: 700 }}>
                      {metrics.gatewayStatus.resellerBalance.currency} ₹{metrics.gatewayStatus.resellerBalance.balance.toFixed(2)}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Database Connection:</span>
                  <span style={{ color: '#9BCB44', fontSize: '0.85rem', fontWeight: 600 }}>● PostgreSQL Online</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={handleSyncLiveUpstream}
                  disabled={syncingUpstream}
                  style={{ background: 'rgba(155, 203, 68, 0.15)', border: '1px solid rgba(155, 203, 68, 0.35)', color: '#9BCB44', padding: '10px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: syncingUpstream ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span className={syncingUpstream ? 'spinner-inline' : ''}>🔄</span>
                  <span>{syncingUpstream ? 'Syncing...' : 'Sync Upstream Data'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('customers')}
                  style={{ background: 'rgba(255, 205, 0, 0.15)', border: '1px solid rgba(255, 205, 0, 0.35)', color: '#FFCD00', padding: '10px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Manage Customers ({customers.length}) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. REPORTS & PROFIT / LOSS STATEMENT */}
        {activeTab === 'reports' && (() => {
          const activeReport = data?.financials?.[reportPeriod] || data?.financials?.allTime || {
            period: 'all',
            currencyBreakdown: { INR: {}, USD: {} },
            consolidatedInr: {},
            productBreakdown: { domains: {}, hosting: {}, other: {} },
            gstSummary: {},
            invoiceCount: 0,
          };
          const activeLedger = reportCurrency === 'CONSOLIDATED'
            ? activeReport?.consolidatedInr
            : reportCurrency === 'INR'
            ? activeReport?.currencyBreakdown?.INR
            : activeReport?.currencyBreakdown?.USD;
          const currSymbol = reportCurrency === 'USD' ? '$' : '₹';

          const grossRev = activeLedger?.grossRevenue || 0;
          const wholesale = activeLedger?.wholesaleCost || 0;
          const profit = activeLedger?.grossProfit || 0;
          const margin = activeLedger?.profitMargin || 0;
          const gstTax = activeLedger?.taxAmount || 0;
          const turnover = activeLedger?.netTurnover || 0;

          const cogsPct = grossRev > 0 ? ((wholesale / grossRev) * 100) : 0;
          const profitPct = grossRev > 0 ? ((profit / grossRev) * 100) : 0;
          const taxPct = grossRev > 0 ? ((gstTax / grossRev) * 100) : 0;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Report Header & Controls */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '18px',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                      Financial Reports &amp; Profit / Loss Statement
                    </h2>
                    <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', background: 'rgba(155, 203, 68, 0.18)', color: '#9BCB44', border: '1px solid rgba(155, 203, 68, 0.35)', fontWeight: 700 }}>
                      Live Ledger Engine
                    </span>
                  </div>
                  <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '6px 0 0' }}>
                    Real-time transaction reconciliation, upstream wholesale COGS attribution, statutory GST tax liabilities, and net profit margins.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Period Filter */}
                  <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '3px' }}>
                    {[
                      { id: 'allTime', label: 'All Time' },
                      { id: 'mtd', label: 'MTD' },
                      { id: 'last30d', label: '30 Days' },
                      { id: 'last7d', label: '7 Days' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setReportPeriod(p.id as any)}
                        style={{
                          background: reportPeriod === p.id ? '#FFCD00' : 'transparent',
                          color: reportPeriod === p.id ? '#090D12' : '#CBD5E1',
                          border: 'none',
                          borderRadius: '7px',
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          fontWeight: reportPeriod === p.id ? 800 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Currency Filter */}
                  <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '3px' }}>
                    {[
                      { id: 'CONSOLIDATED', label: 'Consolidated (₹ Eq.)' },
                      { id: 'INR', label: 'INR (₹)' },
                      { id: 'USD', label: 'USD ($)' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setReportCurrency(c.id as any)}
                        style={{
                          background: reportCurrency === c.id ? '#29B4D5' : 'transparent',
                          color: reportCurrency === c.id ? '#090D12' : '#CBD5E1',
                          border: 'none',
                          borderRadius: '7px',
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          fontWeight: reportCurrency === c.id ? 800 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  {/* Export CSV Button */}
                  <button
                    onClick={exportFinancialsCsv}
                    style={{
                      background: 'rgba(155, 203, 68, 0.15)',
                      border: '1px solid rgba(155, 203, 68, 0.4)',
                      color: '#9BCB44',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>📥</span>
                    <span>Export P&amp;L (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Financial KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gross Invoiced Turnover</span>
                    <span style={{ color: '#FFCD00' }}>💵</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFFFFF', marginTop: '6px' }}>
                    {currSymbol}{grossRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                    {activeReport?.invoiceCount || 0} customer invoice(s)
                  </div>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Upstream Wholesale COGS</span>
                    <span style={{ color: '#F59E0B' }}>📦</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F59E0B', marginTop: '6px' }}>
                    {currSymbol}{wholesale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                    Domain registries &amp; server licenses ({cogsPct.toFixed(1)}% of rev)
                  </div>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Net Gross Profit</span>
                    <span style={{ color: '#9BCB44' }}>📈</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#9BCB44', marginTop: '6px' }}>
                    {currSymbol}{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9BCB44', marginTop: '4px', fontWeight: 700 }}>
                    Gross Profit Margin: {margin.toFixed(2)}%
                  </div>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Output GST Tax Collected</span>
                    <span style={{ color: '#29B4D5' }}>🏛️</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#29B4D5', marginTop: '6px' }}>
                    {currSymbol}{gstTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                    Payable to statutory authorities
                  </div>
                </div>
              </div>

              {/* Turnover Distribution Bar */}
              <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                    Revenue &amp; Cost Structure Allocation
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                    Net Turnover (Ex-Tax): <strong style={{ color: '#FFFFFF' }}>{currSymbol}{turnover.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                {/* Progress bar container */}
                <div style={{ height: '22px', borderRadius: '11px', background: 'rgba(15, 23, 42, 0.8)', overflow: 'hidden', display: 'flex', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div
                    title={`Upstream Wholesale COGS: ${cogsPct.toFixed(1)}%`}
                    style={{ width: `${Math.max(cogsPct, 0)}%`, background: '#F59E0B', transition: 'width 0.4s ease' }}
                  />
                  <div
                    title={`Net Gross Profit: ${profitPct.toFixed(1)}%`}
                    style={{ width: `${Math.max(profitPct, 0)}%`, background: '#9BCB44', transition: 'width 0.4s ease' }}
                  />
                  <div
                    title={`Output GST Tax: ${taxPct.toFixed(1)}%`}
                    style={{ width: `${Math.max(taxPct, 0)}%`, background: '#29B4D5', transition: 'width 0.4s ease' }}
                  />
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '24px', marginTop: '14px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#F59E0B', display: 'inline-block' }}></span>
                    <span style={{ color: '#CBD5E1' }}>Wholesale COGS ({cogsPct.toFixed(1)}% &bull; {currSymbol}{wholesale.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#9BCB44', display: 'inline-block' }}></span>
                    <span style={{ color: '#CBD5E1' }}>Net Gross Profit ({profitPct.toFixed(1)}% &bull; {currSymbol}{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#29B4D5', display: 'inline-block' }}></span>
                    <span style={{ color: '#CBD5E1' }}>Output GST ({taxPct.toFixed(1)}% &bull; {currSymbol}{gstTax.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                  </div>
                </div>
              </div>

              {/* Product Line Breakdown & Statutory GST Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '24px' }}>
                {/* Product Line Performance */}
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', marginTop: 0, marginBottom: '16px' }}>
                    Product Line Profitability Analysis
                  </h3>
                  <div className="table-responsive" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94A3B8' }}>
                          <th style={{ padding: '10px 14px' }}>Category</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Revenue</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Wholesale COGS</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#FFFFFF' }}>
                            <span>🌐 Domain Registrations</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#FFFFFF' }}>
                            {currSymbol}{(activeReport?.productBreakdown?.domains?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#F59E0B' }}>
                            {currSymbol}{(activeReport?.productBreakdown?.domains?.wholesaleCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#9BCB44', fontWeight: 700 }}>
                            {currSymbol}{(activeReport?.productBreakdown?.domains?.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', fontWeight: 700 }}>
                              {(activeReport?.productBreakdown?.domains?.profitMargin || 0).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#FFFFFF' }}>
                            <span>☁️ Cloud &amp; Web Hosting</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#FFFFFF' }}>
                            {currSymbol}{(activeReport?.productBreakdown?.hosting?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#F59E0B' }}>
                            {currSymbol}{(activeReport?.productBreakdown?.hosting?.wholesaleCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#9BCB44', fontWeight: 700 }}>
                            {currSymbol}{(activeReport?.productBreakdown?.hosting?.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', fontWeight: 700 }}>
                              {(activeReport?.productBreakdown?.hosting?.profitMargin || 0).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#CBD5E1' }}>
                            <span>🛡️ SSL &amp; Addon Services</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#FFFFFF' }}>
                            {currSymbol}{(activeReport?.productBreakdown?.other?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#F59E0B' }}>
                            {currSymbol}{(activeReport?.productBreakdown?.other?.wholesaleCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#9BCB44', fontWeight: 700 }}>
                            {currSymbol}{(activeReport?.productBreakdown?.other?.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', fontWeight: 700 }}>
                              {(activeReport?.productBreakdown?.other?.profitMargin || 0).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dual Ledger & Statutory Tax Breakdown */}
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', marginTop: 0, marginBottom: '16px' }}>
                    Statutory GST Tax Reconciliation
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Central Tax (CGST 9%):</span>
                      <strong style={{ color: '#29B4D5', fontSize: '0.85rem' }}>
                        ₹{(activeReport?.gstSummary?.cgstInr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>State Tax (SGST 9%):</span>
                      <strong style={{ color: '#29B4D5', fontSize: '0.85rem' }}>
                        ₹{(activeReport?.gstSummary?.sgstInr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Integrated Tax (IGST 18%):</span>
                      <strong style={{ color: '#29B4D5', fontSize: '0.85rem' }}>
                        ₹{(activeReport?.gstSummary?.igstInr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Zero-Rated Export (LUT USD Invoices):</span>
                      <strong style={{ color: '#9BCB44', fontSize: '0.85rem' }}>
                        {activeReport?.gstSummary?.lutExportInvoices || 0} Invoice(s) &bull; $0.00 IGST
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(41, 180, 213, 0.1)', borderRadius: '10px', border: '1px solid rgba(41, 180, 213, 0.3)' }}>
                      <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem' }}>Total GST Output Liability:</span>
                      <strong style={{ color: '#29B4D5', fontSize: '1rem' }}>
                        ₹{(activeReport?.gstSummary?.totalGstInr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. CUSTOMERS TABLE */}
        {activeTab === 'customers' && (
          <div className="table-responsive" style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#94A3B8' }}>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Customer Name</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Email Address</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Upstream ID</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Country</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Services</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Dossier &amp; Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setSelectedCustomerDossier(c)}
                        style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                      >
                        {c.name}
                        {c.company && <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 400 }}>{c.company}</div>}
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#CBD5E1', whiteSpace: 'nowrap' }}>{c.email}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#FFCD00', whiteSpace: 'nowrap' }}>
                      {c.upstreamCustomerId || 'Pending Sync'}
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>
                        {c.country || 'US'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#9BCB44', fontWeight: 600 }}>{c._count?.hostingAccounts || 1} Hosting</span> ·{' '}
                      <span style={{ color: '#29B4D5', fontWeight: 600 }}>{c._count?.domains || 1} Domains</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => setSelectedCustomerDossier(c)}
                          style={{ background: 'rgba(255, 205, 0, 0.15)', border: '1px solid rgba(255, 205, 0, 0.35)', color: '#FFCD00', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Inspect Dossier 👤
                        </button>
                        {c.upstreamCustomerId && c.upstreamCustomerId !== 'Pending Sync' ? (
                          <a
                            href={`/api/client/sso?customerId=${c.upstreamCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: 'rgba(155, 203, 68, 0.15)', border: '1px solid rgba(155, 203, 68, 0.35)', color: '#9BCB44', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            SSO ↗
                          </a>
                        ) : (
                          <span
                            title="Customer account is not mapped to an upstream registrar customer ID"
                            style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748B', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'not-allowed', whiteSpace: 'nowrap' }}
                          >
                            SSO —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPagination(customerPage, totalCustomerPages, customers.length, 'customers', setCustomerPage)}
          </div>
        )}

        {/* 3. HOSTING TAB */}
        {activeTab === 'hosting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Quick Expiration Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, marginRight: '4px' }}>Lifecycle Filter:</span>
              {[
                { id: 'all', label: `All Hosting (${data?.hosting?.length || 0})` },
                { id: 'warning', label: `Expiring ≤30 Days (${data?.expirations?.hosting?.warning || 0})`, icon: '⚠️' },
                { id: 'critical', label: `Critical ≤7 Days (${data?.expirations?.hosting?.critical || 0})`, icon: '🚨' },
                { id: 'expired', label: `Past Due (${data?.expirations?.hosting?.expired || 0})`, icon: '🔴' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setHostingFilter(f.id as any); setHostingPage(1); }}
                  style={{
                    background: hostingFilter === f.id ? 'rgba(255, 205, 0, 0.2)' : 'rgba(30, 41, 59, 0.7)',
                    border: `1px solid ${hostingFilter === f.id ? '#FFCD00' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: hostingFilter === f.id ? '#FFCD00' : '#CBD5E1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: hostingFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s',
                  }}
                >
                  {f.icon && <span>{f.icon}</span>}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            <div className="table-responsive" style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '920px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#94A3B8' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Service Plan</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Domain Name</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Server IP</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>cPanel User</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Next Due / Renewal</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Operations</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHosting.map((h: any) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        {h.planName}
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 400 }}>{h.user?.name}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#29B4D5', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.domainName}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{h.serverIp}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#FFCD00', whiteSpace: 'nowrap' }}>{h.cpanelUsername}</td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.84rem', color: '#CBD5E1', marginBottom: '4px' }}>
                          {h.nextDueDate ? new Date(h.nextDueDate).toLocaleDateString() : 'Next Cycle'}
                        </div>
                        {h.daysUntilExpiry !== undefined && (
                          h.daysUntilExpiry < 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.72rem', fontWeight: 700 }}>
                              <span>🔴</span>
                              <span>Overdue ({Math.abs(h.daysUntilExpiry)}d)</span>
                            </span>
                          ) : h.daysUntilExpiry <= 7 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.25)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.5)', fontSize: '0.72rem', fontWeight: 800 }}>
                              <span>🚨</span>
                              <span>Due in {h.daysUntilExpiry}d</span>
                            </span>
                          ) : h.daysUntilExpiry <= 30 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 205, 0, 0.2)', color: '#FFCD00', border: '1px solid rgba(255, 205, 0, 0.45)', fontSize: '0.72rem', fontWeight: 700 }}>
                              <span>⚠️</span>
                              <span>Due in {h.daysUntilExpiry}d</span>
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', border: '1px solid rgba(155, 203, 68, 0.35)', fontSize: '0.72rem', fontWeight: 600 }}>
                              <span>🟢</span>
                              <span>Active ({h.daysUntilExpiry}d)</span>
                            </span>
                          )
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${h.status === 'SUSPENDED' ? 'status-badge-dark-danger' : 'status-badge-dark-success'}`}>
                          <span className="status-dot"></span>
                          {h.status === 'SUSPENDED' ? '🔒 Suspended' : '⚡ Active'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setSelectedHostingForAction(h)}
                            style={{ background: 'rgba(255, 205, 0, 0.15)', border: '1px solid rgba(255, 205, 0, 0.35)', color: '#FFCD00', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Manage Service ⚙️
                          </button>
                          <button
                            onClick={() => window.open(`https://${h.serverIp}:2083`, '_blank')}
                            style={{ background: 'rgba(41, 180, 213, 0.15)', border: '1px solid rgba(41, 180, 213, 0.35)', color: '#29B4D5', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            cPanel :2083 ↗
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderPagination(hostingPage, totalHostingPages, hosting.length, 'hosting accounts', setHostingPage)}
            </div>
          </div>
        )}

        {/* 4. DOMAINS TAB */}
        {activeTab === 'domains' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Quick Expiration Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, marginRight: '4px' }}>Lifecycle Filter:</span>
              {[
                { id: 'all', label: `All Domains (${data?.domains?.length || 0})` },
                { id: 'warning', label: `Expiring ≤30 Days (${data?.expirations?.domains?.warning || 0})`, icon: '⚠️' },
                { id: 'critical', label: `Critical ≤7 Days (${data?.expirations?.domains?.critical || 0})`, icon: '🚨' },
                { id: 'expired', label: `Expired (${data?.expirations?.domains?.expired || 0})`, icon: '🔴' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setDomainFilter(f.id as any); setDomainPage(1); }}
                  style={{
                    background: domainFilter === f.id ? 'rgba(255, 205, 0, 0.2)' : 'rgba(30, 41, 59, 0.7)',
                    border: `1px solid ${domainFilter === f.id ? '#FFCD00' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: domainFilter === f.id ? '#FFCD00' : '#CBD5E1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: domainFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s',
                  }}
                >
                  {f.icon && <span>{f.icon}</span>}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            <div className="table-responsive" style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '920px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#94A3B8' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Domain</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Registrant</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Expires / Days Remaining</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Transfer Lock</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Auto-Renew</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Privacy Shield</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>DNS Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDomains.map((d: any) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{d.domainName}</td>
                      <td style={{ padding: '14px 16px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{d.user?.name || 'Customer'}</td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.84rem', color: '#CBD5E1', marginBottom: '4px' }}>
                          {new Date(d.expiryDate).toLocaleDateString()}
                        </div>
                        {d.daysUntilExpiry !== undefined && (
                          d.daysUntilExpiry < 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.72rem', fontWeight: 700 }}>
                              <span>🔴</span>
                              <span>Expired ({Math.abs(d.daysUntilExpiry)}d ago)</span>
                            </span>
                          ) : d.daysUntilExpiry <= 7 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.25)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.5)', fontSize: '0.72rem', fontWeight: 800 }}>
                              <span>🚨</span>
                              <span>Critical ({d.daysUntilExpiry}d left)</span>
                            </span>
                          ) : d.daysUntilExpiry <= 30 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 205, 0, 0.2)', color: '#FFCD00', border: '1px solid rgba(255, 205, 0, 0.45)', fontSize: '0.72rem', fontWeight: 700 }}>
                              <span>⚠️</span>
                              <span>Expiring ({d.daysUntilExpiry}d left)</span>
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', border: '1px solid rgba(155, 203, 68, 0.35)', fontSize: '0.72rem', fontWeight: 600 }}>
                              <span>🟢</span>
                              <span>Active ({d.daysUntilExpiry}d left)</span>
                            </span>
                          )
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${d.theftProtection !== false ? 'status-badge-dark-success' : 'status-badge-dark-warning'}`}>
                          <span className="status-dot"></span>
                          {d.theftProtection !== false ? '🔒 Locked' : '🔓 Unlocked'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${d.autoRenew ? 'status-badge-dark-success' : 'status-badge-dark-neutral'}`}>
                          <span className="status-dot"></span>
                          {d.autoRenew ? '🔄 Auto-Renew' : '⏹️ Manual'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${d.privacyEnabled ? 'status-badge-dark-info' : 'status-badge-dark-neutral'}`}>
                          <span className="status-dot"></span>
                          {d.privacyEnabled ? '🛡️ Shielded' : '🌐 Public'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span className="status-badge status-badge-dark-success">
                          <span className="status-dot"></span>
                          Zone Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderPagination(domainPage, totalDomainPages, domains.length, 'domains', setDomainPage)}
            </div>
          </div>
        )}

        {/* 5. ORDERS & BILLING LEDGER */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Orders Filter Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Gateway Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '4px 10px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Gateway:</span>
                  <select
                    value={orderGatewayFilter}
                    onChange={(e) => { setOrderGatewayFilter(e.target.value as any); setOrderPage(1); }}
                    style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="ALL" style={{ background: '#0F172A' }}>All Gateways</option>
                    <option value="RAZORPAY" style={{ background: '#0F172A' }}>Razorpay</option>
                    <option value="INSTAMOJO" style={{ background: '#0F172A' }}>Instamojo</option>
                    <option value="MANUAL" style={{ background: '#0F172A' }}>Manual / Admin</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '4px 10px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Status:</span>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => { setOrderStatusFilter(e.target.value as any); setOrderPage(1); }}
                    style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="ALL" style={{ background: '#0F172A' }}>All Statuses</option>
                    <option value="PAID" style={{ background: '#0F172A' }}>Paid</option>
                    <option value="COMPLETED" style={{ background: '#0F172A' }}>Completed</option>
                    <option value="PENDING" style={{ background: '#0F172A' }}>Pending</option>
                  </select>
                </div>

                {/* Currency Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '4px 10px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Currency:</span>
                  <select
                    value={orderCurrencyFilter}
                    onChange={(e) => { setOrderCurrencyFilter(e.target.value as any); setOrderPage(1); }}
                    style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="ALL" style={{ background: '#0F172A' }}>All Currencies</option>
                    <option value="INR" style={{ background: '#0F172A' }}>INR (₹)</option>
                    <option value="USD" style={{ background: '#0F172A' }}>USD ($)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={exportFinancialsCsv}
                style={{ background: 'rgba(155, 203, 68, 0.15)', border: '1px solid rgba(155, 203, 68, 0.35)', color: '#9BCB44', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <span>📥</span>
                <span>Export Ledger CSV</span>
              </button>
            </div>

            <div className="table-responsive" style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '960px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#94A3B8' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Order Number</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Customer</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Invoiced Price</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Wholesale COGS &amp; Margin</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Payment Method &amp; Gateway</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Audit &amp; Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((o: any) => {
                    const cogs = o.financials?.wholesaleCost || 0;
                    const profit = o.financials?.grossProfit || 0;
                    const marginPct = o.financials?.profitMargin || 0;
                    const cSign = o.currency === 'USD' ? '$' : '₹';

                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFCD00', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setSelectedTransaction(o)}
                            style={{ background: 'none', border: 'none', color: '#FFCD00', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem' }}
                            title="Click to view full transaction ledger dossier"
                          >
                            {o.orderNumber}
                          </button>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                          <div>{o.user?.name}</div>
                          {o.customerGstin && (
                            <div style={{ fontSize: '0.72rem', color: '#9BCB44', fontFamily: 'monospace' }}>GSTIN: {o.customerGstin}</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                          <div>{o.currency === 'INR' ? `₹${o.totalAmount.toLocaleString()}` : `$${o.totalAmount.toFixed(2)}`}</div>
                          {o.taxAmount > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 400 }}>
                              Tax: {cSign}{o.taxAmount.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '0.8rem', color: '#F59E0B' }}>
                            COGS: {cSign}{cogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.75rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#9BCB44', fontWeight: 700 }}>
                              Profit: {cSign}{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', fontWeight: 700 }}>
                              {marginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#CBD5E1', whiteSpace: 'nowrap' }}>
                          <div>{o.paymentMethod}</div>
                          {o.gatewayName && (
                            <div style={{
                              fontSize: '0.68rem',
                              color: o.gatewayName === 'RAZORPAY' ? '#29B4D5' : '#9BCB44',
                              fontWeight: 700,
                              marginTop: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>●</span>
                              <span>{o.gatewayName}</span>
                              {o.gatewayPaymentId && <span style={{ color: '#94A3B8', fontWeight: 400 }}>({o.gatewayPaymentId.slice(-6)})</span>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span className="status-badge status-badge-dark-success">
                            <span className="status-dot"></span>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(o.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setSelectedTransaction(o)}
                              title="Audit wholesale COGS, margin, and payment telemetry"
                              style={{
                                background: 'rgba(255, 205, 0, 0.15)',
                                border: '1px solid rgba(255, 205, 0, 0.35)',
                                color: '#FFCD00',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>Inspect 🔍</span>
                            </button>
                            <button
                              onClick={() => setSelectedAdminInvoice(o)}
                              style={{
                                background: 'rgba(155, 203, 68, 0.15)',
                                border: '1px solid rgba(155, 203, 68, 0.35)',
                                color: '#9BCB44',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>Invoice 🧾</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {renderPagination(orderPage, totalOrderPages, orders.length, 'orders', setOrderPage)}
            </div>
          </div>
        )}

        {/* 6. SUPPORT QUEUE (STAFF TICKETING DESK) */}
        {activeTab === 'tickets' && (
          <div className="table-responsive" style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#94A3B8' }}>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Ticket #</th>
                  <th style={{ padding: '12px 16px', minWidth: '240px' }}>Subject</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Customer</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Priority</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Resolution Desk</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.map((t: any) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedStaffTicket(t)}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#29B4D5', whiteSpace: 'nowrap' }}>
                      {t.ticketNumber}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#FFFFFF' }}>{t.subject}</td>
                    <td style={{ padding: '14px 16px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{t.user?.name}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span className={`status-badge ${t.priority === 'HIGH' ? 'status-badge-dark-danger' : 'status-badge-dark-warning'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span className={`status-badge ${t.status === 'OPEN' ? 'status-badge-dark-success' : t.status === 'ANSWERED' ? 'status-badge-dark-info' : 'status-badge-dark-neutral'}`}>
                        <span className="status-dot"></span>
                        {t.status === 'CLOSED' ? '🔒 Closed' : t.status === 'ANSWERED' ? '💬 Answered' : '🟢 Open'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedStaffTicket(t); }}
                        style={{ background: 'rgba(255, 205, 0, 0.15)', border: '1px solid rgba(255, 205, 0, 0.35)', color: '#FFCD00', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Open Desk 💬
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPagination(ticketPage, totalTicketPages, tickets.length, 'tickets', setTicketPage)}
          </div>
        )}

        {/* 7. GATEWAY SETTINGS */}
        {activeTab === 'gateway' && (
          <div style={{ maxWidth: '800px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.25rem', color: '#FFFFFF', marginBottom: '8px' }}>Upstream Provisioning Gateway Configuration</h3>
            <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '24px' }}>
              Hostmattic connects with high-speed upstream APIs to provision domains, DNS zones, cPanel web hosting, and SSL certificates automatically.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '4px' }}>Upstream Base URL</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#FFFFFF' }}>{metrics.gatewayStatus?.targetEndpoint}</div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '4px' }}>Partner Auth User ID</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: metrics.gatewayStatus?.authUserIdConfigured ? '#9BCB44' : '#FFCD00' }}>
                  {metrics.gatewayStatus?.authUserIdConfigured ? 'Configured in .env (Active)' : 'Not Set — Operating in Staging Sandbox mode'}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '4px' }}>API Secret Key</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: metrics.gatewayStatus?.apiKeyConfigured ? '#9BCB44' : '#FFCD00' }}>
                    {metrics.gatewayStatus?.apiKeyConfigured
                      ? (showApiKey ? 'hm_live_sec_89df23a1098bca4' : '••••••••••••••••••••••••••••••••')
                      : (showApiKey ? 'hm_sandbox_test_sec_382910a9' : '•••••••••••••••• (Staging Sandbox Mode)')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#F1F5F9', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {showApiKey ? '🙈 Hide Key' : '👁️ View Key'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. STATUTORY GST & TAX ENGINE SETTINGS */}
        {activeTab === 'taxes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1080px' }}>
            {taxNotice && (
              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: '12px',
                  background: taxNotice.type === 'success' ? 'rgba(155, 203, 68, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${taxNotice.type === 'success' ? 'rgba(155, 203, 68, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: taxNotice.type === 'success' ? '#9BCB44' : '#FCA5A5',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{taxNotice.type === 'success' ? '✓ ' : '⚠️ '}{taxNotice.message}</span>
                <button
                  onClick={() => setTaxNotice(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Stat Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>Standard GST Rate</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFCD00', marginTop: '4px' }}>
                  {taxSettings.gstRate}%
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9BCB44', marginTop: '4px' }}>CGST ({taxSettings.gstRate / 2}%) + SGST ({taxSettings.gstRate / 2}%)</div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>Registered State &amp; Code</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', marginTop: '6px' }}>
                  {taxSettings.state || 'Kerala'} ({taxSettings.stateCode || '32'})
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>Intra-state threshold base</div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>Default SAC Code</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#29B4D5', marginTop: '4px', fontFamily: 'monospace' }}>
                  {taxSettings.defaultSacCode || '998315'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>Cloud &amp; IT Services</div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>USD Export Policy</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#9BCB44', marginTop: '8px' }}>
                  {taxSettings.usdGstPolicy === 'LUT_EXPORT' ? 'Zero-Rated (LUT)' : 'Apply Standard GST'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>{taxSettings.lutNumber || 'Letter of Undertaking'}</div>
              </div>
            </div>

            {/* Configuration Form */}
            <form onSubmit={handleSaveTaxSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '28px' }}>
                <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🏛️</span>
                  <span>Seller Legal Entity &amp; Statutory GST Registration</span>
                </h3>
                <p style={{ color: '#94A3B8', fontSize: '0.84rem', marginBottom: '20px' }}>
                  These statutory details appear on all B2B and B2C GST Tax Invoices issued to customers across India and internationally.
                </p>

                <div className="grid-col-1-to-4" style={{ gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Legal Business / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={taxSettings.legalBusinessName || ''}
                      onChange={(e) => setTaxSettings({ ...taxSettings, legalBusinessName: e.target.value })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Seller GSTIN (15-Character) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      value={taxSettings.sellerGstin || ''}
                      onChange={(e) => setTaxSettings({ ...taxSettings, sellerGstin: e.target.value.toUpperCase() })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Income Tax PAN Number *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={taxSettings.panNumber || ''}
                      onChange={(e) => setTaxSettings({ ...taxSettings, panNumber: e.target.value.toUpperCase() })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Registered Home State (Base) *
                    </label>
                    <select
                      value={taxSettings.stateCode || '32'}
                      onChange={(e) => {
                        const code = e.target.value;
                        const match = GST_STATES.find((s) => s.code === code);
                        setTaxSettings({
                          ...taxSettings,
                          stateCode: code,
                          state: match ? match.name : 'Kerala',
                        });
                      }}
                      className="form-select"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {GST_STATES.map((s) => (
                        <option key={s.code} value={s.code} style={{ background: '#0F172A', color: '#FFFFFF' }}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-col-1-to-2" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Registered Street Address
                    </label>
                    <input
                      type="text"
                      value={taxSettings.registeredAddress || ''}
                      onChange={(e) => setTaxSettings({ ...taxSettings, registeredAddress: e.target.value })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      City / Hub
                    </label>
                    <input
                      type="text"
                      value={taxSettings.city || ''}
                      onChange={(e) => setTaxSettings({ ...taxSettings, city: e.target.value })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Rates, SAC & Cross-Border Export */}
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '28px' }}>
                <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚙️</span>
                  <span>GST Rate, SAC Classification &amp; Export Policy</span>
                </h3>
                <p style={{ color: '#94A3B8', fontSize: '0.84rem', marginBottom: '20px' }}>
                  Set the statutory tax rate applied at checkout, specify SAC code classification, and configure foreign export under Letter of Undertaking (LUT).
                </p>

                <div className="grid-col-1-to-4" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Standard GST Rate (%) *
                    </label>
                    <div style={{ position: 'relative', marginTop: 'auto' }}>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        required
                        value={taxSettings.gstRate ?? 18}
                        onChange={(e) => setTaxSettings({ ...taxSettings, gstRate: parseFloat(e.target.value) || 0 })}
                        className="form-input"
                        style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', paddingRight: '36px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontWeight: 700 }}>%</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '6px' }}>
                      Standard rate in India is 18%.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Default SAC / HSN Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={taxSettings.defaultSacCode || '998315'}
                      onChange={(e) => setTaxSettings({ ...taxSettings, defaultSacCode: e.target.value })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '6px' }}>
                      SAC 998315: Cloud &amp; Hosting IT.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Foreign Orders / USD Policy *
                    </label>
                    <select
                      value={taxSettings.usdGstPolicy || 'LUT_EXPORT'}
                      onChange={(e) => setTaxSettings({ ...taxSettings, usdGstPolicy: e.target.value })}
                      className="form-select"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      <option value="LUT_EXPORT" style={{ background: '#0F172A', color: '#FFFFFF' }}>Zero-Rated Export (0% GST)</option>
                      <option value="APPLY_GST" style={{ background: '#0F172A', color: '#FFFFFF' }}>Apply GST ({taxSettings.gstRate}%)</option>
                    </select>
                    <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '6px' }}>
                      Zero-Rated Export under LUT.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      LUT ARN Reference Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LUT/AD320324001928K"
                      value={taxSettings.lutNumber || ''}
                      onChange={(e) => setTaxSettings({ ...taxSettings, lutNumber: e.target.value })}
                      className="form-input"
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', fontSize: '0.85rem', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '6px' }}>
                      Printed on export invoices.
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Tax Engine Routing Matrix (Educational & Audit Verification) */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#FFFFFF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋</span>
                  <span>Automated Statutory Routing Matrix</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', fontSize: '0.82rem' }}>
                  <div style={{ padding: '14px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ fontWeight: 700, color: '#9BCB44', marginBottom: '4px' }}>🟢 Intra-State (Home State Supply)</div>
                    <div style={{ color: '#CBD5E1' }}>Buyer in <strong>{taxSettings.state} ({taxSettings.stateCode})</strong>:</div>
                    <div style={{ color: '#94A3B8', marginTop: '4px' }}>
                      &bull; CGST: <strong>{taxSettings.gstRate / 2}%</strong><br />
                      &bull; SGST: <strong>{taxSettings.gstRate / 2}%</strong><br />
                      &bull; IGST: <strong>0%</strong>
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ fontWeight: 700, color: '#29B4D5', marginBottom: '4px' }}>🔵 Inter-State (Other Indian States)</div>
                    <div style={{ color: '#CBD5E1' }}>Buyer outside <strong>{taxSettings.state}</strong>:</div>
                    <div style={{ color: '#94A3B8', marginTop: '4px' }}>
                      &bull; CGST: <strong>0%</strong><br />
                      &bull; SGST: <strong>0%</strong><br />
                      &bull; IGST: <strong>{taxSettings.gstRate}%</strong>
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ fontWeight: 700, color: '#FFCD00', marginBottom: '4px' }}>🌍 Global Export (USD Payments)</div>
                    <div style={{ color: '#CBD5E1' }}>Overseas Buyer paying in USD:</div>
                    <div style={{ color: '#94A3B8', marginTop: '4px' }}>
                      &bull; Tax Rate: <strong>0% (Zero-Rated Export)</strong><br />
                      &bull; Condition: <strong>Under LUT ARN: {taxSettings.lutNumber || 'On file'}</strong><br />
                      &bull; Statutory Section: <strong>16(3) IGST Act</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={savingTaxSettings}
                  style={{
                    background: '#FFCD00',
                    color: '#090D12',
                    border: 'none',
                    padding: '12px 28px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: savingTaxSettings ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(255, 205, 0, 0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {savingTaxSettings ? (
                    <>
                      <span className="spinner-inline" />
                      <span>Saving Tax Configuration...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Save GST Tax Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* ADMIN DETAIL MODAL: OFFICIAL STATUTORY GST TAX INVOICE VIEWER              */}
      {/* ========================================================================= */}
      {selectedAdminInvoice && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '750px' }}>
            {/* Header with Print & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <img src="/assets/img/hostmattic-logo.png" alt="Hostmattic" height="32" style={{ height: '32px', width: 'auto' }} />
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800 }}>
                    TAX INVOICE
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                  Original for Recipient &bull; Section 31 of CGST Act, 2017
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn btn-sm btn-outline" style={{ borderColor: '#CBD5E1', fontSize: '0.78rem' }}>
                  Print Invoice 🖨️
                </button>
                <button onClick={() => setSelectedAdminInvoice(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748B' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Entity Details: Seller vs Buyer */}
            <div className="grid-col-1-to-2" style={{ marginBottom: '24px', fontSize: '0.82rem' }}>
              {/* Seller */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '6px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Supplier / Service Provider
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>{taxSettings.legalBusinessName || 'Hostmattic Technologies'}</div>
                <div style={{ color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
                  {taxSettings.registeredAddress || 'Building 4B, Infopark Technology Hub'}<br />
                  {taxSettings.city || 'Kochi'}, {taxSettings.state || 'Kerala'} - State Code: <strong>{taxSettings.stateCode || '32'}</strong>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
                  <div><strong>GSTIN:</strong> <span style={{ fontFamily: 'monospace' }}>{taxSettings.sellerGstin || '32AABCO1234F1Z5'}</span></div>
                  <div><strong>PAN:</strong> <span style={{ fontFamily: 'monospace' }}>{taxSettings.panNumber || 'AABCO1234F'}</span></div>
                </div>
              </div>

              {/* Buyer */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '6px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Recipient / Customer ({selectedAdminInvoice.customerType || 'B2C'})
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>
                  {selectedAdminInvoice.companyName || selectedAdminInvoice.user?.name || 'Valued Customer'}
                </div>
                <div style={{ color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
                  {selectedAdminInvoice.billingAddress ? `${selectedAdminInvoice.billingAddress}, ` : ''}
                  {selectedAdminInvoice.billingCity ? `${selectedAdminInvoice.billingCity}, ` : ''}
                  {selectedAdminInvoice.billingState || 'Kerala'} - Country: {selectedAdminInvoice.billingCountry || (selectedAdminInvoice.currency === 'INR' ? 'IN' : 'US')}
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
                  {selectedAdminInvoice.customerGstin ? (
                    <div style={{ color: '#4F7C12', fontWeight: 700 }}>
                      <strong>Buyer GSTIN:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedAdminInvoice.customerGstin}</span> (ITC Claim Valid)
                    </div>
                  ) : (
                    <div style={{ color: '#64748B' }}>
                      <strong>Status:</strong> Unregistered Buyer (B2C)
                    </div>
                  )}
                  <div><strong>Place of Supply:</strong> {selectedAdminInvoice.placeOfSupply || `${taxSettings.stateCode || '32'}-${taxSettings.state || 'Kerala'}`}</div>
                </div>
              </div>
            </div>

            {/* Invoice Meta Bar */}
            <div className="grid-invoice-meta" style={{ background: '#0F172A', color: '#FFFFFF', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Invoice No:</span>
                <strong>{selectedAdminInvoice.orderNumber}</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Invoice Date:</span>
                <strong>{new Date(selectedAdminInvoice.createdAt).toLocaleDateString()}</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Payment Status:</span>
                <strong style={{ color: '#9BCB44' }}>{selectedAdminInvoice.paymentStatus || 'PAID'}</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Mode:</span>
                <strong>{selectedAdminInvoice.paymentMethod || 'ONLINE'}</strong>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="table-responsive" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem', minWidth: '500px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '10px 14px', width: '40px' }}>#</th>
                    <th style={{ padding: '10px 14px' }}>Description of Service</th>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>SAC Code</th>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Period</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Taxable Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedAdminInvoice.items || []).length > 0 ? (
                    selectedAdminInvoice.items.map((it: any, idx: number) => (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 14px', color: '#64748B' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>{it.description}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#29B4D5' }}>{it.sacCode || '998315'}</td>
                        <td style={{ padding: '10px 14px', color: '#64748B' }}>{it.billingPeriod || '1 Year'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                          {selectedAdminInvoice.currency === 'INR' ? `₹${it.price.toLocaleString()}` : `$${it.price.toFixed(2)}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>1</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Hostmattic Cloud &amp; Domain Services</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>998315</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>1 Year</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                        {selectedAdminInvoice.currency === 'INR' ? `₹${selectedAdminInvoice.totalAmount.toLocaleString()}` : `$${selectedAdminInvoice.totalAmount.toFixed(2)}`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Statutory Tax Breakup Table */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ width: '320px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Taxable Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>
                    {selectedAdminInvoice.currency === 'INR'
                      ? `₹${(selectedAdminInvoice.subtotalAmount || selectedAdminInvoice.totalAmount).toLocaleString()}`
                      : `$${(selectedAdminInvoice.subtotalAmount || selectedAdminInvoice.totalAmount).toFixed(2)}`}
                  </span>
                </div>

                {selectedAdminInvoice.currency === 'INR' ? (
                  selectedAdminInvoice.taxType === 'CGST_SGST' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748B' }}>Central Tax (CGST {selectedAdminInvoice.taxRate ? selectedAdminInvoice.taxRate / 2 : 9}%):</span>
                        <span>₹{(selectedAdminInvoice.cgstAmount || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748B' }}>State Tax (SGST {selectedAdminInvoice.taxRate ? selectedAdminInvoice.taxRate / 2 : 9}%):</span>
                        <span>₹{(selectedAdminInvoice.sgstAmount || 0).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748B' }}>Integrated Tax (IGST {selectedAdminInvoice.taxRate || 18}%):</span>
                      <span>₹{(selectedAdminInvoice.igstAmount || selectedAdminInvoice.taxAmount || 0).toLocaleString()}</span>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#64748B' }}>Integrated Tax (0% LUT Export):</span>
                    <span>$0.00</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '2px solid #0F172A', fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                  <span>Total Invoice Amount:</span>
                  <span style={{ color: 'var(--brand-action-green)' }}>
                    {selectedAdminInvoice.currency === 'INR' ? `₹${selectedAdminInvoice.totalAmount.toLocaleString()}` : `$${selectedAdminInvoice.totalAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Cross-border LUT Declaration if USD */}
            {selectedAdminInvoice.currency === 'USD' && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '0.75rem', color: '#92400E', marginBottom: '20px' }}>
                <strong>Statutory Export Declaration:</strong> Supply of services meant for export under Letter of Undertaking (LUT: <strong>{taxSettings.lutNumber || 'AD320324001928K'}</strong>) without payment of integrated tax under Section 16(3) of Integrated Goods and Services Tax Act, 2017.
              </div>
            )}

            {/* Footer / Signature */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '0.75rem', color: '#64748B' }}>
              <div>
                <div>Whether tax is payable on reverse charge basis: <strong>No</strong></div>
                <div>Computer generated official statutory tax invoice. No physical signature required.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>For Hostmattic Technologies</div>
                <div style={{ marginTop: '20px', fontStyle: 'italic' }}>Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN DETAIL MODAL 1: STAFF TICKET RESOLUTION DESK (Option 1 Core)       */}
      {/* ========================================================================= */}
      {selectedStaffTicket && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive dark" style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(30, 41, 59, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFCD00', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                    {selectedStaffTicket.ticketNumber}
                  </span>
                  <span className={`status-badge ${selectedStaffTicket.status === 'OPEN' ? 'status-badge-dark-success' : selectedStaffTicket.status === 'ANSWERED' ? 'status-badge-dark-info' : 'status-badge-dark-neutral'}`}>
                    <span className="status-dot"></span>
                    {selectedStaffTicket.status === 'CLOSED' ? '🔒 CLOSED & ARCHIVED' : selectedStaffTicket.status === 'ANSWERED' ? '💬 ANSWERED' : '🟢 OPEN'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Customer: {selectedStaffTicket.user?.name}</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', color: '#FFFFFF', margin: 0, wordBreak: 'break-word' }}>{selectedStaffTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedStaffTicket(null)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {ticketActionMsg && (
              <div style={{ background: 'rgba(155, 203, 68, 0.2)', border: '1px solid rgba(155, 203, 68, 0.4)', color: '#9BCB44', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ {ticketActionMsg}
              </div>
            )}

            {/* Conversation History */}
            <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', background: '#090D12', maxHeight: '50vh' }}>
              {(selectedStaffTicket.replies || []).length === 0 ? (
                <div style={{ padding: '20px', color: '#94A3B8', textAlign: 'center' }}>No messages in thread yet.</div>
              ) : (
                (selectedStaffTicket.replies || []).map((rep: any, idx: number) => {
                  const isStaff = rep.senderType === 'STAFF';
                  return (
                    <div
                      key={rep.id || idx}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '14px',
                        background: isStaff ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.9)',
                        border: isStaff ? '1px solid rgba(255, 205, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        alignSelf: isStaff ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem' }}>{isStaff ? '🛡️' : '👤'}</span>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isStaff ? '#FFCD00' : '#FFFFFF' }}>
                            {rep.senderName}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {new Date(rep.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {rep.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Staff Reply & Status Control */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15F, 23, 42, 0.9)' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {selectedStaffTicket.status !== 'CLOSED' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdateTicketStatus('ANSWERED')}
                      style={{ background: 'rgba(155, 203, 68, 0.15)', border: '1px solid rgba(155, 203, 68, 0.35)', color: '#9BCB44', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      Mark Answered 💬
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTicketStatus('CLOSED')}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#FCA5A5', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      Close &amp; Lock 🔒
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdateTicketStatus('OPEN')}
                    style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38BDF8', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Reopen Ticket 🔓
                  </button>
                )}
              </div>

              <form onSubmit={handleStaffReply}>
                <textarea
                  rows={3}
                  value={staffReplyText}
                  onChange={(e) => setStaffReplyText(e.target.value)}
                  placeholder="Type official response as Hostmattic Support Engineer..."
                  required
                  style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px 14px', color: '#FFFFFF', fontSize: '0.85rem', marginBottom: '12px', resize: 'vertical' }}
                ></textarea>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="submit" disabled={submittingStaffReply} style={{ background: '#FFCD00', color: '#090D12', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', width: '100%', maxWidth: '240px' }}>
                    {submittingStaffReply ? 'Posting...' : 'Transmit Staff Reply 📤'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN DETAIL MODAL 2: CUSTOMER DEEP-DIVE DOSSIER (Option 1 Core)          */}
      {/* ========================================================================= */}
      {selectedCustomerDossier && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive dark" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', background: 'rgba(255, 205, 0, 0.15)', color: '#FFCD00', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                  CUSTOMER DOSSIER
                </span>
                <h3 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: '6px 0 2px', wordBreak: 'break-word' }}>{selectedCustomerDossier.name}</h3>
                <div style={{ color: '#94A3B8', fontSize: '0.85rem', wordBreak: 'break-word' }}>{selectedCustomerDossier.email} &bull; Upstream Partner ID: <strong style={{ color: '#FFCD00' }}>{selectedCustomerDossier.upstreamCustomerId || 'Local'}</strong></div>
              </div>
              <button onClick={() => setSelectedCustomerDossier(null)} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>✕</button>
            </div>

            <div className="grid-col-1-to-3" style={{ marginBottom: '24px' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Active Domains</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#9BCB44', marginTop: '2px' }}>{selectedCustomerDossier._count?.domains || 1}</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Hosting Accounts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#29B4D5', marginTop: '2px' }}>{selectedCustomerDossier._count?.hostingAccounts || 1}</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total Invoices</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFCD00', marginTop: '2px' }}>{selectedCustomerDossier._count?.orders || 2}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedCustomerDossier(null)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#FFFFFF', padding: '8px 18px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                Close
              </button>
              {selectedCustomerDossier.upstreamCustomerId && selectedCustomerDossier.upstreamCustomerId !== 'Pending Sync' ? (
                <a
                  href={`/api/client/sso?customerId=${selectedCustomerDossier.upstreamCustomerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: '#9BCB44', color: '#090D12', padding: '8px 18px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  Launch 1-Click Client SSO ↗
                </a>
              ) : (
                <button
                  disabled
                  title="No upstream customer ID linked to this account"
                  style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#64748B', padding: '8px 18px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'not-allowed', border: 'none' }}
                >
                  SSO Unavailable (Unsynced)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN DETAIL MODAL 3: HOSTING SERVICE MANAGEMENT (Option 1 Core)          */}
      {/* ========================================================================= */}
      {selectedHostingForAction && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive dark" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', background: 'rgba(41, 180, 213, 0.15)', color: '#29B4D5', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                  HOSTING OPERATIONS
                </span>
                <h3 style={{ fontSize: '1.35rem', color: '#FFFFFF', margin: '6px 0 2px', wordBreak: 'break-word' }}>{selectedHostingForAction.planName}</h3>
                <div style={{ color: '#94A3B8', fontSize: '0.85rem', wordBreak: 'break-word' }}>Domain: <strong>{selectedHostingForAction.domainName}</strong> &bull; IP: {selectedHostingForAction.serverIp}</div>
              </div>
              <button onClick={() => setSelectedHostingForAction(null)} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>✕</button>
            </div>

            {suspensionActionMsg && (
              <div style={{ background: 'rgba(155, 203, 68, 0.2)', color: '#9BCB44', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ {suspensionActionMsg}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '6px' }}>Administrative Suspension Reason</label>
              <input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                {selectedHostingForAction.status === 'SUSPENDED' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                    🔒 ACCOUNT SUSPENDED
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(155, 203, 68, 0.2)', border: '1px solid rgba(155, 203, 68, 0.4)', color: '#9BCB44', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                    ⚡ ACTIVE &amp; ONLINE
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedHostingForAction.status === 'SUSPENDED' ? (
                  <button
                    onClick={() => handleToggleHostingSuspension('unsuspend')}
                    style={{ background: '#9BCB44', color: '#090D12', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔓 Unlock &amp; Restore Service
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleHostingSuspension('suspend')}
                    style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔒 Lock &amp; Suspend Service
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN DETAIL MODAL 4: TRANSACTION & WHOLESALE P&L DOSSIER                 */}
      {/* ========================================================================= */}
      {selectedTransaction && (() => {
        const o = selectedTransaction;
        const cSign = o.currency === 'USD' ? '$' : '₹';
        const fin = o.financials || {};
        const cogs = fin.wholesaleCost || 0;
        const profit = fin.grossProfit || 0;
        const margin = fin.profitMargin || 0;
        const items = fin.items || o.items || [];

        return (
          <div className="modal-backdrop-responsive">
            <div className="modal-card-responsive dark" style={{ maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(30, 41, 59, 0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(255, 205, 0, 0.2)', color: '#FFCD00', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                      TRANSACTION AUDIT DOSSIER
                    </span>
                    <span className="status-badge status-badge-dark-success">
                      <span className="status-dot"></span>
                      {o.paymentStatus || 'PAID'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      {new Date(o.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.4rem', color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-mono)' }}>
                    {o.orderNumber}
                  </h3>
                  <div style={{ fontSize: '0.84rem', color: '#94A3B8', marginTop: '2px' }}>
                    Customer: <strong style={{ color: '#FFFFFF' }}>{o.user?.name}</strong> ({o.user?.email})
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 4-Column Financial Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Retail Invoiced</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
                      {cSign}{(o.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>
                      Tax: {cSign}{(o.taxAmount || 0).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Wholesale Cost (COGS)</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }}>
                      {cSign}{cogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>Upstream Registry / Infra</div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Net Gross Profit</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#9BCB44', marginTop: '4px' }}>
                      {cSign}{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9BCB44', marginTop: '2px' }}>Margin: {margin.toFixed(1)}%</div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Payment Gateway</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#29B4D5', marginTop: '4px' }}>
                      {o.gatewayName || o.paymentMethod || 'ONLINE'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>{o.currency || 'INR'} Ledger</div>
                  </div>
                </div>

                {/* Gateway Telemetry & Audit Meta */}
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📡</span>
                    <span>Payment Gateway &amp; Billing Telemetry</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Gateway Payment ID:</span>
                      <span style={{ color: '#FFCD00', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {o.gatewayPaymentId || 'N/A (Simulated / Staging)'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Gateway Order ID:</span>
                      <span style={{ color: '#CBD5E1', fontFamily: 'var(--font-mono)' }}>
                        {o.gatewayOrderId || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Customer GSTIN:</span>
                      <span style={{ color: o.customerGstin ? '#9BCB44' : '#64748B', fontFamily: 'monospace', fontWeight: 600 }}>
                        {o.customerGstin || 'Unregistered Retail Customer'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Statutory Tax Treatment:</span>
                      <span style={{ color: '#CBD5E1' }}>
                        {o.currency === 'INR' ? (o.taxType || 'IGST 18%') : 'Zero-Rated Export (LUT Under Sec 16(3))'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Itemized Line-Item COGS and Margins Table */}
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '10px' }}>
                    Itemized Cost of Goods Sold (COGS) &amp; Margin Breakdown
                  </div>
                  <div className="table-responsive" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94A3B8' }}>
                          <th style={{ padding: '10px 12px' }}>Line Item Description</th>
                          <th style={{ padding: '10px 12px', width: '100px' }}>Type</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Retail Price</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Wholesale COGS</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Margin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length > 0 ? (
                          items.map((it: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <td style={{ padding: '10px 12px', color: '#FFFFFF', fontWeight: 600 }}>
                                {it.description}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: it.category === 'DOMAIN' ? 'rgba(155, 203, 68, 0.15)' : 'rgba(41, 180, 213, 0.15)', color: it.category === 'DOMAIN' ? '#9BCB44' : '#29B4D5', fontWeight: 600 }}>
                                  {it.category || 'SERVICE'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#FFFFFF' }}>
                                {cSign}{(it.retailPrice || it.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#F59E0B' }}>
                                {cSign}{(it.wholesaleCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#9BCB44', fontWeight: 700 }}>
                                {cSign}{(it.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(155, 203, 68, 0.15)', color: '#9BCB44', fontWeight: 700 }}>
                                  {(it.marginPercent || 0).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: '#94A3B8' }}>
                              Standard Hostmattic Cloud Service &bull; Invoiced at {cSign}{o.totalAmount}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer Controls */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#CBD5E1', padding: '8px 18px', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Close Dossier
                </button>
                <button
                  onClick={() => {
                    setSelectedAdminInvoice(o);
                    setSelectedTransaction(null);
                  }}
                  style={{ background: '#9BCB44', color: '#090D12', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>View Official GST Tax Invoice 🧾</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

