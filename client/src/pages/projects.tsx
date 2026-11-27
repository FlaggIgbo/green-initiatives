import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { getProjects, reset, selectAllProjects } from "../features/projects/projectSlice";
import type { RootState, AppDispatch } from "../app/store";
import { ProjectCard } from "@/components/project-card";
import { ProjectCardSkeleton } from "@/components/project-card-skeleton";
import { MapView } from "@/components/map-view";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useCurrency } from "@/hooks/use-currency";
import { useGeolocation, calculateDistance } from "@/hooks/use-geolocation";
import { useSEO } from "@/hooks/use-seo";
import { LocationSearch, type LocationValue } from "@/components/location-search";
import {
  MapPin,
  Search,
  Filter,
  TrendingUp,
  Users,
  Leaf,
  Droplets,
  Wind,
  Recycle,
} from "lucide-react";

export default function Projects() {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const [search, setSearch] = useState("");

  useSEO({
    title: t.projects.marketplace.title,
    description: t.projects.marketplace.subtitle,
  });

  const [activeTab, setActiveTab] = useState("all");
  const [filterDistance, setFilterDistance] = useState([80]); // 80km ≈ 50 miles
  const [sortBy, setSortBy] = useState("nearest");
  const [showFundedOnly, setShowFundedOnly] = useState(false);
  const [roundUpEnabled, setRoundUpEnabled] = useState(false);
  const [enableGeofencing, setEnableGeofencing] = useState(false);
  const [searchLocation, setSearchLocation] = useState<LocationValue | null>(null);

  // Get user's location
  const {
    location: userLocation,
    locationInfo,
    loading: locationLoading,
    error: locationError,
  } = useGeolocation();

  const projects = useSelector(selectAllProjects);
  const { isLoading, isError, message } = useSelector((state: RootState) => state.project);

  useEffect(() => {
    dispatch(getProjects());

    return () => {
      dispatch(reset());
    };
  }, [dispatch]);

  // Project categories for filtering (memoized to prevent re-creation)
  const categories = useMemo(
    () => [
      { id: "all", label: t.projects.marketplace.categories.all, icon: Leaf },
      { id: "reforestation", label: t.projects.marketplace.categories.reforestation, icon: Leaf },
      { id: "water", label: t.projects.marketplace.categories.water, icon: Droplets },
      { id: "energy", label: t.projects.marketplace.categories.energy, icon: Wind },
      { id: "waste", label: t.projects.marketplace.categories.waste, icon: Recycle },
    ],
    [t],
  );

  // Filter projects based on search and active filters (memoized for performance)
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.title.toLowerCase().includes(search.toLowerCase()) ||
        project.description.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        !showFundedOnly ||
        (project.targetFunding != null &&
          project.targetFunding > 0 &&
          project.currentFunding >= project.targetFunding);

      // Category filtering - using project.status for now as mock data uses it
      const matchesCategory = activeTab === "all" || project.status === activeTab;

      // Geofencing: Filter by distance if enabled and location is available
      let withinDistance = true;
      const referenceLocation = searchLocation?.lat ? searchLocation : userLocation;

      if (enableGeofencing && referenceLocation && project.location) {
        const dist = calculateDistance(referenceLocation, {
          lat: project.location.lat,
          lng: project.location.lng,
        });
        withinDistance = dist <= filterDistance[0];
      }

      return matchesSearch && matchesStatus && withinDistance && matchesCategory;
    });
  }, [
    projects,
    search,
    showFundedOnly,
    activeTab,
    enableGeofencing,
    userLocation,
    searchLocation,
    filterDistance,
  ]);

  // Impact statistics (memoized derived state)
  const impactStats = useMemo(
    () => ({
      totalProjects: projects.length,
      activeFunding: projects.reduce((sum, p) => sum + (p.currentFunding ?? 0), 0),
      treesPlanted: 1250, // TODO: Calculate from completed projects
      communityMembers: 324,
    }),
    [projects],
  );

  const renderImpactStats = () => {
    if (isLoading && projects.length === 0) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2 p-4 md:p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">
              {t.projects.marketplace.activeProjects}
            </CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{impactStats.totalProjects}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">
              {t.projects.marketplace.totalFunding}
            </CardDescription>
            <CardTitle className="text-2xl md:text-3xl">
              {formatCurrency(impactStats.activeFunding ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">
              {t.projects.marketplace.treesPlanted}
            </CardDescription>
            <CardTitle className="text-2xl md:text-3xl flex items-center gap-1 md:gap-2">
              <Leaf className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              {impactStats.treesPlanted}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">
              {t.projects.marketplace.communityMembers}
            </CardDescription>
            <CardTitle className="text-2xl md:text-3xl flex items-center gap-1 md:gap-2">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              {impactStats.communityMembers}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-destructive p-8 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="font-semibold mb-2">{t.errors.loadingProjects}</p>
          <p className="text-sm">{message || t.errors.unexpectedError}</p>
          <Button onClick={() => dispatch(getProjects())} variant="outline" className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Header Section */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">{t.projects.marketplace.title}</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            {t.projects.marketplace.subtitle}
          </p>
        </div>

        {/* Impact Stats */}
        {renderImpactStats()}
      </div>

      {/* Round-Up Feature Banner */}
      {!roundUpEnabled && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <TrendingUp className="h-5 w-5" />
                  {t.projects.marketplace.roundUp.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t.projects.marketplace.roundUp.description}
                </CardDescription>
              </div>
              <Button onClick={() => setRoundUpEnabled(true)} className="w-full sm:w-auto">
                {t.projects.marketplace.roundUp.enableNow}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="project-search"
                  name="project-search"
                  placeholder={t.projects.marketplace.search.placeholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Address Search */}
              <div className="flex-1">
                <LocationSearch
                  onLocationSelect={(loc) => {
                    setSearchLocation(loc);
                    if (loc) setEnableGeofencing(true);
                  }}
                  placeholder="Search by address (e.g. New York, CA)..."
                />
              </div>
            </div>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={t.projects.marketplace.search.sortBy} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nearest">{t.projects.marketplace.search.nearest}</SelectItem>
                <SelectItem value="trending">{t.projects.marketplace.search.trending}</SelectItem>
                <SelectItem value="newest">{t.projects.marketplace.search.newest}</SelectItem>
                <SelectItem value="funding">{t.projects.marketplace.search.funding}</SelectItem>
                <SelectItem value="impact">{t.projects.marketplace.search.impact}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t.projects.marketplace.filters.title}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Distance Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(filterDistance[0] * 0.621371)} miles ({filterDistance[0]} km)
                  </span>
                </div>
                <Slider
                  id="distance-slider"
                  value={filterDistance}
                  onValueChange={setFilterDistance}
                  max={160}
                  min={8}
                  step={8}
                  className="w-full"
                  disabled={(!userLocation && !searchLocation) || !enableGeofencing}
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Show projects within {Math.round(filterDistance[0] * 0.621371)} miles of your
                    selected location
                  </p>
                  {locationLoading && !searchLocation && (
                    <p className="text-xs text-blue-600">📍 Detecting your location...</p>
                  )}
                  {(locationInfo || searchLocation) && !locationLoading && (
                    <p className="text-xs text-green-600">
                      ✓ Using:{" "}
                      {searchLocation
                        ? searchLocation.address
                        : locationInfo?.city && locationInfo?.country
                          ? `${locationInfo.city}, ${locationInfo.country}`
                          : "My Location"}
                    </p>
                  )}
                  {locationError && !searchLocation && (
                    <p className="text-xs text-amber-600">⚠️ {locationError}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      id="enable-geofencing"
                      checked={enableGeofencing}
                      onCheckedChange={setEnableGeofencing}
                      disabled={!userLocation && !searchLocation}
                    />
                    <Label htmlFor="enable-geofencing" className="text-xs cursor-pointer">
                      Enable geofencing (50-mile radius)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Funding Status Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="funded-only">{t.projects.marketplace.filters.fundedOnly}</Label>
                  <Switch
                    id="funded-only"
                    checked={showFundedOnly}
                    onCheckedChange={setShowFundedOnly}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.projects.marketplace.filters.fundedOnlyDescription}
                </p>
              </div>

              {/* Round-Up Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="round-up">{t.projects.marketplace.filters.roundUpEnabled}</Label>
                  <Switch
                    id="round-up"
                    checked={roundUpEnabled}
                    onCheckedChange={setRoundUpEnabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {roundUpEnabled
                    ? t.projects.marketplace.roundUp.enabled
                    : t.projects.marketplace.roundUp.disabled}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger key={category.id} value={category.id} className="gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{category.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map((category) => (
          <TabsContent
            key={category.id}
            value={category.id}
            className="space-y-4 sm:space-y-6 mt-4 sm:mt-6"
          >
            {/* Interactive Map View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t.projects.marketplace.map.title}
                </h2>
                <Badge variant="outline" className="text-xs shrink-0">
                  {interpolate(t.projects.marketplace.map.projectsInArea, {
                    count: filteredProjects.length,
                  })}
                </Badge>
              </div>
              <MapView
                projects={filteredProjects}
                className="rounded-lg h-[250px] sm:h-[350px] md:h-[400px]"
              />
              <p className="text-sm text-muted-foreground">
                {t.projects.marketplace.map.clickMarkers}
              </p>
            </div>

            {/* Project Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl sm:text-2xl font-semibold">
                  {category.label} ({isLoading ? "..." : filteredProjects.length})
                </h2>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ProjectCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <Card className="p-12 text-center">
                  <Leaf className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {t.projects.marketplace.grid.noProjectsFound}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t.projects.marketplace.grid.adjustFilters}
                  </p>
                  <Button
                    onClick={() => {
                      setSearch("");
                      setShowFundedOnly(false);
                      setActiveTab("all");
                    }}
                  >
                    {t.projects.marketplace.grid.resetFilters}
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Community Engagement Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            {t.projects.marketplace.community.title}
          </CardTitle>
          <CardDescription className="text-sm">
            {t.projects.marketplace.community.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div>
                <p className="font-semibold">{t.projects.marketplace.community.yourImpact}</p>
                <p className="text-sm text-muted-foreground">
                  {t.projects.marketplace.community.yourImpactDescription}
                </p>
              </div>
              <Badge className="bg-green-600 w-fit">
                {t.projects.marketplace.community.activeContributor}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 border rounded-lg">
                <p className="text-2xl sm:text-3xl font-bold text-green-600">500+</p>
                <p className="text-sm text-muted-foreground">
                  {t.projects.marketplace.community.treesThisWeek}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {formatCurrency(12450)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.projects.marketplace.community.raisedThisMonth}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">89%</p>
                <p className="text-sm text-muted-foreground">
                  {t.projects.marketplace.community.averageProgress}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
