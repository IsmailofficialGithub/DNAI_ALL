import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Container, Row, Col, Card, Table } from 'react-bootstrap';
import { Store, ArrowLeft, DollarSign, FileText, Filter, Calendar, TrendingUp } from 'lucide-react';
import { getResellerStats } from '../api/backend';
import toast from 'react-hot-toast';

const ResellerStatistics = () => {
  const history = useHistory();
  
  const [stats, setStats] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState('paid');
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    fetchResellerStats();
  }, [month, year, status, limit]);

  const fetchResellerStats = async () => {
    setLoading(true);
    try {
      const result = await getResellerStats({
        month,
        year,
        status,
        limit
      });
      
      if (result && result.success && result.data) {
        setStats(result.data.stats || []);
        setSummary(result.data.summary || null);
      } else {
        toast.error(result?.error || 'Failed to load reseller statistics');
      }
    } catch (error) {
      console.error('Error fetching reseller stats:', error);
      toast.error('Failed to load reseller statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount);
  };

  const getMonthName = (monthNum) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNum - 1] || '';
  };

  const generateMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
      <option key={m} value={m}>{getMonthName(m)}</option>
    ));
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years.map(y => (
      <option key={y} value={y}>{y}</option>
    ));
  };

  return (
    <Container fluid style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => history.push('/admin/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#74317e';
              e.currentTarget.style.color = '#74317e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.color = '#666';
            }}
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Store size={28} color="#74317e" />
              Reseller Business Statistics
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              Track reseller performance and revenue by month
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
          <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={20} />
            Filters
          </h5>
        </Card.Header>
        <Card.Body style={{ padding: '20px' }}>
          <Row>
            <Col md={3}>
              <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                {generateMonthOptions()}
              </select>
            </Col>
            <Col md={3}>
              <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                {generateYearOptions()}
              </select>
            </Col>
            <Col md={3}>
              <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                Invoice Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
                <option value="all">All Status</option>
              </select>
            </Col>
            <Col md={3}>
              <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                Limit Results
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="10">Top 10</option>
                <option value="25">Top 25</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
                <option value="999">All</option>
              </select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Card */}
      {summary && (
        <Row style={{ marginBottom: '24px' }}>
          <Col md={4}>
            <Card style={{ border: '2px solid #74317e', borderRadius: '12px' }}>
              <Card.Body style={{ padding: '20px', textAlign: 'center' }}>
                <DollarSign size={32} color="#74317e" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                  TOTAL REVENUE
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#74317e' }}>
                  {formatCurrency(summary.total_revenue)}
                </div>
                <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                  {getMonthName(summary.month)} {summary.year}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card style={{ border: '2px solid #8b5cf6', borderRadius: '12px' }}>
              <Card.Body style={{ padding: '20px', textAlign: 'center' }}>
                <Store size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                  ACTIVE RESELLERS
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>
                  {summary.total_resellers}
                </div>
                <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                  With {summary.status} invoices
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card style={{ border: '2px solid #10b981', borderRadius: '12px' }}>
              <Card.Body style={{ padding: '20px', textAlign: 'center' }}>
                <FileText size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                  TOTAL INVOICES
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
                  {summary.total_invoices}
                </div>
                <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                  {summary.status} status
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Resellers Table */}
      <Card>
        <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
          <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} />
            Top Resellers by Revenue ({getMonthName(month)} {year})
          </h5>
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #74317e',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
              <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading statistics...</p>
            </div>
          ) : stats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Store size={48} color="#d1d5db" style={{ marginBottom: '16px' }} />
              <p style={{ color: '#6c757d', fontSize: '16px' }}>No reseller statistics found</p>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped hover style={{ margin: 0 }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                      Rank
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                      Reseller Name
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                      Email
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>
                      Total Revenue
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>
                      Invoice Count
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>
                      Avg. Invoice Value
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', textAlign: 'center', width: '100px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((reseller, index) => {
                    const avgInvoiceValue = reseller.invoice_count > 0 
                      ? reseller.total_revenue / reseller.invoice_count 
                      : 0;
                    
                    return (
                      <tr key={reseller.reseller_id}>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {index === 0 && <span style={{ fontSize: '20px' }}>🏆</span>}
                            {index === 1 && <span style={{ fontSize: '18px' }}>🥈</span>}
                            {index === 2 && <span style={{ fontSize: '18px' }}>🥉</span>}
                            <span style={{ 
                              fontSize: '16px', 
                              fontWeight: '700', 
                              color: index < 3 ? '#74317e' : '#6b7280',
                              minWidth: '30px',
                              display: 'inline-block'
                            }}>
                              #{index + 1}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                            {reseller.reseller_name || 'Unknown'}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>
                            {reseller.reseller_email || 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#74317e' }}>
                            {formatCurrency(reseller.total_revenue)}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 12px',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#0369a1'
                          }}>
                            <FileText size={12} />
                            {reseller.invoice_count}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                            {formatCurrency(avgInvoiceValue)}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <button
                            onClick={() => history.push(`/admin/reseller/${reseller.reseller_id}/earnings`)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              border: '1px solid #f59e0b',
                              borderRadius: '6px',
                              backgroundColor: '#fef3c7',
                              color: '#f59e0b',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              minWidth: '80px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f59e0b';
                              e.currentTarget.style.color = 'white';
                              e.currentTarget.style.borderColor = '#f59e0b';
                              e.currentTarget.style.transform = 'translateX(2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fef3c7';
                              e.currentTarget.style.color = '#f59e0b';
                              e.currentTarget.style.borderColor = '#f59e0b';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }}
                          >
                            <TrendingUp size={14} />
                            Earnings
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Container>
  );
};

export default ResellerStatistics;

