'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';

export interface DomainCheckResult {
  domain: string;
  tld?: string;
  available: boolean;
  status: 'available' | 'taken' | 'unknown';
  rawStatus?: string;
  canTransfer?: boolean;
  priceUsd: number;
  priceInr?: number;
  popular?: boolean;
  isSearchedExact?: boolean;
  isPromo?: boolean;
  badge?: string;
  promoEndsAt?: string;
}

export default function DomainSearchBox({
  initialQuery = '',
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DomainCheckResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'taken'>('all');
  const [error, setError] = useState('');
  const [addedDomain, setAddedDomain] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = query.trim();
    if (!cleanQ) return;

    setLoading(true);
    setError('');
    setResults([]);
    setSearchedQuery(cleanQ);

    try {
      const res = await fetch(`/api/domains/check?domain=${encodeURIComponent(cleanQ)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        setError(data.error || 'Failed to check domain availability from live registry.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with live domain registrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (dom: DomainCheckResult) => {
    if (!dom.available) return;
    setAddedDomain(dom.domain);
    addItem(
      {
        type: 'DOMAIN',
        name: dom.domain,
        domainName: dom.domain,
        billingPeriod: 'annual',
        priceMonthly: Number((dom.priceUsd / 12).toFixed(2)),
        priceAnnual: dom.priceUsd,
      },
      true
    );
    setTimeout(() => setAddedDomain(null), 2500);
  };

  // Find the exact or primary searched domain
  const normalizedQuery = searchedQuery.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const primaryResult = results.find((r) => r.isSearchedExact) || results.find((r) => r.domain.toLowerCase() === normalizedQuery) || results[0];
  const alternativeResults = results.filter((r) => r.domain !== primaryResult?.domain);

  const availableCount = results.filter((r) => r.available).length;
  const takenCount = results.filter((r) => !r.available).length;

  const filteredAlternatives = alternativeResults.filter((r) => {
    if (filter === 'available') return r.available;
    if (filter === 'taken') return !r.available;
    return true;
  });

  return (
    <div style={{ width: '100%', maxWidth: '820px', margin: '0 auto' }}>
      <form onSubmit={handleSearch}>
        <div className="domain-search-box" style={{ background: '#FFFFFF', boxShadow: 'var(--shadow-lg)', borderRadius: '14px' }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748B"
            strokeWidth="2.2"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="domain-input"
            placeholder="Type your domain name (e.g. ofinit.com or mybrand)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            autoFocus={autoFocus}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-light)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.95rem',
              }}
              title="Clear input"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {loading ? (
              <>
                <span className="spinner-inline"></span> Checking Live Registry...
              </>
            ) : (
              'Search Domain'
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            padding: '12px 16px',
            borderRadius: '10px',
            marginTop: '16px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Live Results Display */}
      {results && results.length > 0 && primaryResult && (
        <div
          className="domain-results-container"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '24px',
            marginTop: '24px',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'left',
          }}
        >
          {/* Header Summary */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#0F172A', marginBottom: '2px', fontWeight: 800 }}>
                Registry Results for &ldquo;<strong>{searchedQuery}</strong>&rdquo;
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>
                Real-time WHOIS verification directly from upstream root registry
              </p>
            </div>
            <div>
              {primaryResult.available ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#EBF7D4',
                    color: '#4F7C12',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    padding: '6px 14px',
                    borderRadius: '999px',
                  }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4F7C12' }}></span>
                  Exact Match Available
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#DC2626',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    padding: '6px 14px',
                    borderRadius: '999px',
                  }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#DC2626' }}></span>
                  Domain Taken &bull; {availableCount} Alternate Extensions Available
                </span>
              )}
            </div>
          </div>

          {/* PRIMARY / FEATURED RESULT HERO CARD */}
          <div
            className="domain-hero-result-card"
            style={{
              border: primaryResult.available
                ? '2px solid var(--brand-action-green)'
                : '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '22px 24px',
              marginBottom: '24px',
              background: primaryResult.available
                ? 'linear-gradient(135deg, #F7FDF2 0%, #FFFFFF 100%)'
                : '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: primaryResult.available ? '0 10px 25px -5px rgba(79, 124, 18, 0.12)' : 'none',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
                  {primaryResult.domain}
                </span>
                {primaryResult.available ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: '#4F7C12',
                        color: '#FFFFFF',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      ✓ Available Now
                    </span>
                    {primaryResult.isPromo && primaryResult.badge && (
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #FFEDD5 0%, #FEE2E2 100%)',
                          border: '1px solid #FCA5A5',
                          color: '#B91C1C',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          textTransform: 'uppercase',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>🔥 {primaryResult.badge}</span>
                        {primaryResult.promoEndsAt && (
                          <span style={{ fontWeight: 600, opacity: 0.85, fontSize: '0.68rem' }}>
                            &bull; Ends {new Date(primaryResult.promoEndsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    style={{
                      background: '#FEE2E2',
                      border: '1px solid #FCA5A5',
                      color: '#B91C1C',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    🔒 Already Registered
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                {primaryResult.available ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
                    <span style={{ color: '#4F7C12', fontWeight: 700 }}>✓ Free Privacy Protection</span>
                    <span>&bull;</span>
                    <span>✓ Anycast DNS Management</span>
                    <span>&bull;</span>
                    <span>✓ 2 Free Email Forwarders</span>
                  </div>
                ) : (
                  <div style={{ color: '#64748B' }}>
                    This domain is actively registered on the global registry. If you are the registrant, you can easily transfer it to Hostmattic.
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {primaryResult.available ? (
                <>
                  <div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#4F7C12', lineHeight: 1.1 }}>
                      {formatPrice(primaryResult.priceUsd)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>per year &bull; Renews at standard rate</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegister(primaryResult)}
                    className="btn btn-primary"
                    style={{ padding: '10px 22px', fontSize: '0.92rem', fontWeight: 800 }}
                  >
                    {addedDomain === primaryResult.domain ? '✓ Added to Cart!' : 'Select & Register →'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Unavailable for Purchase</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Transfer includes 1 free year</div>
                  </div>
                  <Link
                    href={`/domains/transfer?domain=${encodeURIComponent(primaryResult.domain)}`}
                    className="btn btn-secondary"
                    style={{ padding: '10px 18px', fontSize: '0.86rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Transfer to Hostmattic →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ALTERNATIVE EXTENSIONS SECTION */}
          {alternativeResults.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                  More Extensions for &ldquo;{primaryResult.domain.split('.')[0]}&rdquo;
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    style={{
                      background: filter === 'all' ? '#0F172A' : '#F1F5F9',
                      color: filter === 'all' ? '#FFFFFF' : '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    All ({alternativeResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('available')}
                    style={{
                      background: filter === 'available' ? '#4F7C12' : '#EBF7D4',
                      color: filter === 'available' ? '#FFFFFF' : '#4F7C12',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Available ({alternativeResults.filter((r) => r.available).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('taken')}
                    style={{
                      background: filter === 'taken' ? '#DC2626' : '#FEF2F2',
                      color: filter === 'taken' ? '#FFFFFF' : '#DC2626',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Taken ({alternativeResults.filter((r) => !r.available).length})
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
                {filteredAlternatives.map((res) => {
                  const isAdded = addedDomain === res.domain;
                  return (
                    <div
                      key={res.domain}
                      style={{
                        border: res.available
                          ? (isAdded ? '1px solid var(--brand-action-green)' : '1px solid #E2E8F0')
                          : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: res.available
                          ? (isAdded ? '#F7FDF2' : '#FFFFFF')
                          : '#F8FAFC',
                        opacity: res.available ? 1 : 0.85,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: res.available ? '#0F172A' : '#64748B' }}>
                            {res.domain.split('.')[0]}
                            <span style={{ color: res.available ? '#10708A' : '#94A3B8' }}>
                              .{res.tld ? res.tld.replace('.', '') : res.domain.split('.').slice(1).join('.')}
                            </span>
                          </span>

                          {res.available ? (
                            <span
                              style={{
                                background: '#EBF7D4',
                                color: '#4F7C12',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              Available
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#F1F5F9',
                                color: '#64748B',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              Taken
                            </span>
                          )}

                          {res.isPromo && res.badge && res.available ? (
                            <span
                              style={{
                                background: 'linear-gradient(135deg, #FFEDD5 0%, #FEE2E2 100%)',
                                border: '1px solid #FCA5A5',
                                color: '#B91C1C',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                letterSpacing: '0.02em',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span>🔥 {res.badge}</span>
                              {res.promoEndsAt && (
                                <span style={{ fontWeight: 600, opacity: 0.85, fontSize: '0.65rem' }}>
                                  (Ends {new Date(res.promoEndsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})
                                </span>
                              )}
                            </span>
                          ) : res.popular && res.available ? (
                            <span
                              style={{
                                background: '#FFF9D6',
                                color: '#A2700C',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                              }}
                            >
                              Popular
                            </span>
                          ) : null}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '3px' }}>
                          {res.available ? 'Free DNS & Mail Forwarding included' : 'Registered by another entity'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {res.available ? (
                          <>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4F7C12', marginBottom: '4px' }}>
                              {formatPrice(res.priceUsd)}
                              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>/yr</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRegister(res)}
                              className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700 }}
                            >
                              {isAdded ? '✓ Added!' : 'Select →'}
                            </button>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>Unavailable</span>
                            <Link
                              href={`/domains/transfer?domain=${encodeURIComponent(res.domain)}`}
                              style={{
                                display: 'inline-block',
                                background: 'transparent',
                                border: '1px solid #CBD5E1',
                                color: '#10708A',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Transfer →
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
