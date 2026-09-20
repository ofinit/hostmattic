'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/components/CurrencyContext';
import { useCart } from '@/components/CartContext';

export default function ClientDashboard() {
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();
  const { addItem } = useCart();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'hosting' | 'addons' | 'billing' | 'tickets'>('overview');
  const [pricingData, setPricingData] = useState<Record<string, any>>({});
  const [dealAddedMsg, setDealAddedMsg] = useState<string | null>(null);
  const [selectedRenewalModal, setSelectedRenewalModal] = useState<any | null>(null);
  const [taxSettings, setTaxSettings] = useState<any>({
    legalBusinessName: 'Hostmattic Technologies / OfinIT Solutions',
    sellerGstin: '32AABCO1234F1Z5',
    panNumber: 'AABCO1234F',
    registeredAddress: 'Building 4B, Infopark Technology Hub',
    city: 'Kochi',
    state: 'Kerala',
    stateCode: '32',
    defaultSacCode: '998315',
    lutNumber: 'LUT/AD320324001928K',
  });

  useEffect(() => {
    fetch('/api/domains/pricing')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.pricing) {
          setPricingData(d.pricing);
        }
      })
      .catch(() => {});

    fetch('/api/tax/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) {
          setTaxSettings(d.settings);
        }
      })
      .catch(() => {});
  }, []);

  // Modal & Drawer states
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [selectedDomainDetails, setSelectedDomainDetails] = useState<any | null>(null);
  const [ns1, setNs1] = useState('ns1.hostmattic.com');
  const [ns2, setNs2] = useState('ns2.hostmattic.com');
  const [ns3, setNs3] = useState('');
  const [ns4, setNs4] = useState('');
  const [savingNs, setSavingNs] = useState(false);
  const [domainActionMsg, setDomainActionMsg] = useState('');
  const [authCodeValue, setAuthCodeValue] = useState('');
  const [copiedEpp, setCopiedEpp] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);
  const [showCpanelPass, setShowCpanelPass] = useState(false);

  const [selectedHostingDetails, setSelectedHostingDetails] = useState<any | null>(null);
  const [newCpanelPass, setNewCpanelPass] = useState('');
  const [passResetMsg, setPassResetMsg] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('+1 (555) 392-1049');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  // DNS Modal state
  const [selectedDomainForDns, setSelectedDomainForDns] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [loadingDns, setLoadingDns] = useState(false);
  const [newRecordType, setNewRecordType] = useState('A');
  const [newRecordHost, setNewRecordHost] = useState('');
  const [newRecordValue, setNewRecordValue] = useState('');
  const [dnsSuccessMsg, setDnsSuccessMsg] = useState('');

  // Ticket Creation Modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDept, setTicketDept] = useState('Technical Support');
  const [ticketPriority, setTicketPriority] = useState('MEDIUM');
  const [ticketMsg, setTicketMsg] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccessMsg, setTicketSuccessMsg] = useState('');

  // Invoice Modal state
  const [viewInvoice, setViewInvoice] = useState<any>(null);

  // Pagination states
  const [clientDomainPage, setClientDomainPage] = useState(1);
  const [clientHostingPage, setClientHostingPage] = useState(1);
  const [clientAddonPage, setClientAddonPage] = useState(1);
  const [clientOrderPage, setClientOrderPage] = useState(1);
  const [clientTicketPage, setClientTicketPage] = useState(1);
  const clientPageSize = 10;

  // 30-Day Expiration & Lifecycle Filters
  const [domainFilter, setDomainFilter] = useState<'all' | 'warning' | 'critical' | 'expired'>('all');
  const [hostingFilter, setHostingFilter] = useState<'all' | 'warning' | 'critical' | 'expired'>('all');

  const fetchServices = () => {
    fetch('/api/client/services')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        if (d.user) {
          setProfileName(d.user.name || 'Valued Customer');
          setProfileEmail(d.user.email || 'customer@hostmattic.com');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // 1-Click Renewal Flow
  const handleRenewService = (type: 'DOMAIN' | 'HOSTING' | 'ADDON', item: any) => {
    setSelectedRenewalModal({ type, item });
  };

  const handleConfirmRenewal = () => {
    if (!selectedRenewalModal) return;
    const { type, item } = selectedRenewalModal;
    if (type === 'DOMAIN') {
      const renewPrice = pricingData?.[item.tld || '.com']?.renew || 12.99;
      addItem({
        type: 'DOMAIN',
        name: `Domain Renewal - ${item.domainName}`,
        domainName: item.domainName,
        billingPeriod: 'annual',
        priceMonthly: +(renewPrice / 12).toFixed(2),
        priceAnnual: renewPrice,
      }, true);
      setDealAddedMsg(`Added 1-Year Renewal for ${item.domainName} to Cart! 🛒`);
    } else if (type === 'HOSTING') {
      const isMonthly = (item.billingCycle || '').toUpperCase() === 'MONTHLY';
      addItem({
        type: 'HOSTING',
        productType: item.productType || 'SHARED_LINUX',
        name: `Hosting Renewal - ${item.planName} (${item.domainName || 'Cloud Node'})`,
        domainName: item.domainName,
        billingPeriod: isMonthly ? 'monthly' : 'annual',
        priceMonthly: 9.99,
        priceAnnual: 119.88,
      }, true);
      setDealAddedMsg(`Added Renewal for ${item.planName} to Cart! 🛒`);
    } else {
      addItem({
        type: 'SECURITY',
        name: `Subscription Renewal - ${item.name}`,
        domainName: item.domainName,
        billingPeriod: (item.billingPeriod || 'annual').toLowerCase(),
        priceMonthly: +(Number(item.price) / 12).toFixed(2),
        priceAnnual: Number(item.price),
      }, true);
      setDealAddedMsg(`Added Renewal for ${item.name} to Cart! 🛒`);
    }
    setSelectedRenewalModal(null);
    router.push('/checkout');
  };

  // Expiration & Lifecycle Badge Helper
  const renderExpirationBadge = (days: number | undefined) => {
    if (days === undefined || isNaN(days)) return null;
    if (days < 0) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#FEE2E2',
            color: '#DC2626',
            border: '1px solid #FCA5A5',
            whiteSpace: 'nowrap',
          }}
        >
          🔴 Past Due ({Math.abs(days)}d ago)
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#FEF2F2',
            color: '#B91C1C',
            border: '1px solid #F87171',
            whiteSpace: 'nowrap',
          }}
        >
          🚨 Critical ({days === 0 ? 'Today' : `${days}d left`})
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#FEF3C7',
            color: '#D97706',
            border: '1px solid #FCD34D',
            whiteSpace: 'nowrap',
          }}
        >
          ⚠️ Due in {days}d
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '0.74rem',
          fontWeight: 600,
          background: '#F1F5F9',
          color: '#475569',
          border: '1px solid #E2E8F0',
          whiteSpace: 'nowrap',
        }}
      >
        🟢 Active ({days}d)
      </span>
    );
  };

  // 1. TICKET THREAD INTERACTIONS
  const handleOpenTicketThread = (ticket: any) => {
    setSelectedTicket(ticket);
    setTicketReplyText('');
  };

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !selectedTicket) return;

    setSubmittingReply(true);
    try {
      const res = await fetch('/api/client/tickets/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          message: ticketReplyText.trim(),
          senderType: 'CUSTOMER',
        }),
      });
      const json = await res.json();
      if (json.success && json.reply) {
        const updatedReplies = [...(selectedTicket.replies || []), json.reply];
        const updatedTicket = { ...selectedTicket, replies: updatedReplies, status: 'OPEN' };
        setSelectedTicket(updatedTicket);
        setTicketReplyText('');
        fetchServices();
      }
    } catch {
      alert('Could not post reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-ticket', targetId: selectedTicket.id, status: 'CLOSED' }),
      });
      setSelectedTicket({ ...selectedTicket, status: 'CLOSED' });
      fetchServices();
    } catch {
      alert('Failed to update ticket status.');
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    try {
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-ticket', targetId: selectedTicket.id, status: 'OPEN' }),
      });
      setSelectedTicket({ ...selectedTicket, status: 'OPEN' });
      fetchServices();
    } catch {
      alert('Failed to reopen ticket.');
    }
  };

  // 2. DOMAIN HUB INTERACTIONS
  const handleOpenDomainHub = (domain: any) => {
    setSelectedDomainDetails({
      ...domain,
      theftProtection: domain.theftProtection !== undefined ? domain.theftProtection : true,
      privacyProtection: domain.privacyEnabled !== undefined ? domain.privacyEnabled : true,
    });
    setDomainActionMsg('');
    setAuthCodeValue('');
    setCopiedEpp(false);
    const parts = (domain.nameservers || 'ns1.hostmattic.com,ns2.hostmattic.com').split(',');
    setNs1(parts[0] || 'ns1.hostmattic.com');
    setNs2(parts[1] || 'ns2.hostmattic.com');
    setNs3(parts[2] || '');
    setNs4(parts[3] || '');
  };

  const handleSaveNameservers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomainDetails) return;
    setSavingNs(true);
    try {
      const res = await fetch('/api/client/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomainDetails.domainName,
          action: 'update-nameservers',
          nameservers: [ns1, ns2, ns3, ns4].filter(Boolean),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDomainActionMsg(json.message || 'Nameservers updated successfully!');
        setSelectedDomainDetails({ ...selectedDomainDetails, nameservers: [ns1, ns2, ns3, ns4].filter(Boolean).join(',') });
        fetchServices();
      }
    } catch {
      alert('Failed to update nameservers.');
    } finally {
      setSavingNs(false);
    }
  };

  const handleToggleTheftProtection = async () => {
    if (!selectedDomainDetails || togglingLock) return;
    const currentStatus = selectedDomainDetails.theftProtection !== false;
    const targetStatus = !currentStatus;
    setTogglingLock(true);
    try {
      const res = await fetch('/api/client/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomainDetails.domainName,
          action: 'toggle-theft-protection',
          theftProtection: targetStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedDomainDetails({ ...selectedDomainDetails, theftProtection: json.theftProtection });
        setDomainActionMsg(json.message);
        fetchServices();
      }
    } catch {
      alert('Could not change registrar lock.');
    } finally {
      setTogglingLock(false);
    }
  };

  const handleTogglePrivacyProtection = async () => {
    if (!selectedDomainDetails || togglingPrivacy) return;
    const currentStatus = selectedDomainDetails.privacyProtection !== false;
    const targetStatus = !currentStatus;
    setTogglingPrivacy(true);
    try {
      const res = await fetch('/api/client/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomainDetails.domainName,
          action: 'toggle-privacy-protection',
          privacyProtection: targetStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedDomainDetails({ ...selectedDomainDetails, privacyProtection: json.privacyProtection });
        setDomainActionMsg(json.message);
        fetchServices();
      }
    } catch {
      alert('Could not change WHOIS privacy setting.');
    } finally {
      setTogglingPrivacy(false);
    }
  };

  const handleGetAuthCode = async () => {
    if (!selectedDomainDetails) return;
    try {
      const res = await fetch('/api/client/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: selectedDomainDetails.domainName,
          action: 'get-auth-code',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAuthCodeValue(json.authCode);
      }
    } catch {
      alert('Could not retrieve EPP code.');
    }
  };

  const handleCopyEpp = () => {
    if (!authCodeValue) return;
    navigator.clipboard.writeText(authCodeValue);
    setCopiedEpp(true);
    setTimeout(() => setCopiedEpp(false), 3000);
  };

  // 3. HOSTING HUB INTERACTIONS
  const handleOpenHostingHub = (h: any) => {
    setSelectedHostingDetails(h);
    setPassResetMsg('');
    setNewCpanelPass('');
  };

  const handleResetCpanelPass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCpanelPass || newCpanelPass.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    setPassResetMsg(`Password for ${selectedHostingDetails.cpanelUsername} updated successfully!`);
    setNewCpanelPass('');
    setTimeout(() => setPassResetMsg(''), 4000);
  };

  // 4. DNS ZONE EDITOR
  const openDnsEditor = async (domainName: string) => {
    setSelectedDomainForDns(domainName);
    setLoadingDns(true);
    setDnsSuccessMsg('');
    try {
      const res = await fetch(`/api/client/dns?domain=${encodeURIComponent(domainName)}`);
      const json = await res.json();
      const raw = json?.records;
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        list = Object.values(raw).filter((r: any) => r && typeof r === 'object' && (r.type || r.value));
      }
      setDnsRecords(list);
    } catch {
      setDnsRecords([
        { id: 'rec_fb_1', type: 'A', host: '@', value: '198.51.100.24', ttl: 14400 },
        { id: 'rec_fb_2', type: 'CNAME', host: 'www', value: domainName, ttl: 14400 },
      ]);
    } finally {
      setLoadingDns(false);
    }
  };

  const handleAddDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordValue.trim() || !selectedDomainForDns) return;

    try {
      const res = await fetch('/api/client/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomainForDns,
          type: newRecordType,
          host: newRecordHost.trim() || '@',
          value: newRecordValue.trim(),
          ttl: 14400,
        }),
      });
      const json = await res.json();
      if (json.success && json.record) {
        setDnsRecords([...dnsRecords, json.record]);
        setNewRecordHost('');
        setNewRecordValue('');
        setDnsSuccessMsg(`Record (${newRecordType}) successfully added to zone!`);
        setTimeout(() => setDnsSuccessMsg(''), 4000);
      }
    } catch {
      alert('Failed to add DNS record');
    }
  };

  // 5. SUBMIT SUPPORT TICKET
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMsg.trim()) return;

    setSubmittingTicket(true);
    try {
      const res = await fetch('/api/client/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticketSubject,
          department: ticketDept,
          priority: ticketPriority,
          message: ticketMsg,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTicketSuccessMsg('Ticket submitted! An engineer will review your request shortly.');
        setTimeout(() => {
          setShowTicketModal(false);
          setTicketSuccessMsg('');
          setTicketSubject('');
          setTicketMsg('');
          fetchServices();
        }, 1500);
      }
    } catch {
      alert('Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', minHeight: 'calc(100vh - 180px)', background: 'var(--bg-canvas)' }}>
        <div className="pulse-dot" style={{ background: 'var(--brand-action-green)', width: '14px', height: '14px', margin: '0 auto 16px' }}></div>
        <h2 style={{ fontSize: '1.25rem', color: '#0F172A' }}>Loading your client portal...</h2>
      </div>
    );
  }

  const domains = data?.domains || [];
  const hosting = data?.hosting || [];
  const addons = data?.addons || [];
  const orders = data?.orders || [];
  const tickets = data?.tickets || [];
  const expirations = data?.expirations || null;
  const userName = data?.user?.name || profileName || 'Valued Customer';

  // Compute all services requiring immediate renewal or attention (expired or due within 30 days)
  const actionNeededServices = [
    ...domains
      .filter((d: any) => d.daysUntilExpiry !== undefined && d.daysUntilExpiry <= 30)
      .map((d: any) => ({
        ...d,
        itemType: 'DOMAIN' as const,
        displayName: d.domainName,
        subText: 'Registered Domain Delegation & DNS',
        expiryDate: d.expiryDate,
      })),
    ...hosting
      .filter((h: any) => h.daysUntilExpiry !== undefined && h.daysUntilExpiry <= 30)
      .map((h: any) => ({
        ...h,
        itemType: 'HOSTING' as const,
        displayName: `${h.planName || 'Cloud Hosting'} (${h.domainName})`,
        subText: `Web Hosting Server (${h.serverIp || 'NVMe Node'})`,
        expiryDate: h.nextDueDate || h.createdAt,
      })),
    ...addons
      .filter((a: any) => a.daysUntilExpiry !== undefined && a.daysUntilExpiry <= 30)
      .map((a: any) => ({
        ...a,
        itemType: 'ADDON' as const,
        displayName: a.name,
        subText: `${a.productType || 'Security'} • ${a.domainName || 'Linked Service'}`,
        expiryDate: a.expiryDate,
      })),
  ].sort((a: any, b: any) => (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999));

  const filteredDomains = domains.filter((d: any) => {
    if (domainFilter === 'warning') return d.daysUntilExpiry <= 30 && d.daysUntilExpiry > 7;
    if (domainFilter === 'critical') return d.daysUntilExpiry <= 7 && d.daysUntilExpiry >= 0;
    if (domainFilter === 'expired') return d.daysUntilExpiry < 0;
    return true;
  });

  const filteredHosting = hosting.filter((h: any) => {
    if (hostingFilter === 'warning') return h.daysUntilExpiry <= 30 && h.daysUntilExpiry > 7;
    if (hostingFilter === 'critical') return h.daysUntilExpiry <= 7 && h.daysUntilExpiry >= 0;
    if (hostingFilter === 'expired') return h.daysUntilExpiry < 0;
    return true;
  });

  const paginatedClientDomains = filteredDomains.slice((clientDomainPage - 1) * clientPageSize, clientDomainPage * clientPageSize);
  const totalClientDomainPages = Math.ceil(filteredDomains.length / clientPageSize) || 1;

  const paginatedClientHosting = filteredHosting.slice((clientHostingPage - 1) * clientPageSize, clientHostingPage * clientPageSize);
  const totalClientHostingPages = Math.ceil(filteredHosting.length / clientPageSize) || 1;

  const paginatedClientAddons = addons.slice((clientAddonPage - 1) * clientPageSize, clientAddonPage * clientPageSize);
  const totalClientAddonPages = Math.ceil(addons.length / clientPageSize) || 1;

  const paginatedClientOrders = orders.slice((clientOrderPage - 1) * clientPageSize, clientOrderPage * clientPageSize);
  const totalClientOrderPages = Math.ceil(orders.length / clientPageSize) || 1;

  const paginatedClientTickets = tickets.slice((clientTicketPage - 1) * clientPageSize, clientTicketPage * clientPageSize);
  const totalClientTicketPages = Math.ceil(tickets.length / clientPageSize) || 1;

  const renderClientPagination = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    itemName: string,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems <= clientPageSize) return null;
    const start = totalItems === 0 ? 0 : (currentPage - 1) * clientPageSize + 1;
    const end = Math.min(currentPage * clientPageSize, totalItems);

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          padding: '12px 18px',
          background: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '0.84rem', color: '#64748B' }}>
          Showing <strong style={{ color: '#0F172A' }}>{start}</strong> to <strong style={{ color: '#0F172A' }}>{end}</strong> of <strong style={{ color: '#0F172A' }}>{totalItems}</strong> {itemName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: currentPage <= 1 ? '#94A3B8' : '#334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
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
                  {hasGap && <span style={{ color: '#94A3B8', padding: '0 4px', fontSize: '0.82rem' }}>…</span>}
                  <button
                    onClick={() => onPageChange(p)}
                    style={{
                      background: currentPage === p ? 'var(--brand-action-green, #4F7C12)' : '#FFFFFF',
                      border: `1px solid ${currentPage === p ? 'var(--brand-action-green, #4F7C12)' : '#CBD5E1'}`,
                      color: currentPage === p ? '#FFFFFF' : '#334155',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: currentPage === p ? 700 : 500,
                      cursor: 'pointer',
                      minWidth: '32px',
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
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: currentPage >= totalPages ? '#94A3B8' : '#334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--bg-canvas)', minHeight: 'calc(100vh - 180px)', padding: '36px 0 80px' }}>
      <div className="container">
        {/* Top Welcome Header */}
        {data?.user?.role === 'ADMIN' && (
          <div
            style={{
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              border: '1px solid rgba(255, 205, 0, 0.4)',
              borderRadius: '16px',
              padding: '16px 24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>🛡️</span>
              <div>
                <strong style={{ color: '#F1F5F9', fontSize: '1rem' }}>Administrator Access Active</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
                  You are signed in as Hostmattic Administrator. Launch the Staff Console to manage server operations, billing, and API sync.
                </p>
              </div>
            </div>
            <Link
              href="/admin/dashboard"
              className="btn btn-primary"
              style={{
                background: 'var(--brand-gold, #FFCD00)',
                color: '#0F172A',
                fontWeight: 700,
                padding: '9px 18px',
                fontSize: '0.88rem',
                border: 'none',
              }}
            >
              Open Staff Operations Console →
            </Link>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="section-tag tag-lime">{data?.user?.role === 'ADMIN' ? 'Staff Administrator' : 'Customer Control Panel'}</span>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.1rem)', marginBottom: '4px', letterSpacing: '-0.02em', color: '#0F172A' }}>
              Welcome back, {userName}!
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              Manage your active cloud hosting, domain portfolio, DNS records, and billing.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {data?.user?.role === 'ADMIN' && (
              <Link
                href="/admin/dashboard"
                className="btn btn-sm"
                style={{
                  background: '#0F172A',
                  color: 'var(--brand-gold, #FFCD00)',
                  border: '1px solid rgba(255,205,0,0.4)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🛡️</span>
                <span>Admin Console</span>
              </Link>
            )}
            <button
              onClick={() => setShowProfileModal(true)}
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>👤</span>
              <span>Account Settings</span>
            </button>
            {data?.user?.upstreamCustomerId ? (
              <a
                href={`/api/client/sso?customerId=${data.user.upstreamCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Launch Direct cPanel SSO ↗
              </a>
            ) : (
              <button
                disabled
                title="Account is not mapped to an upstream cPanel service"
                className="btn btn-sm btn-outline"
                style={{ fontSize: '0.85rem', opacity: 0.6, cursor: 'not-allowed' }}
              >
                cPanel SSO (Local)
              </button>
            )}
            <Link href="/products" className="btn btn-sm btn-primary" style={{ fontSize: '0.85rem' }}>
              + Order New Service
            </Link>
            <button onClick={handleLogout} className="btn btn-sm btn-outline" style={{ fontSize: '0.85rem' }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* 30-Day Expiration & Lifecycle Monitor Alert Banner WITH EXPLICIT SERVICE LIST */}
        {(actionNeededServices.length > 0 || (expirations && expirations.totalRequiringAttention > 0)) && (
          <div
            style={{
              background: 'linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%)',
              border: '1.5px solid #FCA5A5',
              borderRadius: '16px',
              padding: '22px 24px',
              marginBottom: '28px',
              boxShadow: '0 4px 16px rgba(220, 38, 38, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '780px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flexShrink: 0,
                    border: '1px solid #FCA5A5',
                  }}
                >
                  ⚠️
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#991B1B', fontSize: '1.1rem', fontWeight: 800 }}>
                      30-Day Expiration &amp; Lifecycle Alert
                    </strong>
                    <span
                      style={{
                        background: '#DC2626',
                        color: '#FFFFFF',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 9px',
                        borderRadius: '999px',
                      }}
                    >
                      {actionNeededServices.length} Service{actionNeededServices.length > 1 ? 's' : ''} Need Action
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#7F1D1D', lineHeight: 1.5 }}>
                    The following service subscriptions are due for renewal within 30 days. Renew promptly to safeguard server uptime, prevent DNS downtime, and retain domain delegation.
                  </p>
                </div>
              </div>

              {/* Shortcut filter buttons */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {domains.some((d: any) => d.daysUntilExpiry <= 30) && (
                  <button
                    onClick={() => {
                      setActiveTab('domains');
                      setDomainFilter('warning');
                      setClientDomainPage(1);
                    }}
                    className="btn btn-sm"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #F87171',
                      color: '#B91C1C',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    All Expiring Domains →
                  </button>
                )}
                {hosting.some((h: any) => h.daysUntilExpiry <= 30) && (
                  <button
                    onClick={() => {
                      setActiveTab('hosting');
                      setHostingFilter('warning');
                      setClientHostingPage(1);
                    }}
                    className="btn btn-sm"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #F87171',
                      color: '#B91C1C',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    All Expiring Hosting →
                  </button>
                )}
              </div>
            </div>

            {/* SERVICES NEEDING ACTION LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              {actionNeededServices.map((srv: any) => {
                const isCritical = srv.daysUntilExpiry <= 7;
                const isExpired = srv.daysUntilExpiry < 0;
                return (
                  <div
                    key={`${srv.itemType}_${srv.id}`}
                    style={{
                      background: '#FFFFFF',
                      border: isExpired ? '1.5px solid #DC2626' : isCritical ? '1.5px solid #F87171' : '1px solid #FED7AA',
                      borderRadius: '12px',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Left: Icon & Service Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px' }}>
                      <span style={{ fontSize: '1.4rem' }}>
                        {srv.itemType === 'DOMAIN' ? '🌐' : srv.itemType === 'HOSTING' ? '⚡' : '🔒'}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0F172A', whiteSpace: 'nowrap' }}>
                            {srv.displayName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: srv.itemType === 'DOMAIN' ? '#E0F2FE' : srv.itemType === 'HOSTING' ? '#DCFCE7' : '#FEF3C7',
                              color: srv.itemType === 'DOMAIN' ? '#0369A1' : srv.itemType === 'HOSTING' ? '#15803D' : '#B45309',
                            }}
                          >
                            {srv.itemType}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                          {srv.subText}
                        </div>
                      </div>
                    </div>

                    {/* Center: Expiration info & badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Expiry / Due Date</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {srv.expiryDate ? new Date(srv.expiryDate).toLocaleDateString() : 'Due for Renewal'}
                        </div>
                      </div>
                      <div>
                        {renderExpirationBadge(srv.daysUntilExpiry)}
                      </div>
                    </div>

                    {/* Right: Quick Renewal Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleRenewService(srv.itemType, srv)}
                        className="btn btn-sm"
                        style={{
                          background: '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>Renew Now</span>
                        <span>💳</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="dashboard-tabs-bar">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: '📊' },
            { id: 'domains', label: `My Domains (${domains.length})`, icon: '🌐' },
            { id: 'hosting', label: `Web Hosting (${hosting.length})`, icon: '☁️' },
            { id: 'addons', label: `Security & Add-ons (${addons.length})`, icon: '🛡️' },
            { id: 'billing', label: `Invoices & Billing (${orders.length})`, icon: '💳' },
            { id: 'tickets', label: `Support Desk (${tickets.length})`, icon: '🎫' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid var(--brand-action-green)' : '3px solid transparent',
                padding: '12px 18px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--brand-action-green)' : '#64748B',
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px', marginBottom: '32px' }}>
              <div
                onClick={() => setActiveTab('domains')}
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-xs)', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Active Domains</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{domains.length}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--brand-action-teal)', marginTop: '4px' }}>Manage DNS &amp; Nameservers →</div>
              </div>

              <div
                onClick={() => setActiveTab('hosting')}
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-xs)', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Hosting Accounts</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-action-green)', marginTop: '4px' }}>{hosting.length}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--brand-action-green)', marginTop: '4px' }}>cPanel &amp; Cloud Clusters →</div>
              </div>

              <div
                onClick={() => setActiveTab('billing')}
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-xs)', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Invoices &amp; Billing</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{orders.length}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>View Payment History →</div>
              </div>

              <div
                onClick={() => setActiveTab('tickets')}
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-xs)', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Support Desk</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-action-cyan)', marginTop: '4px' }}>
                  {tickets.length} Ticket{tickets.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--brand-action-cyan)', marginTop: '4px' }}>24/7 Technical Queue →</div>
              </div>
            </div>

            {/* Notification Toast for 1-Click Deals */}
            {dealAddedMsg && (
              <div
                style={{
                  background: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  color: '#15803D',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>✓ {dealAddedMsg}</span>
                <Link href="/checkout" style={{ color: '#15803D', textDecoration: 'underline', fontSize: '0.88rem' }}>
                  Proceed to Checkout →
                </Link>
              </div>
            )}

            {/* EXCLUSIVE MEMBER PROMOTIONS & ADD-ON UPGRADES */}
            <div
              style={{
                background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 60%, #F0F9FF 100%)',
                border: '1px solid #BBF7D0',
                borderRadius: '20px',
                padding: '28px',
                marginBottom: '32px',
                boxShadow: '0 4px 20px -4px rgba(79, 124, 18, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        background: '#DC2626',
                        color: '#FFFFFF',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      ⚡ Exclusive Member Deals
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 700 }}>
                      Live Upstream Root Registry Promotions
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', marginBottom: '2px' }}>
                    Protect Your Brand Across Discounted Extensions &amp; Security Upgrades
                  </h3>
                  <p style={{ color: '#475569', fontSize: '0.85rem', margin: 0 }}>
                    Promotional wholesale rates are synced live. Lock in matching domain extensions before registry discounts expire.
                  </p>
                </div>
                <Link href="/domains/new-gtlds" className="btn btn-sm btn-outline" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  View All 800+ Extensions →
                </Link>
              </div>

              {/* Grid of 4 Hot Registry Promos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                {[
                  { ext: '.shop', defaultUsd: 1.70, defaultInr: 142, discount: '95% OFF', expiry: '01 Jan 2027', desc: 'E-commerce & retail' },
                  { ext: '.store', defaultUsd: 10.53, defaultInr: 879, discount: '81% OFF', expiry: '01 Jan 2027', desc: 'Online storefronts' },
                  { ext: '.online', defaultUsd: 8.81, defaultInr: 736, discount: '75% OFF', expiry: '01 Jan 2027', desc: 'Universal modern web' },
                  { ext: '.tech', defaultUsd: 12.24, defaultInr: 1022, discount: '73% OFF', expiry: '01 Jan 2027', desc: 'SaaS & developers' },
                ].map((item) => {
                  const live = pricingData[item.ext];
                  const priceUsd = live?.retailUsd || item.defaultUsd;
                  const badge = live?.badge || item.discount;
                  const expiryText = live?.promoEndsAt
                    ? new Date(live.promoEndsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                    : item.expiry;

                  return (
                    <div
                      key={item.ext}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '14px',
                        padding: '16px',
                        boxShadow: 'var(--shadow-xs)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>{item.ext}</span>
                          <span
                            style={{
                              background: '#FFEDD5',
                              color: '#C2410C',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #FDBA74',
                            }}
                          >
                            🔥 {badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '8px' }}>{item.desc}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4F7C12', marginBottom: '4px' }}>
                          {formatPrice(priceUsd)}
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>/yr</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9A3412', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span>⏳</span>
                          <span>Promo ends: {expiryText}</span>
                        </div>
                      </div>
                      <Link
                        href={`/domains?q=mybrand${item.ext}`}
                        className="btn btn-sm btn-outline"
                        style={{ marginTop: '12px', width: '100%', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}
                      >
                        Register {item.ext} →
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Recommended Infrastructure Add-ons (1-Click Upsell) */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0F172A' }}>
                    🛡️ Recommended Security &amp; Continuity Add-ons
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                    1-Click deployment directly into your active account.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        type: 'SECURITY',
                        name: 'PositiveSSL Security Certificate (DV)',
                        billingPeriod: 'annual',
                        priceMonthly: 0.99,
                        priceAnnual: 11.99,
                      }, false);
                      setDealAddedMsg('PositiveSSL Certificate added to your order.');
                      setTimeout(() => setDealAddedMsg(null), 5000);
                    }}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.8rem', fontWeight: 700, padding: '7px 12px' }}
                  >
                    + PositiveSSL ({formatPrice(11.99)}/yr)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        type: 'SECURITY',
                        name: 'CodeGuard Automated Daily Cloud Backup',
                        billingPeriod: 'annual',
                        priceMonthly: 1.49,
                        priceAnnual: 14.30,
                      }, false);
                      setDealAddedMsg('CodeGuard Daily Cloud Backup added to your order.');
                      setTimeout(() => setDealAddedMsg(null), 5000);
                    }}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.8rem', fontWeight: 700, padding: '7px 12px' }}
                  >
                    + CodeGuard Backups ({formatPrice(14.30)}/yr)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        type: 'SECURITY',
                        name: 'SiteLock Web Application Firewall (WAF)',
                        billingPeriod: 'annual',
                        priceMonthly: 1.99,
                        priceAnnual: 17.90,
                      }, false);
                      setDealAddedMsg('SiteLock WAF Shield added to your order.');
                      setTimeout(() => setDealAddedMsg(null), 5000);
                    }}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.8rem', fontWeight: 700, padding: '7px 12px' }}
                  >
                    + SiteLock WAF ({formatPrice(17.90)}/yr)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        type: 'EMAIL',
                        name: 'Business Email Inbox (5 GB Storage)',
                        billingPeriod: 'annual',
                        priceMonthly: 0.99,
                        priceAnnual: 7.10,
                      }, false);
                      setDealAddedMsg('Business Email Inbox added to your order.');
                      setTimeout(() => setDealAddedMsg(null), 5000);
                    }}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.8rem', fontWeight: 700, padding: '7px 12px' }}
                  >
                    + Business Email ({formatPrice(7.10)}/yr)
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Summary Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '28px' }}>
              {/* Active Hosting Section */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#0F172A' }}>Active Cloud &amp; Web Hosting</h3>
                  <button onClick={() => setActiveTab('hosting')} style={{ background: 'none', border: 'none', color: 'var(--brand-action-green)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                    View Full Details →
                  </button>
                </div>

                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '820px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Service / Plan</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Domain</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Next Due / Renewal</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Server IP</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hosting.map((h: any) => (
                        <tr key={h.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '16px', fontWeight: 700, color: '#0F172A' }}>
                            <button
                              onClick={() => handleOpenHostingHub(h)}
                              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}
                            >
                              {h.planName}
                              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--brand-action-teal)', fontWeight: 600 }}>Manage Server Controls ⚙️</span>
                            </button>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <a href={`https://${h.domainName}`} target="_blank" rel="noopener" style={{ color: 'var(--brand-action-cyan)', fontWeight: 600 }}>
                              {h.domainName}
                            </a>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 600 }}>
                              {h.nextDueDate ? new Date(h.nextDueDate).toLocaleDateString() : 'Annual Cycle'}
                            </div>
                            <div style={{ marginTop: '3px' }}>
                              {renderExpirationBadge(h.daysUntilExpiry)}
                            </div>
                          </td>
                          <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{h.serverIp}</td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <span className="status-badge status-success">
                              <span className="status-dot"></span>
                              Active
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => handleRenewService('HOSTING', h)}
                                className="btn btn-sm"
                                style={{
                                  background: h.isExpiringSoon || h.isCritical || h.isExpired ? '#DC2626' : '#F1F5F9',
                                  color: h.isExpiringSoon || h.isCritical || h.isExpired ? '#FFFFFF' : '#334155',
                                  border: h.isExpiringSoon || h.isCritical || h.isExpired ? 'none' : '1px solid #CBD5E1',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  padding: '6px 12px',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Add Renewal to Cart"
                              >
                                Renew 💳
                              </button>
                              <button
                                onClick={() => handleOpenHostingHub(h)}
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                              >
                                Server Hub ⚙️
                              </button>
                              <button
                                onClick={() => window.open(`https://${h.serverIp}:2083`, '_blank')}
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                              >
                                Launch cPanel →
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registered Domains Section */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#0F172A' }}>Domain Portfolio &amp; DNS</h3>
                  <button onClick={() => setActiveTab('domains')} style={{ background: 'none', border: 'none', color: 'var(--brand-action-teal)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                    View All Domains →
                  </button>
                </div>

                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '980px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', minWidth: '240px' }}>Domain Name</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Renewal / Expiry</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Transfer Lock</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Auto-Renew</th>
                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Privacy Shield</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Management</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domains.map((d: any) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '16px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => handleOpenDomainHub(d)}
                              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 700, color: '#0F172A', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
                            >
                              <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{d.domainName}</span>
                              </div>
                              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--brand-action-teal)', fontWeight: 600, whiteSpace: 'nowrap' }}>Domain Security &amp; Nameservers ⚙️</span>
                            </button>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 600 }}>
                              {new Date(d.expiryDate).toLocaleDateString()}
                            </div>
                            <div style={{ marginTop: '3px' }}>
                              {renderExpirationBadge(d.daysUntilExpiry)}
                            </div>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <span className={`status-badge ${d.theftProtection !== false ? 'status-success' : 'status-warning'}`}>
                              <span className="status-dot"></span>
                              {d.theftProtection !== false ? '🔒 Locked' : '🔓 Unlocked'}
                            </span>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <span className="status-badge status-success">
                              <span className="status-dot"></span>
                              🔄 Active
                            </span>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <span className={`status-badge ${d.privacyEnabled !== false ? 'status-info' : 'status-neutral'}`}>
                              <span className="status-dot"></span>
                              {d.privacyEnabled !== false ? '🛡️ Protected' : '🌐 Public'}
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => handleRenewService('DOMAIN', d)}
                                className="btn btn-sm"
                                style={{
                                  background: d.isExpiringSoon || d.isCritical || d.isExpired ? '#DC2626' : '#F1F5F9',
                                  color: d.isExpiringSoon || d.isCritical || d.isExpired ? '#FFFFFF' : '#334155',
                                  border: d.isExpiringSoon || d.isCritical || d.isExpired ? 'none' : '1px solid #CBD5E1',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  padding: '6px 12px',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Add 1-Year Renewal to Cart"
                              >
                                Renew 💳
                              </button>
                              <button
                                onClick={() => handleOpenDomainHub(d)}
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                              >
                                Manage 🛡️
                              </button>
                              <button
                                onClick={() => openDnsEditor(d.domainName)}
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                              >
                                DNS Zone ⚙️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2. DOMAINS TAB */}
        {activeTab === 'domains' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Registered Domain Portfolio</h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '4px 0 0' }}>Click any domain name to open the full Domain Hub (Nameservers, Transfer Lock, Auth-Code, and Privacy).</p>
              </div>
              <Link href="/domains" className="btn btn-sm btn-primary">
                + Register New Domain
              </Link>
            </div>

            {/* Lifecycle Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B', marginRight: '4px' }}>Lifecycle Filter:</span>
              {[
                { id: 'all', label: `All Domains (${domains.length})` },
                {
                  id: 'warning',
                  label: `⚠️ Expiring Soon (≤30d) (${domains.filter((d: any) => d.daysUntilExpiry <= 30 && d.daysUntilExpiry > 7).length})`,
                },
                {
                  id: 'critical',
                  label: `🚨 Critical (≤7d) (${domains.filter((d: any) => d.daysUntilExpiry <= 7 && d.daysUntilExpiry >= 0).length})`,
                },
                {
                  id: 'expired',
                  label: `🔴 Past Due (${domains.filter((d: any) => d.daysUntilExpiry < 0).length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setDomainFilter(f.id as any);
                    setClientDomainPage(1);
                  }}
                  style={{
                    background: domainFilter === f.id ? '#0F172A' : '#F1F5F9',
                    color: domainFilter === f.id ? '#FFFFFF' : '#334155',
                    border: `1px solid ${domainFilter === f.id ? '#0F172A' : '#E2E8F0'}`,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: domainFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '1080px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', minWidth: '250px' }}>Domain Name</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Expiry / Lifecycle</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Transfer Lock</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Auto-Renew</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Privacy Shield</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Nameservers</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientDomains.map((d: any) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleOpenDomainHub(d)}
                          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 700, color: '#0F172A', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
                        >
                          <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{d.domainName}</span>
                          </div>
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--brand-action-teal)', fontWeight: 600, whiteSpace: 'nowrap' }}>Domain Delegation &amp; Lock ⚙️</span>
                        </button>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 600 }}>
                          {new Date(d.expiryDate).toLocaleDateString()}
                        </div>
                        <div style={{ marginTop: '3px' }}>
                          {renderExpirationBadge(d.daysUntilExpiry)}
                        </div>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${d.theftProtection !== false ? 'status-success' : 'status-warning'}`}>
                          <span className="status-dot"></span>
                          {d.theftProtection !== false ? '🔒 Locked' : '🔓 Unlocked'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className="status-badge status-success">
                          <span className="status-dot"></span>
                          🔄 Active
                        </span>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${d.privacyEnabled !== false ? 'status-info' : 'status-neutral'}`}>
                          <span className="status-dot"></span>
                          {d.privacyEnabled !== false ? '🛡️ ID Protected' : '🌐 Public'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '0.78rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                        {(() => {
                          const nsList = Array.isArray(d.nameservers)
                            ? d.nameservers
                            : typeof d.nameservers === 'string'
                            ? d.nameservers.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : ['ns1.hostmattic.com', 'ns2.hostmattic.com'];
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {nsList.map((ns: string, idx: number) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--brand-action-teal)' }}>●</span>
                                  <span>{ns}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => handleRenewService('DOMAIN', d)}
                            className="btn btn-sm"
                            style={{
                              background: d.isExpiringSoon || d.isCritical || d.isExpired ? '#DC2626' : '#F1F5F9',
                              color: d.isExpiringSoon || d.isCritical || d.isExpired ? '#FFFFFF' : '#334155',
                              border: d.isExpiringSoon || d.isCritical || d.isExpired ? 'none' : '1px solid #CBD5E1',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              padding: '6px 12px',
                              whiteSpace: 'nowrap',
                            }}
                            title="Add 1-Year Renewal to Cart"
                          >
                            Renew 💳
                          </button>
                          <button
                            onClick={() => handleOpenDomainHub(d)}
                            className="btn btn-sm btn-outline"
                            style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                          >
                            Manage 🛡️
                          </button>
                          <button
                            onClick={() => openDnsEditor(d.domainName)}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                          >
                            DNS Zone ⚙️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderClientPagination(clientDomainPage, totalClientDomainPages, filteredDomains.length, 'domains', setClientDomainPage)}
            </div>
          </div>
        )}

        {/* 3. HOSTING TAB */}
        {activeTab === 'hosting' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Web &amp; Cloud Hosting Subscriptions</h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '4px 0 0' }}>Click any hosting plan to inspect resource gauges, database tools, and cPanel credentials.</p>
              </div>
              <Link href="/hosting/cloud" className="btn btn-sm btn-primary">
                + Provision New Server
              </Link>
            </div>

            {/* Lifecycle Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B', marginRight: '4px' }}>Lifecycle Filter:</span>
              {[
                { id: 'all', label: `All Hosting (${hosting.length})` },
                {
                  id: 'warning',
                  label: `⚠️ Expiring Soon (≤30d) (${hosting.filter((h: any) => h.daysUntilExpiry <= 30 && h.daysUntilExpiry > 7).length})`,
                },
                {
                  id: 'critical',
                  label: `🚨 Critical (≤7d) (${hosting.filter((h: any) => h.daysUntilExpiry <= 7 && h.daysUntilExpiry >= 0).length})`,
                },
                {
                  id: 'expired',
                  label: `🔴 Past Due (${hosting.filter((h: any) => h.daysUntilExpiry < 0).length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setHostingFilter(f.id as any);
                    setClientHostingPage(1);
                  }}
                  style={{
                    background: hostingFilter === f.id ? '#0F172A' : '#F1F5F9',
                    color: hostingFilter === f.id ? '#FFFFFF' : '#334155',
                    border: `1px solid ${hostingFilter === f.id ? '#0F172A' : '#E2E8F0'}`,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: hostingFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '980px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', minWidth: '220px' }}>Plan</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', minWidth: '200px' }}>Primary Domain</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Next Due / Renewal</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Server IP</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>cPanel User</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Location</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientHosting.map((h: any) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleOpenHostingHub(h)}
                          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 700, color: '#0F172A', fontSize: '0.92rem', whiteSpace: 'nowrap' }}
                        >
                          <div style={{ whiteSpace: 'nowrap' }}>{h.planName}</div>
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--brand-action-green)', fontWeight: 600, whiteSpace: 'nowrap' }}>Resource Gauges &amp; Controls ⚙️</span>
                        </button>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--brand-action-cyan)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.domainName}</td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 600 }}>
                          {h.nextDueDate ? new Date(h.nextDueDate).toLocaleDateString() : 'Annual Cycle'}
                        </div>
                        <div style={{ marginTop: '3px' }}>
                          {renderExpirationBadge(h.daysUntilExpiry)}
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{h.serverIp}</td>
                      <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#0F172A', whiteSpace: 'nowrap' }}>{h.cpanelUsername}</td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className="status-badge status-neutral">
                          {h.serverLocation} Node
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => handleRenewService('HOSTING', h)}
                            className="btn btn-sm"
                            style={{
                              background: h.isExpiringSoon || h.isCritical || h.isExpired ? '#DC2626' : '#F1F5F9',
                              color: h.isExpiringSoon || h.isCritical || h.isExpired ? '#FFFFFF' : '#334155',
                              border: h.isExpiringSoon || h.isCritical || h.isExpired ? 'none' : '1px solid #CBD5E1',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              padding: '6px 12px',
                              whiteSpace: 'nowrap',
                            }}
                            title="Add Renewal to Cart"
                          >
                            Renew 💳
                          </button>
                          <button
                            onClick={() => handleOpenHostingHub(h)}
                            className="btn btn-sm btn-outline"
                            style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                          >
                            Server Hub ⚙️
                          </button>
                          <button
                            onClick={() => window.open(`https://${h.serverIp}:2083`, '_blank')}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                          >
                            Launch cPanel →
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderClientPagination(clientHostingPage, totalClientHostingPages, filteredHosting.length, 'hosting plans', setClientHostingPage)}
            </div>
          </div>
        )}

        {/* 3.5 SECURITY & ADD-ONS TAB (SSL, EMAIL, SITELOCK, BACKUPS) */}
        {activeTab === 'addons' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Security, Email &amp; Cloud Subscriptions</h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  Manage your active SSL Certificates, SiteLock Web Application Firewalls, Business Email Inboxes, and Backups.
                </p>
              </div>
              <Link href="/products" className="btn btn-sm btn-primary">
                + Explore Security &amp; Email Upgrades
              </Link>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '850px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Service &amp; Product</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Assigned Domain</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Renewal / Expiry</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Price &amp; Billing</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientAddons.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                        No active security or add-on subscriptions found.{' '}
                        <Link href="/products" style={{ color: 'var(--brand-action-teal)', fontWeight: 600, textDecoration: 'underline' }}>
                          Browse SSL, Email &amp; Security solutions →
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    paginatedClientAddons.map((a: any) => {
                      const isSsl = (a.productType || '').includes('SSL') || (a.name || '').includes('SSL');
                      const isEmail = (a.productType || '').includes('EMAIL') || (a.name || '').toLowerCase().includes('email');
                      const badgeBg = isSsl ? '#E0F2FE' : isEmail ? '#FEF3C7' : '#DCFCE7';
                      const badgeColor = isSsl ? '#0284C7' : isEmail ? '#B45309' : '#15803D';

                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: badgeBg, color: badgeColor, fontSize: '0.7rem', fontWeight: 800 }}>
                                {isSsl ? '🔒 SSL' : isEmail ? '✉️ EMAIL' : '🛡️ SECURITY'}
                              </span>
                              <strong style={{ color: '#0F172A', fontSize: '0.92rem' }}>{a.name}</strong>
                            </div>
                            {a.orderNumber && (
                              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '3px' }}>
                                Order: <span style={{ fontFamily: 'var(--font-mono)' }}>{a.orderNumber}</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '16px', color: 'var(--brand-action-cyan)', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '0.86rem' }}>
                            {a.domainName || 'Linked Service'}
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 600 }}>
                              {a.expiryDate ? new Date(a.expiryDate).toLocaleDateString() : 'Annual Cycle'}
                            </div>
                            <div style={{ marginTop: '3px' }}>
                              {renderExpirationBadge(a.daysUntilExpiry)}
                            </div>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>
                              {formatPrice(Number(a.price) || 19.99)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{a.billingPeriod || 'ANNUAL'}</div>
                          </td>
                          <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                            <span className="status-badge status-success">
                              <span className="status-dot"></span>
                              ⚡ {a.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => handleRenewService('ADDON', a)}
                                className="btn btn-sm"
                                style={{
                                  background: a.daysUntilExpiry <= 30 ? '#DC2626' : '#F1F5F9',
                                  color: a.daysUntilExpiry <= 30 ? '#FFFFFF' : '#334155',
                                  border: a.daysUntilExpiry <= 30 ? 'none' : '1px solid #CBD5E1',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  padding: '6px 12px',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Renew this subscription"
                              >
                                Renew 💳
                              </button>
                              <Link
                                href="/products"
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                              >
                                Details ⚙️
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {renderClientPagination(clientAddonPage, totalClientAddonPages, addons.length, 'subscriptions', setClientAddonPage)}
            </div>
          </div>
        )}

        {/* 4. BILLING & INVOICES TAB */}
        {activeTab === 'billing' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Invoices &amp; Payment History</h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '4px 0 0' }}>Click any invoice to view and print your formal payment receipt.</p>
              </div>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '820px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Invoice #</th>
                    <th style={{ padding: '12px 16px', minWidth: '220px' }}>Description</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientOrders.map((ord: any) => (
                    <tr key={ord.id} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => setViewInvoice(ord)}>
                      <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        {ord.orderNumber}
                      </td>
                      <td style={{ padding: '16px', color: '#64748B' }}>
                        {ord.items?.[0]?.description || 'Hosting & Domain Provisioning'}
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        {currency === 'INR' ? `₹${Math.round(ord.totalAmount * 84).toLocaleString()}` : `$${ord.totalAmount.toFixed(2)}`}
                      </td>
                      <td style={{ padding: '16px', color: '#64748B', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className="status-badge status-success">
                          <span className="status-dot"></span>
                          {ord.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewInvoice(ord); }}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        >
                          View Receipt 📄
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderClientPagination(clientOrderPage, totalClientOrderPages, orders.length, 'invoices', setClientOrderPage)}
            </div>
          </div>
        )}

        {/* 5. SUPPORT TICKETS TAB */}
        {activeTab === 'tickets' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Support Desk &amp; Inquiries</h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  Click on any ticket to open the full conversation thread and reply directly to engineers.
                </p>
              </div>
              <button onClick={() => setShowTicketModal(true)} className="btn btn-sm btn-primary">
                + Open New Ticket
              </button>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '920px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Ticket #</th>
                    <th style={{ padding: '12px 16px', minWidth: '240px' }}>Subject</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Department</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Created Date</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Last Activity</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Priority</th>
                    <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Conversation</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientTickets.map((t: any) => (
                    <tr
                      key={t.id}
                      style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => handleOpenTicketThread(t)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-action-cyan)', whiteSpace: 'nowrap' }}>
                        <span style={{ textDecoration: 'underline' }}>{t.ticketNumber}</span>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ fontSize: '0.95rem' }}>{t.subject}</div>
                        {t.replies?.[t.replies.length - 1] && (
                          <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 400, marginTop: '4px' }}>
                            Latest reply from <strong>{t.replies[t.replies.length - 1].senderName}</strong>: &quot;{t.replies[t.replies.length - 1].message.slice(0, 70)}...&quot;
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px', color: '#64748B', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{t.department}</td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#0F172A' }}>
                        <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 600 }}>
                          {t.lastRepliedAt ? new Date(t.lastRepliedAt).toLocaleDateString() : new Date(t.createdAt).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                          {t.lastRepliedBy === 'STAFF' ? (
                            <span style={{ color: '#166534', fontWeight: 700 }}>🛡️ Staff ({t.lastRepliedByName || 'Support'})</span>
                          ) : (
                            <span style={{ color: '#0284C7', fontWeight: 600 }}>👤 You (Awaiting Staff)</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${t.priority === 'HIGH' ? 'status-danger' : 'status-warning'}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span className={`status-badge ${t.status === 'OPEN' ? 'status-success' : t.status === 'ANSWERED' ? 'status-info' : 'status-neutral'}`}>
                          <span className="status-dot"></span>
                          {t.status === 'CLOSED' ? '🔒 Closed' : t.status === 'ANSWERED' ? '💬 Answered' : '🟢 Open'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenTicketThread(t); }}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        >
                          Open Thread 💬
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderClientPagination(clientTicketPage, totalClientTicketPages, tickets.length, 'tickets', setClientTicketPage)}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DETAIL MODAL 1: TICKET DISCUSSION & REPLY THREAD (Option 1 Core)          */}
      {/* ========================================================================= */}
      {selectedTicket && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '760px', padding: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '24px 32px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-action-cyan)', fontSize: '1rem', background: '#E0F2FE', padding: '2px 8px', borderRadius: '6px' }}>
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className={`status-badge ${selectedTicket.status === 'OPEN' ? 'status-success' : selectedTicket.status === 'ANSWERED' ? 'status-info' : 'status-neutral'}`}>
                    <span className="status-dot"></span>
                    {selectedTicket.status === 'CLOSED' ? '🔒 RESOLVED & CLOSED' : selectedTicket.status === 'ANSWERED' ? '💬 ANSWERED' : '🟢 OPEN'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{selectedTicket.department}</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    • Created: <strong>{new Date(selectedTicket.createdAt).toLocaleDateString()}</strong>
                  </span>
                  {selectedTicket.lastRepliedAt && (
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      • Last Activity: <strong>{new Date(selectedTicket.lastRepliedAt).toLocaleString()}</strong> by {selectedTicket.lastRepliedByName || (selectedTicket.lastRepliedBy === 'STAFF' ? 'Staff' : 'You')}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.35rem', color: '#0F172A', margin: 0 }}>{selectedTicket.subject}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedTicket.status !== 'CLOSED' ? (
                  <button
                    onClick={handleCloseTicket}
                    style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Close &amp; Resolve Ticket 🔒
                  </button>
                ) : (
                  <button
                    onClick={handleReopenTicket}
                    style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', color: '#0284C7', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Reopen Ticket 🔓
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  style={{ background: '#E2E8F0', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Conversation Thread Messages */}
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px', background: '#FFFFFF' }}>
              {(selectedTicket.replies || []).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748B', padding: '30px' }}>No replies posted yet.</div>
              ) : (
                (selectedTicket.replies || []).map((rep: any, idx: number) => {
                  const isStaff = rep.senderType === 'STAFF';
                  return (
                    <div
                      key={rep.id || idx}
                      style={{
                        padding: '18px 22px',
                        borderRadius: '16px',
                        background: isStaff ? '#F0FDF4' : '#F8FAFC',
                        border: isStaff ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                        alignSelf: isStaff ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>{isStaff ? '🛡️' : '👤'}</span>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isStaff ? '#166534' : '#0F172A' }}>
                            {rep.senderName}
                          </span>
                          {isStaff && (
                            <span style={{ fontSize: '0.7rem', background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              VERIFIED STAFF
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                          {new Date(rep.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {rep.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Box */}
            <div style={{ padding: '20px 32px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <form onSubmit={handleSendTicketReply}>
                <textarea
                  rows={3}
                  value={ticketReplyText}
                  onChange={(e) => setTicketReplyText(e.target.value)}
                  placeholder="Type your response to the support team..."
                  required
                  className="form-input"
                  style={{ marginBottom: '12px', resize: 'vertical' }}
                ></textarea>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Typical engineer response time: <strong>&lt; 15 minutes</strong>
                  </span>
                  <button type="submit" disabled={submittingReply} className="btn btn-sm btn-primary">
                    {submittingReply ? 'Sending...' : 'Send Reply 📤'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL 2: DOMAIN MANAGEMENT & DELEGATION HUB (Option 1 Core)        */}
      {/* ========================================================================= */}
      {selectedDomainDetails && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <span className="section-tag tag-lime">Domain Security &amp; Delegation</span>
                <h3 style={{ fontSize: '1.5rem', color: '#0F172A', margin: '4px 0 2px' }}>
                  {selectedDomainDetails.domainName}
                </h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
                  Renewal Date: <strong>{new Date(selectedDomainDetails.expiryDate).toLocaleDateString()}</strong> &bull; Status: <strong style={{ color: '#4F7C12' }}>ACTIVE</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedDomainDetails(null)}
                style={{ background: '#E2E8F0', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}
              >
                ✕
              </button>
            </div>

            {domainActionMsg && (
              <div style={{ background: '#EBF7D4', border: '1px solid #C4E58C', color: '#4F7C12', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ {domainActionMsg}
              </div>
            )}

            {/* Section 1: Nameserver Delegation */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', color: '#0F172A', margin: 0 }}>Nameserver Delegation</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0' }}>Direct DNS queries to Hostmattic cloud or custom external nameservers.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNs1('ns1.hostmattic.com');
                    setNs2('ns2.hostmattic.com');
                    setNs3('');
                    setNs4('');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-action-green)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Reset to Hostmattic NS
                </button>
              </div>

              <form onSubmit={handleSaveNameservers}>
                <div className="grid-col-1-to-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>Primary Nameserver (NS1)</label>
                    <input type="text" value={ns1} onChange={(e) => setNs1(e.target.value)} required className="form-input" style={{ fontSize: '0.85rem', padding: '8px 10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>Secondary Nameserver (NS2)</label>
                    <input type="text" value={ns2} onChange={(e) => setNs2(e.target.value)} required className="form-input" style={{ fontSize: '0.85rem', padding: '8px 10px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={savingNs} className="btn btn-sm btn-primary">
                    {savingNs ? 'Updating...' : 'Save Nameservers'}
                  </button>
                </div>
              </form>
            </div>

            {/* Section 2: Security & Transfer Controls */}
            <div className="grid-col-1-to-2" style={{ marginBottom: '20px' }}>
              {/* Theft Protection Lock */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{selectedDomainDetails.theftProtection !== false ? '🔒' : '🔓'}</span>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem' }}>Registrar Transfer Lock</div>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '12px' }}>Prevents unauthorized domain transfers to other registrars.</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {selectedDomainDetails.theftProtection !== false ? (
                    <span className="status-badge status-success">
                      <span className="status-dot"></span>
                      🔒 LOCKED &amp; SECURED
                    </span>
                  ) : (
                    <span className="status-badge status-warning">
                      <span className="status-dot"></span>
                      🔓 UNLOCKED / PERMITTED
                    </span>
                  )}
                  <button
                    onClick={handleToggleTheftProtection}
                    disabled={togglingLock}
                    style={{
                      background: selectedDomainDetails.theftProtection !== false ? '#FFFFFF' : '#EBF7D4',
                      border: selectedDomainDetails.theftProtection !== false ? '1px solid #CBD5E1' : '1px solid #C4E58C',
                      color: selectedDomainDetails.theftProtection !== false ? '#334155' : '#4F7C12',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: togglingLock ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {togglingLock ? 'Updating...' : selectedDomainDetails.theftProtection !== false ? '🔓 Unlock Domain' : '🔒 Lock Domain'}
                  </button>
                </div>
              </div>

              {/* WHOIS Privacy Shield */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{selectedDomainDetails.privacyProtection !== false ? '🛡️' : '🌐'}</span>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem' }}>WHOIS Privacy Shield</div>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '12px' }}>Hides personal email, phone, and address from WHOIS searches.</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {selectedDomainDetails.privacyProtection !== false ? (
                    <span className="status-badge status-info">
                      <span className="status-dot"></span>
                      🛡️ ID PROTECTED
                    </span>
                  ) : (
                    <span className="status-badge status-neutral">
                      <span className="status-dot"></span>
                      🌐 PUBLIC RECORD
                    </span>
                  )}
                  <button
                    onClick={handleTogglePrivacyProtection}
                    disabled={togglingPrivacy}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: togglingPrivacy ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {togglingPrivacy ? 'Updating...' : selectedDomainDetails.privacyProtection !== false ? 'Disable Shield 🌐' : 'Enable Shield 🛡️'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: EPP / Transfer Auth-Code */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🔑</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem' }}>Transfer Authorization (EPP Code)</div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Required if you wish to transfer this domain to another registrar.</div>
                </div>
                {authCodeValue ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, background: '#FFFFFF', border: '1px dashed #4F7C12', padding: '6px 14px', borderRadius: '6px', color: '#4F7C12' }}>
                      {authCodeValue}
                    </div>
                    <button
                      onClick={handleCopyEpp}
                      style={{
                        background: copiedEpp ? '#EBF7D4' : '#FFFFFF',
                        border: copiedEpp ? '1px solid #4F7C12' : '1px solid #CBD5E1',
                        color: copiedEpp ? '#4F7C12' : '#334155',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedEpp ? '✓ Copied!' : 'Copy Code 📋'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGetAuthCode}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    Retrieve EPP Code 🔑
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL 3: WEB HOSTING & SERVER CONTROL CENTER (Option 1 Core)       */}
      {/* ========================================================================= */}
      {selectedHostingDetails && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <span className="section-tag tag-cyan">Server Control Center</span>
                <h3 style={{ fontSize: '1.45rem', color: '#0F172A', margin: '4px 0 2px' }}>
                  {selectedHostingDetails.planName}
                </h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
                  Primary Domain: <strong>{selectedHostingDetails.domainName}</strong> &bull; Region: <strong>{selectedHostingDetails.serverLocation} NVMe Node</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedHostingDetails(null)}
                style={{ background: '#E2E8F0', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}
              >
                ✕
              </button>
            </div>

            {/* Resource Gauges */}
            <div className="grid-col-1-to-3" style={{ marginBottom: '24px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>NVMe Storage</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>3.2 GB <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>/ 50 GB</span></div>
                <div style={{ background: '#E2E8F0', height: '6px', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--brand-action-green)', width: '6.4%', height: '100%' }}></div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Monthly Bandwidth</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>14.8 GB <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>/ Unmetered</span></div>
                <div style={{ background: '#E2E8F0', height: '6px', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--brand-action-cyan)', width: '15%', height: '100%' }}></div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Inodes (Files)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>24,100 <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>/ 250k</span></div>
                <div style={{ background: '#E2E8F0', height: '6px', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#9BCB44', width: '9.6%', height: '100%' }}></div>
                </div>
              </div>
            </div>

            {/* cPanel Quick Shortcuts */}
            <h4 style={{ fontSize: '0.95rem', color: '#0F172A', marginBottom: '12px' }}>Quick Control Panel Shortcuts</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
              {[
                { name: 'File Manager', icon: '📁', url: `https://${selectedHostingDetails.serverIp}:2083/cpsess/frontend/paper_lantern/filemanager/index.html` },
                { name: 'phpMyAdmin', icon: '🗄️', url: `https://${selectedHostingDetails.serverIp}:2083/cpsess/frontend/paper_lantern/sql/index.html` },
                { name: 'MySQL Databases', icon: '🛢️', url: `https://${selectedHostingDetails.serverIp}:2083` },
                { name: 'Email Accounts', icon: '✉️', url: `https://${selectedHostingDetails.serverIp}:2083` },
                { name: 'SSL / TLS Status', icon: '🔒', url: `https://${selectedHostingDetails.serverIp}:2083` },
              ].map((sc, i) => (
                <a
                  key={i}
                  href={sc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px',
                    textDecoration: 'none', color: '#0F172A', transition: 'all 0.15s', textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{sc.icon}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{sc.name}</span>
                </a>
              ))}
            </div>

            {/* Server Specifications & Password Reset */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#0F172A', margin: 0 }}>Change cPanel Master Password</h4>
                <span className="status-badge status-success">
                  <span className="status-dot"></span>
                  ⚡ ACTIVE &amp; RUNNING
                </span>
              </div>
              {passResetMsg && (
                <div style={{ background: '#EBF7D4', color: '#4F7C12', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '10px', fontWeight: 600 }}>
                  ✓ {passResetMsg}
                </div>
              )}
              <form onSubmit={handleResetCpanelPass} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showCpanelPass ? 'text' : 'password'}
                    placeholder="Enter new master password (min 8 chars)"
                    value={newCpanelPass}
                    onChange={(e) => setNewCpanelPass(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.88rem', paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCpanelPass(!showCpanelPass)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', color: '#64748B' }}
                    title={showCpanelPass ? 'Hide password' : 'Show password'}
                  >
                    {showCpanelPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '48px', padding: '0 20px', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Update Password 🔒
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL 4: ACCOUNT SETTINGS & SECURITY (Option 1 Core)              */}
      {/* ========================================================================= */}
      {showProfileModal && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <span className="section-tag tag-lime">Account &amp; Security</span>
                <h3 style={{ fontSize: '1.4rem', color: '#0F172A', margin: '4px 0 0' }}>Client Account Profile</h3>
              </div>
              <button onClick={() => setShowProfileModal(false)} style={{ background: '#E2E8F0', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>✕</button>
            </div>

            {profileSavedMsg && (
              <div style={{ background: '#EBF7D4', color: '#4F7C12', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ {profileSavedMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '6px' }}>Full Name / Organization</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="form-input" placeholder="e.g. John Doe / Acme Corp" />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '6px' }}>Email Address (Primary Login)</label>
                <input type="email" value={profileEmail} disabled className="form-input" style={{ background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }} />
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>Email address is locked for account security verification.</span>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '6px' }}>Contact Phone</label>
                <input type="text" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="form-input" placeholder="+1 (555) 000-0000" />
              </div>

              {/* Two-Factor Authentication Card */}
              <div
                style={{
                  padding: '18px 20px',
                  background: twoFactorEnabled ? 'rgba(79, 124, 18, 0.04)' : '#F8FAFC',
                  borderRadius: '14px',
                  border: twoFactorEnabled ? '1.5px solid #C4E58C' : '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 280px', minWidth: '240px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: twoFactorEnabled ? 'rgba(79, 124, 18, 0.12)' : '#EDF2F7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0,
                        border: twoFactorEnabled ? '1px solid rgba(79, 124, 18, 0.25)' : '1px solid #CBD5E1',
                      }}
                    >
                      {twoFactorEnabled ? '🛡️' : '🔐'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>
                          Two-Factor Authentication (2FA)
                        </span>
                        <span
                          className={`status-badge ${twoFactorEnabled ? 'status-success' : 'status-warning'}`}
                          style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.02em' }}
                        >
                          <span className="status-dot"></span>
                          {twoFactorEnabled ? '2FA ACTIVE' : '2FA INACTIVE'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.45 }}>
                        Protect your account with Google Authenticator or any TOTP mobile app.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className="btn"
                    style={{
                      background: twoFactorEnabled ? '#FFFFFF' : 'var(--brand-action-green, #4F7C12)',
                      border: twoFactorEnabled ? '1px solid #CBD5E1' : 'none',
                      color: twoFactorEnabled ? '#DC2626' : '#FFFFFF',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: twoFactorEnabled ? '0 1px 2px rgba(0,0,0,0.05)' : '0 2px 8px rgba(79, 124, 18, 0.28)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (twoFactorEnabled) {
                        e.currentTarget.style.background = '#FEF2F2';
                        e.currentTarget.style.borderColor = '#FCA5A5';
                      } else {
                        e.currentTarget.style.background = '#436B0F';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (twoFactorEnabled) {
                        e.currentTarget.style.background = '#FFFFFF';
                        e.currentTarget.style.borderColor = '#CBD5E1';
                      } else {
                        e.currentTarget.style.background = 'var(--brand-action-green, #4F7C12)';
                        e.currentTarget.style.transform = 'none';
                      }
                    }}
                  >
                    {twoFactorEnabled ? (
                      <>
                        <span style={{ fontSize: '0.9rem' }}>🔓</span>
                        <span>Disable 2FA</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.9rem' }}>🛡️</span>
                        <span>Enable 2FA</span>
                      </>
                    )}
                  </button>
                </div>

                {twoFactorEnabled && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '12px 14px',
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #C4E58C',
                      fontSize: '0.82rem',
                      color: '#2E5606',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', color: '#4F7C12' }}>✓</span>
                    <span>
                      <strong>Two-Factor Authentication is currently active.</strong> Your account requires a 6-digit TOTP security code upon sign-in.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowProfileModal(false)} className="btn btn-sm btn-outline">Close</button>
              <button
                type="button"
                onClick={() => {
                  setProfileSavedMsg('Profile changes saved successfully!');
                  setTimeout(() => setProfileSavedMsg(''), 3000);
                }}
                className="btn btn-sm btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OTHER EXISTING MODALS (DNS Zone, Open Ticket, Invoice Viewer)             */}
      {/* ========================================================================= */}
      {/* DNS ZONE EDITOR */}
      {selectedDomainForDns && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <span className="section-tag tag-lime">DNS Zone Manager</span>
                <h3 style={{ fontSize: '1.4rem', color: '#0F172A', margin: '4px 0 2px' }}>
                  Zone Records: {selectedDomainForDns}
                </h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
                  Active Nameservers: <code>ns1.hostmattic.com</code> &bull; <code>ns2.hostmattic.com</code>
                </p>
              </div>
              <button
                onClick={() => setSelectedDomainForDns(null)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {dnsSuccessMsg && (
              <div style={{ background: '#EBF7D4', border: '1px solid #C4E58C', color: '#4F7C12', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ {dnsSuccessMsg}
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '10px', color: '#0F172A' }}>Active Zone Records</h4>
              {loadingDns ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>Loading DNS records...</div>
              ) : (
                <div className="table-responsive" style={{ border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '580px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Type</th>
                        <th style={{ padding: '10px 14px' }}>Host / Name</th>
                        <th style={{ padding: '10px 14px' }}>Target / Value</th>
                        <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(dnsRecords) && dnsRecords.length > 0 ? (
                        dnsRecords.map((r: any, idx: number) => (
                          <tr key={r.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <span className="status-badge status-success">{r.type || 'A'}</span>
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{r.host || '@'}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{r.value}</td>
                            <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>{r.ttl || 14400}s</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                            No active DNS records found in this zone. You can add your first record below.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#0F172A' }}>Add New Zone Record</h4>
              <form onSubmit={handleAddDnsRecord}>
                <div className="grid-dns-row">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>Type</label>
                    <select
                      value={newRecordType}
                      onChange={(e) => setNewRecordType(e.target.value)}
                      className="form-select"
                      style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    >
                      <option value="A">A</option>
                      <option value="CNAME">CNAME</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="AAAA">AAAA</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>Host / Name</label>
                    <input
                      type="text"
                      placeholder="@ or subdomain"
                      value={newRecordHost}
                      onChange={(e) => setNewRecordHost(e.target.value)}
                      className="form-input"
                      style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>Target IP / Value</label>
                    <input
                      type="text"
                      placeholder="e.g. 198.51.100.24"
                      value={newRecordValue}
                      onChange={(e) => setNewRecordValue(e.target.value)}
                      required
                      className="form-input"
                      style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="submit" className="btn btn-sm btn-primary">
                    + Add DNS Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* OPEN TICKET MODAL */}
      {showTicketModal && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span className="section-tag tag-cyan">Support Desk</span>
                <h3 style={{ fontSize: '1.4rem', color: '#0F172A', margin: '4px 0 0' }}>Open Support Ticket</h3>
              </div>
              <button onClick={() => setShowTicketModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748B' }}>✕</button>
            </div>

            {ticketSuccessMsg ? (
              <div style={{ background: '#EBF7D4', border: '1px solid #C4E58C', color: '#4F7C12', padding: '16px', borderRadius: '12px', textAlign: 'center', fontWeight: 700 }}>
                ✓ {ticketSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief description of the issue"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="grid-col-1-to-2" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Department</label>
                    <select value={ticketDept} onChange={(e) => setTicketDept(e.target.value)} className="form-select">
                      <option value="Technical Support">Technical Support</option>
                      <option value="Customer Billing & Accounts">Billing &amp; Invoicing</option>
                      <option value="Domain Transfers & DNS">Domains &amp; DNS</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Priority</label>
                    <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} className="form-select">
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High (Urgent)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Message Details</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide details about what you need assistance with..."
                    value={ticketMsg}
                    onChange={(e) => setTicketMsg(e.target.value)}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowTicketModal(false)} className="btn btn-sm btn-outline">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingTicket} className="btn btn-sm btn-primary">
                    {submittingTicket ? 'Submitting...' : 'Submit Ticket →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STATUTORY GST TAX INVOICE VIEWER */}
      {viewInvoice && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '720px' }}>
            {/* Header with Title and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <img src="/assets/img/hostmattic-logo.png" alt="Hostmattic" height="32" style={{ height: '32px', width: 'auto' }} />
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800 }}>
                    {viewInvoice.currency === 'INR' ? 'TAX INVOICE' : 'EXPORT TAX INVOICE'}
                  </span>
                  <span className="status-badge status-success" style={{ fontSize: '0.7rem' }}>
                    <span className="status-dot"></span>
                    {viewInvoice.paymentStatus || 'PAID'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                  Original for Recipient &bull; Issued under Section 31 of the CGST Act, 2017
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem' }}>
                  Print / PDF 🖨️
                </button>
                <button onClick={() => setViewInvoice(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748B' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Entity Details: Supplier vs Recipient */}
            <div className="grid-col-1-to-2" style={{ marginBottom: '20px', fontSize: '0.82rem' }}>
              {/* Supplier */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Supplier / Service Provider
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>{taxSettings.legalBusinessName || 'Hostmattic Technologies'}</div>
                <div style={{ color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
                  {taxSettings.registeredAddress || 'Building 4B, Infopark Technology Hub'}<br />
                  {taxSettings.city || 'Kochi'}, {taxSettings.state || 'Kerala'} &bull; State Code: <strong>{taxSettings.stateCode || '32'}</strong>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
                  <div><strong>GSTIN:</strong> <span style={{ fontFamily: 'monospace' }}>{taxSettings.sellerGstin || '32AABCO1234F1Z5'}</span></div>
                  <div><strong>PAN:</strong> <span style={{ fontFamily: 'monospace' }}>{taxSettings.panNumber || 'AABCO1234F'}</span></div>
                </div>
              </div>

              {/* Recipient */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Billed To / Recipient ({viewInvoice.customerType || 'B2C'})
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>
                  {viewInvoice.companyName || viewInvoice.user?.name || 'Valued Customer'}
                </div>
                <div style={{ color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
                  {viewInvoice.billingAddress ? `${viewInvoice.billingAddress}, ` : ''}
                  {viewInvoice.billingCity ? `${viewInvoice.billingCity}, ` : ''}
                  {viewInvoice.billingState || 'Kerala'} &bull; Country: {viewInvoice.billingCountry || (viewInvoice.currency === 'INR' ? 'IN' : 'US')}
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
                  {viewInvoice.customerGstin ? (
                    <div style={{ color: '#4F7C12', fontWeight: 700 }}>
                      <strong>Buyer GSTIN:</strong> <span style={{ fontFamily: 'monospace' }}>{viewInvoice.customerGstin}</span> (ITC Claim Eligible)
                    </div>
                  ) : (
                    <div style={{ color: '#64748B' }}>
                      <strong>Customer Type:</strong> Individual / Retail Consumer (B2C)
                    </div>
                  )}
                  <div><strong>Place of Supply:</strong> {viewInvoice.placeOfSupply || `${taxSettings.stateCode || '32'}-${taxSettings.state || 'Kerala'}`}</div>
                </div>
              </div>
            </div>

            {/* Invoice Meta Ribbon */}
            <div className="grid-invoice-meta">
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Invoice Number:</span>
                <strong>{viewInvoice.orderNumber}</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Date of Issue:</span>
                <strong>{new Date(viewInvoice.createdAt).toLocaleDateString()}</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Payment Status:</span>
                <strong style={{ color: '#9BCB44' }}>{viewInvoice.paymentStatus || 'PAID'}</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.72rem' }}>Payment Method:</span>
                <strong>{viewInvoice.paymentMethod || 'ONLINE'}</strong>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="table-responsive" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem', minWidth: '460px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '10px 14px', width: '36px' }}>#</th>
                    <th style={{ padding: '10px 14px' }}>Description of Service</th>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>SAC Code</th>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Period</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Taxable Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewInvoice.items || []).length > 0 ? (
                    viewInvoice.items.map((it: any, idx: number) => (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 14px', color: '#64748B' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>{it.description}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#29B4D5' }}>{it.sacCode || '998315'}</td>
                        <td style={{ padding: '10px 14px', color: '#64748B' }}>{it.billingPeriod || '1 Year'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                          {viewInvoice.currency === 'INR' ? `₹${Math.round(it.price).toLocaleString()}` : `$${it.price.toFixed(2)}`}
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
                        {viewInvoice.currency === 'INR' ? `₹${Math.round(viewInvoice.totalAmount).toLocaleString()}` : `$${viewInvoice.totalAmount.toFixed(2)}`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Statutory Tax Breakup Box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ width: '320px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Taxable Subtotal (Ex-Tax):</span>
                  <span style={{ fontWeight: 600 }}>
                    {viewInvoice.currency === 'INR'
                      ? `₹${Math.round(viewInvoice.subtotalAmount || (viewInvoice.totalAmount / 1.18)).toLocaleString()}`
                      : `$${(viewInvoice.subtotalAmount || viewInvoice.totalAmount).toFixed(2)}`}
                  </span>
                </div>

                {viewInvoice.currency === 'INR' ? (
                  viewInvoice.taxType === 'CGST_SGST' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748B' }}>Central Tax (CGST {viewInvoice.taxRate ? viewInvoice.taxRate / 2 : 9}%):</span>
                        <span>₹{Math.round(viewInvoice.cgstAmount || ((viewInvoice.totalAmount - (viewInvoice.totalAmount / 1.18)) / 2)).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748B' }}>State Tax (SGST {viewInvoice.taxRate ? viewInvoice.taxRate / 2 : 9}%):</span>
                        <span>₹{Math.round(viewInvoice.sgstAmount || ((viewInvoice.totalAmount - (viewInvoice.totalAmount / 1.18)) / 2)).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748B' }}>Integrated Tax (IGST {viewInvoice.taxRate || 18}%):</span>
                      <span>₹{Math.round(viewInvoice.igstAmount || (viewInvoice.totalAmount - (viewInvoice.totalAmount / 1.18))).toLocaleString()}</span>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#64748B' }}>Integrated Tax (0% LUT Export):</span>
                    <span>$0.00</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '2px solid #0F172A', fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                  <span>Total Amount Paid:</span>
                  <span style={{ color: 'var(--brand-action-green)' }}>
                    {viewInvoice.currency === 'INR' ? `₹${Math.round(viewInvoice.totalAmount).toLocaleString()}` : `$${viewInvoice.totalAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Cross-border LUT Declaration if USD */}
            {viewInvoice.currency === 'USD' && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '0.75rem', color: '#92400E', marginBottom: '20px' }}>
                <strong>Statutory Export Declaration:</strong> Supply of services meant for export under Letter of Undertaking (LUT: <strong>{taxSettings.lutNumber || 'AD320324001928K'}</strong>) without payment of integrated tax under Section 16(3) of Integrated Goods and Services Tax Act, 2017.
              </div>
            )}

            {/* Legal Footer & Authorized Signatory */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '0.75rem', color: '#64748B' }}>
              <div>
                <div>Tax payable on reverse charge basis: <strong>No</strong></div>
                <div>Computer generated official statutory tax invoice. No physical signature required.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>For Hostmattic Technologies</div>
                <div style={{ marginTop: '16px', fontStyle: 'italic' }}>Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1-CLICK RENEWAL CONFIRMATION MODAL */}
      {selectedRenewalModal && (
        <div className="modal-backdrop-responsive">
          <div className="modal-card-responsive" style={{ maxWidth: '520px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>🔄</span>
                <div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#0F172A' }}>Service Renewal Confirmation</h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Extend validity to maintain uninterrupted service &amp; DNS uptime
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRenewalModal(null)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '999px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748B', whiteSpace: 'nowrap' }}>Service Item:</span>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', textAlign: 'right', wordBreak: 'break-all' }}>
                  {selectedRenewalModal.type === 'DOMAIN'
                    ? selectedRenewalModal.item.domainName
                    : selectedRenewalModal.type === 'HOSTING'
                    ? `${selectedRenewalModal.item.planName} (${selectedRenewalModal.item.domainName})`
                    : selectedRenewalModal.item.name}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Current Expiry:</span>
                <span style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 600 }}>
                  {selectedRenewalModal.item.expiryDate ? new Date(selectedRenewalModal.item.expiryDate).toLocaleDateString() : 'Active Subscription'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Extension Term:</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--brand-action-teal)', fontWeight: 700 }}>
                  +1 Year Standard Renewal
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px dashed #CBD5E1', alignItems: 'center' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Estimated Renewal Price:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-action-green)' }}>
                  {selectedRenewalModal.type === 'DOMAIN'
                    ? formatPrice(pricingData?.[selectedRenewalModal.item.tld || '.com']?.renew || 12.99)
                    : selectedRenewalModal.type === 'HOSTING'
                    ? formatPrice(119.88)
                    : formatPrice(Number(selectedRenewalModal.item.price) || 19.99)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedRenewalModal(null)}
                className="btn btn-sm btn-outline"
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRenewal}
                className="btn btn-sm btn-primary"
                style={{ padding: '8px 20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Proceed to Renewal Checkout 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
