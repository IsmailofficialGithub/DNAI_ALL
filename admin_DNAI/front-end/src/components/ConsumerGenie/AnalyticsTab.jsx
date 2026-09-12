import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart2, TrendingUp, PhoneCall, Target, CheckCircle, Bot } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';

function AnalyticsTab({ consumerId }) {
  const [calls, setCalls] = useState([]);
  const [leads, setLeads] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7'); // 7, 30, or 90 days
  const [selectedBotId, setSelectedBotId] = useState(''); // Selected bot for filtering

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Fetch calls for this consumer
      const callsResponse = await apiClient.genie.getAllCallsByOwnerId(consumerId, {
        page: 1,
        limit: 10000
      });

      // Fetch leads for this consumer
      const leadsResponse = await apiClient.genie.getAllLeads({
        ownerUserId: consumerId,
        page: 1,
        limit: 10000
      });

      // Fetch bots for this consumer
      const botsResponse = await apiClient.genie.getAllBots({
        ownerUserId: consumerId
      });

      console.log('📊 AnalyticsTab fetch results:', {
        consumerId,
        callsResponse: callsResponse?.data?.length || 0,
        leadsResponse: leadsResponse?.data?.length || 0,
        botsResponse: botsResponse?.data?.length || 0
      });

      if (callsResponse?.data && leadsResponse?.data) {
        let callsData = callsResponse.data;
        let leadsData = leadsResponse.data;

        // Filter by selected bot if one is selected
        if (selectedBotId) {
          callsData = callsData.filter(call => call.bot_id === selectedBotId);
          leadsData = leadsData.filter(lead => lead.bot_id === selectedBotId);
        }

        // Filter by date range
        if (period !== 'all') {
          const startDateStr = startDate.toISOString();
          callsData = callsData.filter(call => {
            const callDate = new Date(call.created_at || call.started_at);
            return callDate >= new Date(startDateStr);
          });
          leadsData = leadsData.filter(lead => {
            const leadDate = new Date(lead.created_at);
            return leadDate >= new Date(startDateStr);
          });
        }

        setCalls(callsData);
        setLeads(leadsData);
        setBots(botsResponse?.data || []);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [consumerId, period, selectedBotId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.call_status === 'completed').length;
    const totalLeads = leads.length;
    const completionRate = totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(2) : '0.00';
    const leadConversion = totalCalls > 0 ? ((totalLeads / totalCalls) * 100).toFixed(2) : '0.00';

    return {
      totalCalls,
      completedCalls,
      totalLeads,
      completionRate,
      leadConversion
    };
  }, [calls, leads]);

  // Group calls by date for chart
  const callVolumeData = useMemo(() => {
    const dateMap = {};
    calls.forEach(call => {
      const date = new Date(call.created_at || call.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateMap[date]) {
        dateMap[date] = { total: 0, completed: 0, leads: 0 };
      }
      dateMap[date].total++;
      if (call.call_status === 'completed') {
        dateMap[date].completed++;
      }
    });

    // Also count leads by date
    leads.forEach(lead => {
      const date = new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dateMap[date]) {
        dateMap[date].leads++;
      }
    });

    const sortedDates = Object.keys(dateMap).sort((a, b) => {
      return new Date(a) - new Date(b);
    });

    return sortedDates.map(date => ({
      date,
      ...dateMap[date]
    }));
  }, [calls, leads]);

  // Bot statistics
  const botStats = useMemo(() => {
    const botMap = {};
    
    // Initialize with bot data
    bots.forEach(bot => {
      botMap[bot.id] = {
        id: bot.id,
        name: bot.name || 'Unknown Bot',
        calls: 0,
        completed: 0,
        leads: 0
      };
    });

    // Count calls per bot
    calls.forEach(call => {
      if (call.bot_id && botMap[call.bot_id]) {
        botMap[call.bot_id].calls++;
        if (call.call_status === 'completed') {
          botMap[call.bot_id].completed++;
        }
      }
    });

    // Count leads per bot
    leads.forEach(lead => {
      if (lead.bot_id && botMap[lead.bot_id]) {
        botMap[lead.bot_id].leads++;
      }
    });

    // Calculate completion rates and sort by calls
    return Object.values(botMap)
      .map(bot => ({
        ...bot,
        completionRate: bot.calls > 0 ? ((bot.completed / bot.calls) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.calls - a.calls);
  }, [calls, leads, bots]);

  // Conversion funnel data
  const funnelData = useMemo(() => {
    const total = calls.length;
    const completed = calls.filter(c => c.call_status === 'completed').length;
    const leads = metrics.totalLeads;

    return [
      { stage: 'Total Calls', count: total },
      { stage: 'Completed', count: completed },
      { stage: 'Leads', count: leads }
    ];
  }, [calls, metrics.totalLeads]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #74317e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
        <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Analytics Dashboard
          </h4>
          <p style={{ margin: 0, fontSize: '16px', color: '#6b7280' }}>
            Track your call campaign performance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Bot Selector */}
          <div style={{ minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#6b7280', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Filter by Agent
            </label>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                color: '#111827',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            >
              <option value="">All Agents</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: '7 Days', value: '7' },
              { label: '30 Days', value: '30' },
              { label: '90 Days', value: '90' }
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  padding: '10px 20px',
                  border: period === p.value ? '2px solid #74317e' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: period === p.value ? '#74317e' : 'white',
                  color: period === p.value ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Completion Rate */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', fontWeight: '500' }}>
            Completion Rate
          </div>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#111827' }}>
            {metrics.completionRate}%
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            {metrics.completedCalls} of {metrics.totalCalls} calls completed
          </div>
        </div>

        {/* Lead Conversion */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', fontWeight: '500' }}>
            Lead Conversion
          </div>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#111827' }}>
            {metrics.leadConversion}%
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            {metrics.totalLeads} leads from {metrics.totalCalls} calls
          </div>
        </div>

        {/* Total Leads */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', fontWeight: '500' }}>
            Total Leads ({period} days)
          </div>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#111827' }}>
            {metrics.totalLeads}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            Qualified leads generated
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Call Volume Over Time */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h5 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Call Volume Over Time
          </h5>
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {callVolumeData.length > 0 ? (
              <div style={{ width: '100%', height: '100%' }}>
                {/* Simple bar chart visualization */}
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '250px', gap: '8px', justifyContent: 'space-between' }}>
                  {callVolumeData.map((data, index) => {
                    const maxValue = Math.max(...callVolumeData.map(d => d.total), 1);
                    const height = (data.total / maxValue) * 100;
                    return (
                      <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: '100%',
                          height: `${height}%`,
                          backgroundColor: '#667eea',
                          borderRadius: '4px 4px 0 0',
                          marginBottom: '8px',
                          minHeight: '4px'
                        }} />
                        <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                          {data.date}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827', marginTop: '4px' }}>
                          {data.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '14px' }}>No data available</div>
            )}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h5 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Conversion Funnel
          </h5>
          <div style={{ height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
            {funnelData.map((stage, index) => {
              const maxValue = Math.max(...funnelData.map(s => s.count), 1);
              const width = (stage.count / maxValue) * 100;
              const colors = ['#667eea', '#22c55e', '#f59e0b'];
              return (
                <div key={index} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>{stage.stage}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{stage.count}</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '32px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${width}%`,
                      height: '100%',
                      backgroundColor: colors[index] || '#667eea',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bot Performance Comparison */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '32px'
      }}>
        <h5 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          Bot Performance Comparison
        </h5>
        <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '16px', justifyContent: 'center' }}>
          {botStats.length > 0 ? (
            botStats.map((bot, index) => {
              const maxCalls = Math.max(...botStats.map(b => b.calls), 1);
              const height = (bot.calls / maxCalls) * 100;
              return (
                <div key={bot.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '200px' }}>
                  <div style={{
                    width: '100%',
                    height: `${height}%`,
                    backgroundColor: '#667eea',
                    borderRadius: '8px 8px 0 0',
                    marginBottom: '8px',
                    minHeight: '20px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '8px',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {bot.calls}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', marginTop: '8px' }}>
                    {bot.name.length > 20 ? bot.name.substring(0, 20) + '...' : bot.name}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#9ca3af', fontSize: '14px' }}>No bot data available</div>
          )}
        </div>
      </div>

      {/* Bot Statistics */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h5 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={20} />
          Bot Statistics
        </h5>
        {botStats.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Bot Name</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Calls</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Completion Rate</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Leads</th>
                </tr>
              </thead>
              <tbody>
                {botStats.map((bot) => (
                  <tr key={bot.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 12px', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                      {bot.name}
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>
                      {bot.calls}
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                      {bot.completionRate}%
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>
                      {bot.leads}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
            No bot statistics available
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AnalyticsTab;
