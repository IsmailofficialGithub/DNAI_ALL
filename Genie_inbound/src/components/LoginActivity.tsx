import React, { useState, useEffect } from 'react';
import { Activity, Monitor, MapPin, Clock, LogOut, AlertCircle, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface LoginActivity {
  id: string;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  device_name: string | null;
  browser_name: string | null;
  os_name: string | null;
  location_country: string | null;
  location_city: string | null;
  login_method: string;
  success: boolean;
  failure_reason: string | null;
  login_at: string;
  logout_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

const LoginActivity: React.FC = () => {
  const { user, session } = useAuth();
  const [activities, setActivities] = useState<LoginActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (user) {
      loadLoginActivity();
    }
  }, [user, page]);

  const loadLoginActivity = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from('login_activity')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get paginated data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError } = await supabase
        .from('login_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('login_at', { ascending: false })
        .range(from, to);

      if (fetchError) {
        throw fetchError;
      }

      setActivities(data || []);
    } catch (err: any) {
      console.error('Error loading login activity:', err);
      setError(err.message || 'Failed to load login activity');
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getDeviceInfo = (activity: LoginActivity): string => {
    const parts: string[] = [];
    if (activity.device_type) parts.push(activity.device_type);
    if (activity.os_name) parts.push(activity.os_name);
    if (activity.browser_name) parts.push(activity.browser_name);
    return parts.length > 0 ? parts.join(' • ') : 'Unknown Device';
  };

  const activeSessions = activities.filter(a => a.is_active);
  const currentSessionId = session?.access_token;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Login Activity & Sessions
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Monitor and manage your account's login sessions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Active Sessions: </span>
                <span className="font-semibold text-foreground">{activeSessions.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Logins: </span>
                <span className="font-semibold text-foreground">{activities.length}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No login activity found</p>
              </div>
            ) : (
              activities.map((activity) => {
                const isCurrentSession = activity.session_id === currentSessionId;
                const isActive = activity.is_active;

                return (
                  <Card key={activity.id} className={isActive ? 'border-primary' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            {isActive ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <XCircle className="w-3 h-3 mr-1" />
                                Ended
                              </Badge>
                            )}
                            {isCurrentSession && (
                              <Badge variant="default">
                                Current Session
                              </Badge>
                            )}
                            {!activity.success && (
                              <Badge variant="destructive">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-start gap-2">
                              <Monitor className="w-4 h-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Device</p>
                                <p className="text-foreground font-medium">
                                  {getDeviceInfo(activity)}
                                </p>
                                {activity.device_name && (
                                  <p className="text-xs text-muted-foreground">{activity.device_name}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Location</p>
                                <p className="text-foreground font-medium">
                                  {activity.location_city && activity.location_country
                                    ? `${activity.location_city}, ${activity.location_country}`
                                    : activity.location_country || 'Unknown'}
                                </p>
                                {activity.ip_address && (
                                  <p className="text-xs text-muted-foreground font-mono">{activity.ip_address}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Login Time</p>
                                <p className="text-foreground font-medium">
                                  {formatRelativeTime(activity.login_at)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(activity.login_at)}
                                </p>
                              </div>
                            </div>

                            {activity.logout_at && (
                              <div className="flex items-start gap-2">
                                <LogOut className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                <div>
                                  <p className="text-muted-foreground">Logout Time</p>
                                  <p className="text-foreground font-medium">
                                    {formatRelativeTime(activity.logout_at)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(activity.logout_at)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {activity.failure_reason && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                              <p className="text-destructive font-medium">Failure Reason:</p>
                              <p className="text-destructive/80">{activity.failure_reason}</p>
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            <p>Method: <span className="font-medium capitalize">{activity.login_method}</span></p>
                            {activity.user_agent && (
                              <p className="mt-1 truncate" title={activity.user_agent}>
                                User Agent: {activity.user_agent}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-medium text-foreground">
                  {Math.min(page * pageSize, totalCount)}
                </span>{' '}
                of <span className="font-medium text-foreground">{totalCount}</span> results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1)
                    .filter(p => {
                      // Show first, last, and pages around current
                      const totalPages = Math.ceil(totalCount / pageSize);
                      return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                    })
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={page === p ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      </React.Fragment>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                  disabled={page === Math.ceil(totalCount / pageSize)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginActivity;
