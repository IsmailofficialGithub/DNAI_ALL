import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  BarChart3,
  Database,
  ChevronDown,
  Eye,
  Trash2,
  RefreshCw,
  Loader2
} from "lucide-react";
import { listAnalysis, listSearchQueries, listBrands, deleteSearchQuery, type AnalysisRow, type UserSearchQueryRow, type BrandRow } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";

type ReportType = 'analysis' | 'search_queries';

export default function Reports() {
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [reportType, setReportType] = useState<ReportType>('analysis');
  const [searchTerm, setSearchTerm] = useState('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [analysisReports, setAnalysisReports] = useState<AnalysisRow[]>([]);
  const [searchQueries, setSearchQueries] = useState<UserSearchQueryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AnalysisRow | UserSearchQueryRow | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedBrand, reportType]);

  const fetchBrands = async () => {
    try {
      const data = await listBrands();
      setBrands(data);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast({
        title: "Error",
        description: "Failed to fetch brands",
        variant: "destructive"
      });
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (reportType === 'analysis') {
        const data = await listAnalysis();
        setAnalysisReports(data);
      } else {
        const brandId = selectedBrand === 'all' ? undefined : selectedBrand;
        const data = await listSearchQueries(brandId);
        setSearchQueries(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSearchQuery = async (id: string) => {
    try {
      await deleteSearchQuery(id);
      toast({
        title: "Success",
        description: "Search query deleted successfully"
      });
      fetchReports(); // Refresh the list
    } catch (error) {
      console.error('Error deleting search query:', error);
      toast({
        title: "Error",
        description: "Failed to delete search query",
        variant: "destructive"
      });
    }
  };

  const getFilteredReports = () => {
    const reports = reportType === 'analysis' ? analysisReports : searchQueries;
    return reports.filter(report => {
      const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBrand = selectedBrand === 'all' || report.brand_id === selectedBrand;
      return matchesSearch && matchesBrand;
    });
  };

  const getBrandName = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    return brand?.name || 'Unknown Brand';
  };

  const filteredReports = getFilteredReports();

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-primary">Reports</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">View and manage your analysis reports</p>
          </div>
          <Button onClick={fetchReports} disabled={loading} variant="outline" className="gap-2 w-full sm:w-auto text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <GlassCard className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Brand Selector */}
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Brand</label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {brand.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Report Type */}
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Report Type</label>
              <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analysis">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analysis Reports
                    </div>
                  </SelectItem>
                  <SelectItem value="search_queries">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Search Queries
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Reports List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredReports.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'No reports match your search criteria.' : 'No reports available for the selected brand.'}
              </p>
            </GlassCard>
          ) : (
            <div className="grid gap-4">
              {filteredReports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{report.title}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {getBrandName(report.brand_id)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(parseISO(report.created_at), 'MMM d, yyyy • h:mm a')}
                          </div>
                          <Badge variant="outline">
                            {reportType === 'analysis' ? 'Analysis' : 'Search Query'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            setShowReportDialog(true);
                          }}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        {reportType === 'search_queries' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSearchQuery(report.id)}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Report Dialog */}
        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {selectedReport && (
              <>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {selectedReport.title}
                  </DialogTitle>
                  <DialogDescription>
                    {getBrandName(selectedReport.brand_id)} • {format(parseISO(selectedReport.created_at), 'MMMM d, yyyy • h:mm a')}
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-y-auto px-1">
                  <div className="pr-4">
                    {reportType === 'analysis' ? (
                      <div 
                        className="analysis-content prose max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: (selectedReport as AnalysisRow).html_content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        }}
                      />
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Query Details</h3>
                          <div className="bg-muted/50 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-2">Client Query:</p>
                            <p className="font-medium">{(selectedReport as UserSearchQueryRow).client_query}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Payload Data</h3>
                          <div className="bg-muted/50 rounded-lg p-4">
                            <pre className="text-sm overflow-x-auto">
                              {JSON.stringify((selectedReport as UserSearchQueryRow).payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
