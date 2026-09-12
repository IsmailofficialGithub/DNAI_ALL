import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  History as HistoryIcon, 
  Search, 
  Send, 
  Calendar, 
  Trash2, 
  Eye, 
  Clock,
  Building2,
  Filter,
  RefreshCw,
  Loader2
} from "lucide-react";
import { 
  listPosts, 
  listSearchQueries, 
  deleteSearchQuery,
  type DbPostRow, 
  type UserSearchQueryRow,
  type BrandRow,
  listBrands
} from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const [activeTab, setActiveTab] = useState("posts");
  const [posts, setPosts] = useState<DbPostRow[]>([]);
  const [searchQueries, setSearchQueries] = useState<UserSearchQueryRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const { toast } = useToast();

  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      const postsData = await listPosts();
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch posts history",
        variant: "destructive",
      });
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchSearchQueries = async () => {
    try {
      setQueriesLoading(true);
      console.log('Fetching search queries for brand:', selectedBrand === "all" ? undefined : selectedBrand);
      const queriesData = await listSearchQueries(selectedBrand === "all" ? undefined : selectedBrand);
      console.log('Search queries data:', queriesData);
      console.log('Number of queries found:', queriesData.length);
      setSearchQueries(queriesData);
    } catch (error) {
      console.error('Error fetching search queries:', error);
      console.error('Error details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch search queries history",
        variant: "destructive",
      });
    } finally {
      setQueriesLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      console.log('Fetching brands...');
      const brandsData = await listBrands();
      console.log('Brands data:', brandsData);
      setBrands(brandsData);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const deleteQuery = async (queryId: string) => {
    try {
      await deleteSearchQuery(queryId);
      setSearchQueries(prev => prev.filter(q => q.id !== queryId));
      toast({
        title: "Success",
        description: "Search query deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting query:', error);
      toast({
        title: "Error",
        description: "Failed to delete search query",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    if (activeTab === "posts") {
      fetchPosts();
    } else {
      fetchSearchQueries();
    }
  }, [activeTab, selectedBrand]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "posted":
      case "scheduled":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "instagram":
        return "📷";
      case "twitter":
      case "x":
        return "🐦";
      case "facebook":
        return "📘";
      case "linkedin":
        return "💼";
      case "tiktok":
        return "🎵";
      case "youtube":
        return "📺";
      default:
        return "📱";
    }
  };

  const filteredPosts = selectedBrand === "all" 
    ? posts 
    : posts.filter(post => {
        // This would need to be implemented based on your post structure
        // For now, return all posts
        return true;
      });

  const filteredQueries = selectedBrand === "all" 
    ? searchQueries 
    : searchQueries.filter(query => query.brand_id === selectedBrand);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="relative dashboard-header-dark">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl backdrop-blur-sm"></div>
          <div className="relative p-8 md:p-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <HistoryIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white">
                  History Dashboard
                </h1>
                <p className="text-lg text-blue-100">
                  View your posts and search query history
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Filter */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Filter by Brand:</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Brands</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === "posts") {
                  fetchPosts();
                } else {
                  fetchSearchQueries();
                }
              }}
              disabled={activeTab === "posts" ? postsLoading : queriesLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(activeTab === "posts" ? postsLoading : queriesLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </GlassCard>

        {/* Tabs */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Posts History ({filteredPosts.length})
            </TabsTrigger>
            <TabsTrigger value="queries" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Queries ({filteredQueries.length})
            </TabsTrigger>
          </TabsList>

          {/* Posts History Tab */}
          <TabsContent value="posts" className="space-y-4">
            <GlassCard className="p-6">
              <div className="space-y-4">
                {postsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading posts...
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No posts found</p>
                  </div>
                ) : (
                  filteredPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">
                          {getPlatformIcon(post.platform)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{post.topic}</h3>
                            <Badge className={getStatusColor(post.status)}>
                              {post.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(post.updated_at || post.created_at || ''), 'MMM d, yyyy h:mm a')}
                            </span>
                            <span className="uppercase font-medium">{post.platform}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Search Queries History Tab */}
          <TabsContent value="queries" className="space-y-4">
            <GlassCard className="p-6">
              <div className="space-y-4">
                {queriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading search queries...
                  </div>
                ) : filteredQueries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No search queries found</p>
                  </div>
                ) : (
                  filteredQueries.map((query) => (
                    <div
                      key={query.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Search className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{query.title}</h3>
                            <Badge variant="outline">
                              {brands.find(b => b.id === query.brand_id)?.name || 'Unknown Brand'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Query: {query.client_query}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(query.created_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteQuery(query.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
