import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getErrorLogs, getErrorLogCount, type ErrorLogRow } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Search, RefreshCw, Calendar, User, Monitor, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ERROR_LOG_KEY = import.meta.env.VITE_ERROR_LOG_KEY || "";

export default function HealthCheck() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorLogs, setErrorLogs] = useState<ErrorLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [userId, setUserId] = useState<string>(searchParams.get("uid") || "");
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const itemsPerPage = 50;

  const loadErrorLogs = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    try {
      const searchUserId = userId.trim() || undefined;
      const [logs, count] = await Promise.all([
        getErrorLogs(searchUserId || null, itemsPerPage, currentPage * itemsPerPage),
        getErrorLogCount(searchUserId || null),
      ]);
      setErrorLogs(logs);
      setTotalCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load error logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadErrorLogs();
    }
  }, [currentPage, isAuthenticated]);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    
    if (!ERROR_LOG_KEY) {
      setKeyError("Error log key is not configured. Please contact administrator.");
      return;
    }
    
    if (accessKey.trim() === ERROR_LOG_KEY) {
      setIsAuthenticated(true);
      setKeyError(null);
    } else {
      setKeyError("Invalid access key. Please enter the correct key.");
      setAccessKey("");
    }
  };

  useEffect(() => {
    // Update URL when userId changes
    if (userId.trim()) {
      setSearchParams({ uid: userId.trim() });
    } else {
      setSearchParams({});
    }
  }, [userId, setSearchParams]);

  const handleSearch = () => {
    setCurrentPage(0);
    loadErrorLogs();
  };

  const handleClear = () => {
    setUserId("");
    setCurrentPage(0);
    setSearchParams({});
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const truncateText = (text: string | null, maxLength: number = 200) => {
    if (!text) return "No details";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Access Error Logs</CardTitle>
              </div>
              <CardDescription>
                Enter the access key to view error logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleKeySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessKey">Access Key</Label>
                  <Input
                    id="accessKey"
                    type="password"
                    placeholder="Enter access key"
                    value={accessKey}
                    onChange={(e) => {
                      setAccessKey(e.target.value);
                      setKeyError(null);
                    }}
                    className="font-mono"
                    autoFocus
                  />
                </div>
                {keyError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{keyError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full">
                  Access Error Logs
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Health Check</h1>
            <p className="text-muted-foreground mt-2">
              View and search error logs from the application
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setIsAuthenticated(false);
              setAccessKey("");
              setErrorLogs([]);
              setTotalCount(0);
              setUserId("");
              setCurrentPage(0);
            }}
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock Access
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Error Logs</CardTitle>
            <CardDescription>
              Search by user ID (uid) to view specific user error logs, or leave empty to see all errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="userId">User ID (uid)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="userId"
                    placeholder="Enter user ID to filter..."
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={loading}>
                Clear
              </Button>
              <Button variant="outline" onClick={loadErrorLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Error Logs</CardTitle>
                <CardDescription>
                  {totalCount > 0
                    ? `Showing ${currentPage * itemsPerPage + 1}-${Math.min(
                        (currentPage + 1) * itemsPerPage,
                        totalCount
                      )} of ${totalCount} errors`
                    : "No errors found"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
              </div>
            ) : errorLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No error logs found</p>
                {userId && (
                  <p className="text-sm mt-2">Try a different user ID or clear the search</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {errorLogs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-l-destructive">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-foreground mb-2">
                              {log.error_heading}
                            </h3>
                            {log.error_details && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                {truncateText(log.error_details, 500)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(log.created_date)}</span>
                          </div>
                          {log.user_id && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="font-mono text-xs">{log.user_id}</span>
                            </div>
                          )}
                          {log.platform && (
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              <span className="text-xs max-w-md truncate">{log.platform}</span>
                            </div>
                          )}
                        </div>
                        {log.error_details && log.error_details.length > 500 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-primary hover:underline">
                              Show full error details
                            </summary>
                            <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-96 whitespace-pre-wrap break-words">
                              {log.error_details}
                            </pre>
                          </details>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0 || loading}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1 || loading}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
