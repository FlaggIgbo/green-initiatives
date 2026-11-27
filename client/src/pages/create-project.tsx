import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";
import { useSelector, useDispatch } from "react-redux";
import { createProject, getOrganizations, reset } from "../features/projects/projectSlice";
import { useForm, useFieldArray } from "react-hook-form";
import type { RootState, AppDispatch } from "../app/store";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "leaflet";
import { type InsertProject } from "@shared/schema-mongo";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PROJECT_IMAGES, ASSETS } from "@/lib/cdn-assets";
import { Plus, Trash2, Upload, Search, MapPin, Loader2 } from "lucide-react";

// Fix for default marker icon - using centralized CDN assets
const icon = new Icon({
  iconUrl: ASSETS.mapMarker,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Use centralized CDN-ready project images
const projectImages = PROJECT_IMAGES;

type LocationValue = {
  lat: number;
  lng: number;
  address: string;
};

interface GeocodeSuggestion {
  lat: string;
  lon: string;
  display_name: string;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (location: LocationValue) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(value?.address || "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    value?.lat && value?.lng ? [value.lat, value.lng] : [0, 0],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedSearch.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/map/search?q=${encodeURIComponent(debouncedSearch)}`);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearch]);

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    const address = suggestion.display_name;

    setSearch(address);
    setMapCenter([lat, lng]);
    setShowSuggestions(false);
    onChange({ lat, lng, address });
  };

  function MapEvents() {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        setMapCenter([lat, lng]);

        try {
          const response = await fetch(`/api/map/reverse?lat=${lat}&lon=${lng}`);
          if (!response.ok) throw new Error("Reverse geocode failed");
          const data = await response.json();
          const address = data.display_name || "";
          setSearch(address);
          onChange({
            lat,
            lng,
            address,
          });
        } catch (error) {
          console.error("Failed to get address:", error);
        }
      },
    });
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.createProject.searchAddress}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          />
          {isLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSelect(suggestion)}
              >
                <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate">{suggestion.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer center={mapCenter} zoom={2} className="h-[250px] w-full rounded-md border">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents />
        <MapUpdater center={mapCenter} />
        {mapCenter[0] !== 0 && <Marker position={mapCenter} icon={icon} />}
      </MapContainer>
    </div>
  );
}

export default function CreateProject() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();

  const [acceptOngoingDonations, setAcceptOngoingDonations] = useState(false);

  const {
    organizations,
    isLoading: isCreating,
    isSuccess,
    isError,
    message,
  } = useSelector((state: RootState) => state.project);

  useEffect(() => {
    dispatch(getOrganizations());
  }, [dispatch]);

  useEffect(() => {
    if (isError) {
      toast({
        title: t.common.error,
        description: message || t.createProject.error,
        variant: "destructive",
      });
    }

    if (isSuccess) {
      toast({
        title: t.createProject.success,
        description: t.createProject.successMessage,
      });
      navigate("/dashboard");
      dispatch(reset());
    }
  }, [isError, isSuccess, message, navigate, dispatch, toast, t]);

  const form = useForm<InsertProject>({
    defaultValues: {
      title: "",
      description: "",
      organizationId: "",
      location: {
        lat: 0,
        lng: 0,
        address: "",
      },
      imageUrl: projectImages[0],
      targetFunding: undefined as number | undefined,
      status: "active",
      proposal: {
        objectives: "",
        methodology: "",
        timeline: [{ phase: "", duration: "", deliverables: "" }],
        fundingBreakdown: [{ category: "", amount: 0, description: "" }],
        measurableImpact: {
          metric: "",
          targetValue: 0,
          trackingMethod: "",
        },
        supportingDocuments: [],
      },
    },
  });

  const {
    fields: timelineFields,
    append: appendTimeline,
    remove: removeTimeline,
  } = useFieldArray({
    control: form.control,
    name: "proposal.timeline",
  });

  const {
    fields: fundingFields,
    append: appendFunding,
    remove: removeFunding,
  } = useFieldArray({
    control: form.control,
    name: "proposal.fundingBreakdown",
  });

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newDocuments = [...(form.getValues("proposal.supportingDocuments") || [])];

      for (const file of Array.from(files)) {
        // 1. Get pre-signed URL from API
        const response = await fetch("/api/projects/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: `${Date.now()}-${file.name}`,
            contentType: file.type,
          }),
        });

        if (!response.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, publicUrl } = await response.json();

        // 2. Upload to GCS using the signed URL
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        // 3. Add to supportingDocuments array in form
        newDocuments.push({
          name: file.name,
          url: publicUrl,
          type: file.type,
        });
      }

      form.setValue("proposal.supportingDocuments", newDocuments);
      toast({
        title: "Upload successful",
        description: `${files.length} document(s) uploaded successfully.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    const currentDocs = form.getValues("proposal.supportingDocuments") || [];
    form.setValue(
      "proposal.supportingDocuments",
      currentDocs.filter((_, i) => i !== index),
    );
  };

  async function onSubmit(data: InsertProject) {
    if (!acceptOngoingDonations) {
      const target = data.targetFunding;
      if (target == null || target <= 0) {
        toast({
          title: t.validation.title,
          description: t.createProject.validationError,
          variant: "destructive",
        });
        return;
      }
    }
    const payload: InsertProject = {
      ...data,
      targetFunding: acceptOngoingDonations ? undefined : data.targetFunding,
    };
    dispatch(createProject(payload));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">{t.createProject.title}</h1>
        <p className="text-lg text-muted-foreground">{t.createProject.subtitle}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.createProject.projectTitle}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.createProject.projectDescription}</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="organizationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.createProject.organization}</FormLabel>
                <Select onValueChange={(value) => field.onChange(value)} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t.createProject.selectOrganization} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id="acceptOngoingDonations"
              checked={acceptOngoingDonations}
              onChange={(e) => {
                setAcceptOngoingDonations(e.target.checked);
                if (e.target.checked) {
                  form.setValue("targetFunding", undefined as unknown as number);
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label
              htmlFor="acceptOngoingDonations"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t.createProject.acceptOngoingDonations}
            </label>
          </div>

          {!acceptOngoingDonations && (
            <FormField
              control={form.control}
              name="targetFunding"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.createProject.targetFundingLabel}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.createProject.projectImage}</FormLabel>
                <div className="grid grid-cols-3 gap-4">
                  {projectImages.map((url) => (
                    <Card
                      key={url}
                      className={`cursor-pointer transition-all ${
                        field.value === url
                          ? "ring-2 ring-primary"
                          : "hover:ring-2 hover:ring-primary/50"
                      }`}
                      onClick={() => field.onChange(url)}
                    >
                      <img
                        src={url}
                        alt="Project"
                        className="h-32 w-full object-cover rounded-md"
                      />
                    </Card>
                  ))}
                  <Card
                    className={`cursor-pointer transition-all border-dashed flex flex-col items-center justify-center h-32 ${
                      !(projectImages as readonly string[]).includes(field.value)
                        ? "ring-2 ring-primary"
                        : "hover:ring-2 hover:ring-primary/50"
                    }`}
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Upload Custom</span>
                      </>
                    )}
                    <input
                      type="file"
                      id="image-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const response = await fetch("/api/projects/upload-url", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fileName: `project-${Date.now()}-${file.name}`,
                              contentType: file.type,
                            }),
                          });
                          if (!response.ok) throw new Error();
                          const { uploadUrl, publicUrl } = await response.json();
                          await fetch(uploadUrl, {
                            method: "PUT",
                            body: file,
                            headers: { "Content-Type": file.type },
                          });
                          field.onChange(publicUrl);
                          toast({ title: "Image uploaded successfully" });
                        } catch (_err) {
                          toast({
                            title: "Image upload failed",
                            variant: "destructive",
                          });
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </Card>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Location</FormLabel>
                <FormControl>
                  <LocationPicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator className="my-8" />

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Detailed Proposal</h2>

            <FormField
              control={form.control}
              name="proposal.objectives"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Objectives (min 100 chars)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="What are the primary goals of this project?"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proposal.methodology"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Methodology (min 100 chars)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="How will you achieve these objectives?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Project Timeline</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendTimeline({ phase: "", duration: "", deliverables: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Phase
                </Button>
              </div>
              {timelineFields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-4 items-end border p-4 rounded-md"
                >
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`proposal.timeline.${index}.phase`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Phase</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Planning" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`proposal.timeline.${index}.duration`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Duration</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. 2 months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`proposal.timeline.${index}.deliverables`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Deliverables</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Impact report" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimeline(index)}
                      disabled={timelineFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Funding Breakdown</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendFunding({ category: "", amount: 0, description: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>
              {fundingFields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-4 items-end border p-4 rounded-md"
                >
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`proposal.fundingBreakdown.${index}.category`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Category</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Equipment" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`proposal.fundingBreakdown.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Amount ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`proposal.fundingBreakdown.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Details" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFunding(index)}
                      disabled={fundingFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 border p-4 rounded-md">
              <div className="col-span-2 font-medium mb-2">Measurable Impact</div>
              <FormField
                control={form.control}
                name="proposal.measurableImpact.metric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Metric Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Trees planted" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="proposal.measurableImpact.targetValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Target Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="proposal.measurableImpact.trackingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Tracking Method</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. IoT sensors, manual audit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <FormLabel>Supporting Documents & Proof</FormLabel>
              <div className="grid grid-cols-1 gap-4">
                <Card className="p-8 border-dashed flex flex-col items-center justify-center space-y-4">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">{t.createProject.uploadHint}</p>
                    <p className="text-sm text-muted-foreground">{t.createProject.uploadSubtext}</p>
                  </div>
                  <Input
                    type="file"
                    className="hidden"
                    id="doc-upload"
                    multiple
                    accept=".pdf"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => document.getElementById("doc-upload")?.click()}
                  >
                    {t.createProject.selectFiles}
                  </Button>
                </Card>
                {uploading && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Uploading...</span>
                  </div>
                )}
                {form.watch("proposal.supportingDocuments")?.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded">
                        <Upload className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {doc.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{doc.type}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDocument(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? t.createProject.creating : t.navigation.createProject}
          </Button>
        </form>
      </Form>
    </div>
  );
}
