import React, { useState, useEffect, useCallback, useRef } from "react";
import { BarChart2, TrendingUp, Star, Check, Filter, Activity, Bot, Search, Users, Play, X } from "lucide-react";
import { getCallAnalytics, getConversionMetrics, getBotPerformance } from "api/backend/genie";
import { getConsumers } from "api/backend/consumers";
import { getAllBots } from "api/backend/genie";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import toast from "react-hot-toast";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function AnalyticsTab() {
  // State
  const [period, setPeriod] = useState("week");
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [conversionMetrics, setConversionMetrics] = useState(null);
  const [botPerformance, setBotPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [selectedConsumerId, setSelectedConsumerId] = useState("");
  const [selectedConsumerName, setSelectedConsumerName] = useState("");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [consumerSearchInput, setConsumerSearchInput] = useState("");
  const [consumerSearchQuery, setConsumerSearchQuery] = useState("");
  const [consumers, setConsumers] = useState([]);
  const [showConsumerSuggestions, setShowConsumerSuggestions] = useState(false);
  const [loadingConsumers, setLoadingConsumers] = useState(false);
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);
  const [analyticsStarted, setAnalyticsStarted] = useState(false);

  // Debounce consumer search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setConsumerSearchQuery(consumerSearchInput);
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [consumerSearchInput]);

  // Fetch consumers when search query changes
  useEffect(() => {
    const fetchConsumers = async () => {
      if (!consumerSearchQuery || consumerSearchQuery.length < 2) {
        setConsumers([]);
        setShowConsumerSuggestions(false);
        return;
      }

      setLoadingConsumers(true);
      try {
        const result = await getConsumers({ search: consumerSearchQuery });
        if (result && !result.error && Array.isArray(result)) {
          setConsumers(result);
          setShowConsumerSuggestions(result.length > 0);
        } else {
          setConsumers([]);
          setShowConsumerSuggestions(false);
        }
      } catch (error) {
        console.error("Error fetching consumers:", error);
        setConsumers([]);
        setShowConsumerSuggestions(false);
      } finally {
        setLoadingConsumers(false);
      }
    };

    fetchConsumers();
  }, [consumerSearchQuery]);

  // Fetch bots - all bots if no consumer selected, filtered by consumer if selected
  useEffect(() => {
    const fetchBots = async () => {
      setLoadingBots(true);
      try {
        const params = selectedConsumerId ? { ownerUserId: selectedConsumerId } : {};
        const response = await getAllBots(params);
        if (!response?.error) {
          const fetchedBots = response?.data || [];
          setBots(fetchedBots);
        } else {
          setBots([]);
        }
      } catch (error) {
        console.error("Error fetching bots:", error);
        setBots([]);
      } finally {
        setLoadingBots(false);
      }
    };

    fetchBots();
  }, [selectedConsumerId]);

  // Clear bot selection if selected bot is no longer in the list
  useEffect(() => {
    if (selectedBotId && bots.length > 0 && !bots.find(bot => bot.id === selectedBotId)) {
      setSelectedBotId("");
    }
  }, [bots, selectedBotId]);

  // Fetch all analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setAnalyticsStarted(true);
    try {
      const params = {
        period,
        ownerUserId: selectedConsumerId || undefined,
        botId: selectedBotId || undefined,
      };

      const [analyticsRes, conversionRes, botsRes] = await Promise.all([
        getCallAnalytics(params),
        getConversionMetrics(params),
        getBotPerformance(params),
      ]);

      if (!analyticsRes?.error) setCallAnalytics(analyticsRes?.data);
      if (!conversionRes?.error) setConversionMetrics(conversionRes?.data);
      if (!botsRes?.error) setBotPerformance(botsRes?.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, [period, selectedConsumerId, selectedBotId]);

  const hasInitialFetch = useRef(false);

  // Initial fetch on mount (show all users by default) and auto-refresh when filters change
  useEffect(() => {
    if (!hasInitialFetch.current) {
      // Initial fetch on mount
      hasInitialFetch.current = true;
      fetchAnalytics();
    } else {
      // Auto-refresh when filters change
      fetchAnalytics();
    }
  }, [period, selectedConsumerId, selectedBotId, fetchAnalytics]);

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: {
        grid: { display: false }
      }
    },
  };

  // Call volume chart data
  const callVolumeData = {
    labels: callAnalytics?.chartData?.map(d => d.date) || [],
    datasets: [
      {
        label: 'Total Calls',
        data: callAnalytics?.chartData?.map(d => d.total) || [],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Completed',
        data: callAnalytics?.chartData?.map(d => d.completed) || [],
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Leads',
        data: callAnalytics?.chartData?.map(d => d.leads) || [],
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };

  // Conversion funnel data
  const funnelData = {
    labels: conversionMetrics?.funnel?.map(f => f.stage) || [],
    datasets: [
      {
        data: conversionMetrics?.funnel?.map(f => f.count) || [],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(245, 158, 11, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  // Bot performance data
  const botPerformanceData = {
    labels: botPerformance?.bots?.map(b => b.botName?.substring(0, 15)) || [],
    datasets: [
      {
        label: 'Total Calls',
        data: botPerformance?.bots?.map(b => b.totalCalls) || [],
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderRadius: 6,
      },
      {
        label: 'Leads',
        data: botPerformance?.bots?.map(b => b.leads) || [],
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderRadius: 6,
      },
    ],
  };

  const getPeriodLabel = () => {
    switch(period) {
      case 'week': return '7 days';
      case 'month': return '30 days';
      case 'quarter': return '90 days';
      default: return period;
    }
  };

  // Handle consumer selection
  const handleConsumerSelect = (consumer) => {
    setSelectedConsumerId(consumer.user_id);
    setSelectedConsumerName(consumer.full_name || consumer.email);
    setConsumerSearchInput(consumer.full_name || consumer.email);
    setShowConsumerSuggestions(false);
    setConsumers([]);
    setSelectedBotId(""); // Reset bot selection when consumer changes
  };

  // Clear consumer selection
  const clearConsumerSelection = () => {
    setSelectedConsumerId("");
    setSelectedConsumerName("");
    setConsumerSearchInput("");
    setSelectedBotId("");
    setBots([]);
    // Analytics will auto-refresh via useEffect when selectedConsumerId changes
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        gap: '16px'
      }}>
        <div>
          <h5 style={{
            margin: '0 0 4px 0',
            fontWeight: '600',
            fontSize: '18px',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BarChart2 size={20} style={{ color: '#74317e' }} />
            Analytics Dashboard
          </h5>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Track your call campaign performance
          </p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['week', 'month', 'quarter'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '10px 16px',
                border: period === p ? 'none' : '1px solid #74317e',
                borderRadius: '8px',
                backgroundColor: period === p ? '#74317e' : 'white',
                color: period === p ? 'white' : '#74317e',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {p === 'week' ? '7 Days' : p === 'month' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Section */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          {/* Consumer Selection */}
          <div style={{ flex: '1 1 300px', minWidth: '250px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Consumer
            </label>
            <div style={{ position: 'relative' }}>
              <Users size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', zIndex: 1 }} />
              {selectedConsumerId && (
                <X 
                  size={16} 
                  onClick={clearConsumerSelection}
                  style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: '#9ca3af',
                    cursor: 'pointer',
                    zIndex: 2
                  }} 
                />
              )}
              <input
                type="text"
                placeholder="Search consumer name or email..."
                value={consumerSearchInput}
                onChange={(e) => {
                  setConsumerSearchInput(e.target.value);
                  if (!e.target.value) {
                    clearConsumerSelection();
                  }
                }}
                onFocus={() => {
                  if (consumerSearchInput && consumers.length > 0) {
                    setShowConsumerSuggestions(true);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  paddingRight: selectedConsumerId ? '36px' : '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {showConsumerSuggestions && consumers.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {consumers.map((consumer) => (
                    <div
                      key={consumer.user_id}
                      onClick={() => handleConsumerSelect(consumer)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                        {consumer.full_name || 'No Name'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {consumer.email}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bot Selection */}
          <div style={{ flex: '0 1 250px', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Agent
            </label>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              disabled={loadingBots}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: loadingBots ? '#f8fafc' : 'white',
                cursor: loadingBots ? 'not-allowed' : 'pointer',
                color: loadingBots ? '#9ca3af' : '#1e293b'
              }}
            >
              <option value="">All Agents</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}{bot.owner_name ? ` - (${bot.owner_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Analytics Button */}
          <div>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              style={{
                background: !loading
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                color: !loading ? 'white' : '#9ca3af',
                fontSize: '14px',
                fontWeight: '500',
                cursor: !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Loading...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Click outside to close suggestions */}
      {showConsumerSuggestions && (
        <div
          onClick={() => setShowConsumerSuggestions(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
        />
      )}

      {loading && analyticsStarted && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #f1f5f9',
            borderTopColor: '#74317e',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading analytics...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {loading && !analyticsStarted && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #f1f5f9',
            borderTopColor: '#74317e',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading analytics...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {analyticsStarted && !loading && (
        <>
      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Completion Rate</p>
              <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>{conversionMetrics?.completionRate || 0}%</h3>
            </div>
            <div style={{
              width: '50px',
              height: '50px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Check size={24} />
            </div>
              </div>
              </div>

        <div style={{
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Lead Conversion</p>
              <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>{conversionMetrics?.conversionRate || 0}%</h3>
            </div>
            <div style={{
              width: '50px',
              height: '50px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Star size={24} />
            </div>
              </div>
              </div>

        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Total Leads ({getPeriodLabel()})</p>
              <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>{conversionMetrics?.funnel?.[2]?.count || 0}</h3>
            </div>
            <div style={{
              width: '50px',
              height: '50px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={24} />
            </div>
          </div>
              </div>
              </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Call Volume Chart */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h6 style={{
            margin: '0 0 16px 0',
            fontWeight: '600',
            fontSize: '15px',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Activity size={16} style={{ color: '#667eea' }} />
                Call Volume Over Time
              </h6>
              <div style={{ height: '280px' }}>
                {callAnalytics?.chartData?.length > 0 ? (
                  <Line data={callVolumeData} options={chartOptions} />
                ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#94a3b8'
              }}>
                <Activity size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No data available for this period</p>
                  </div>
                )}
              </div>
        </div>

        {/* Conversion Funnel */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h6 style={{
            margin: '0 0 16px 0',
            fontWeight: '600',
            fontSize: '15px',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Filter size={16} style={{ color: '#22c55e' }} />
                Conversion Funnel
              </h6>
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {conversionMetrics?.funnel?.some(f => f.count > 0) ? (
                  <Doughnut 
                    data={funnelData} 
                    options={{
                      ...chartOptions,
                      cutout: '65%',
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: { padding: 15, usePointStyle: true }
                        },
                      },
                    }} 
                  />
                ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8'
              }}>
                <Filter size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No data available</p>
                  </div>
                )}
              </div>
        </div>
      </div>

      {/* Bot Performance Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '16px'
      }}>
        {/* Bot Performance Chart */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h6 style={{
            margin: '0 0 16px 0',
            fontWeight: '600',
            fontSize: '15px',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BarChart2 size={16} style={{ color: '#f59e0b' }} />
                Bot Performance Comparison
              </h6>
              <div style={{ height: '280px' }}>
                {botPerformance?.bots?.length > 0 ? (
                  <Bar data={botPerformanceData} options={chartOptions} />
                ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#94a3b8'
              }}>
                <Bot size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No bot performance data available</p>
                  </div>
                )}
              </div>
        </div>

        {/* Bot Stats Table */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h6 style={{
            margin: '0 0 16px 0',
            fontWeight: '600',
            fontSize: '15px',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Bot size={16} style={{ color: '#667eea' }} />
                Bot Statistics
              </h6>
              {botPerformance?.bots?.length > 0 ? (
                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {botPerformance.bots.map((bot, index) => (
                    <div 
                      key={index} 
                      style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                          {bot.botName?.substring(0, 20)}{bot.botName?.length > 20 ? '...' : ''}
                        </div>
                    <small style={{ color: '#64748b', fontSize: '12px' }}>{bot.totalCalls} calls</small>
                      </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ 
                      backgroundColor: parseFloat(bot.successRate) >= 50 ? '#dcfce7' : '#fef3c7',
                            color: parseFloat(bot.successRate) >= 50 ? '#166534' : '#92400e',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                          {bot.successRate}%
                    </span>
                    <span style={{ 
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                          {bot.leads} leads
                    </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: '#94a3b8'
            }}>
              <Bot size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No bots data available</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .analytics-charts-row {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AnalyticsTab;
