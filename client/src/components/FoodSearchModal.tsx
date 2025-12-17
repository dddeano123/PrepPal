import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Check, Plus, Database, PenLine, ArrowLeft, ExternalLink } from "lucide-react";
import { SearchEmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import type { Food, OFFSearchResult } from "@shared/schema";
import { formatMacro } from "@/lib/macros";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const customFoodSchema = z.object({
  name: z.string().min(1, "Name is required"),
  servingSize: z.number().min(0).default(100),
  calories: z.number().min(0, "Must be 0 or greater"),
  protein: z.number().min(0, "Must be 0 or greater"),
  carbs: z.number().min(0, "Must be 0 or greater"),
  fat: z.number().min(0, "Must be 0 or greater"),
  category: z.string().optional(),
});

type CustomFoodFormValues = z.infer<typeof customFoodSchema>;

interface FoodSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFood: (food: Food | OFFSearchResult) => void;
  ingredientName?: string;
  currentFood?: Food | null;
}

export function FoodSearchModal({
  open,
  onOpenChange,
  onSelectFood,
  ingredientName = "",
  currentFood = null,
}: FoodSearchModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"search" | "custom">("search");
  const [searchQuery, setSearchQuery] = useState(ingredientName);
  const [debouncedQuery, setDebouncedQuery] = useState(ingredientName);
  const [useServingSize, setUseServingSize] = useState(true);

  const form = useForm<CustomFoodFormValues>({
    resolver: zodResolver(customFoodSchema),
    defaultValues: {
      name: ingredientName,
      servingSize: 100,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      category: "",
    },
  });

  useEffect(() => {
    if (open) {
      setSearchQuery(ingredientName);
      setDebouncedQuery(ingredientName);
      setActiveTab("search");
      setUseServingSize(true);
      form.reset({
        name: ingredientName,
        servingSize: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        category: "",
      });
    }
  }, [open, ingredientName, form]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      const timer = setTimeout(() => {
        setDebouncedQuery(trimmed);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDebouncedQuery("");
    }
  }, [searchQuery]);

  const servingSize = form.watch("servingSize");
  const calories = form.watch("calories");
  const protein = form.watch("protein");
  const carbs = form.watch("carbs");
  const fat = form.watch("fat");

  const convertToPer100g = (value: number, serving: number): number => {
    if (serving <= 0) return 0;
    return (value * 100) / serving;
  };

  const per100g = {
    calories: convertToPer100g(calories, servingSize),
    protein: convertToPer100g(protein, servingSize),
    carbs: convertToPer100g(carbs, servingSize),
    fat: convertToPer100g(fat, servingSize),
  };

  const { data: savedFoods, isLoading: loadingSaved } = useQuery<Food[]>({
    queryKey: ["/api/foods"],
    enabled: open,
  });

  const { data: offResults, isLoading: loadingOFF } = useQuery<OFFSearchResult[]>({
    queryKey: ["/api/openfoodfacts/search", debouncedQuery],
    enabled: open && debouncedQuery.length >= 2,
  });

  const { data: usdaResults, isLoading: loadingUSDA } = useQuery<any[]>({
    queryKey: ["/api/usda/search", debouncedQuery],
    enabled: open && debouncedQuery.length >= 2,
  });

  const createCustomFoodMutation = useMutation({
    mutationFn: async (data: CustomFoodFormValues) => {
      const payload = useServingSize
        ? {
            name: data.name,
            caloriesPer100g: convertToPer100g(data.calories, data.servingSize),
            proteinPer100g: convertToPer100g(data.protein, data.servingSize),
            carbsPer100g: convertToPer100g(data.carbs, data.servingSize),
            fatPer100g: convertToPer100g(data.fat, data.servingSize),
            category: data.category,
            isCustom: true,
          }
        : {
            name: data.name,
            caloriesPer100g: data.calories,
            proteinPer100g: data.protein,
            carbsPer100g: data.carbs,
            fatPer100g: data.fat,
            category: data.category,
            isCustom: true,
          };
      const response = await apiRequest("POST", "/api/foods", payload);
      return await response.json() as Food;
    },
    onSuccess: (food) => {
      queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
      toast({
        title: "Custom food created",
        description: `${food.name} has been added to your foods.`,
      });
      onSelectFood(food);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create custom food. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const onSubmitCustomFood = (data: CustomFoodFormValues) => {
    createCustomFoodMutation.mutate(data);
  };

  const handleSelectOFFProduct = async (product: OFFSearchResult) => {
    try {
      const response = await apiRequest("POST", "/api/foods", {
        name: product.brand ? `${product.productName} (${product.brand})` : product.productName,
        caloriesPer100g: product.caloriesPer100g,
        proteinPer100g: product.proteinPer100g,
        carbsPer100g: product.carbsPer100g,
        fatPer100g: product.fatPer100g,
        dataType: "Open Food Facts",
        offProductCode: product.code,
        isCustom: false,
      });
      const savedFood = await response.json() as Food;
      queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
      onSelectFood(savedFood);
      toast({
        title: "Food added",
        description: `${savedFood.name} has been added to your foods.`,
      });
    } catch (error) {
      console.error("Error saving Open Food Facts product:", error);
      toast({
        title: "Error",
        description: "Failed to save food. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredSavedFoods = savedFoods?.filter((food) =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = loadingSaved || loadingOFF || loadingUSDA;
  const hasResults = (filteredSavedFoods && filteredSavedFoods.length > 0) || 
    (offResults && offResults.length > 0) ||
    (usdaResults && usdaResults.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Match Ingredient to Food</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "custom")} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search-food">
              <Search className="h-4 w-4" />
              Search Foods
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2" data-testid="tab-custom-food">
              <PenLine className="h-4 w-4" />
              Add Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex-1 flex flex-col mt-4">
            {currentFood && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Currently matched to:</p>
                    <p className="text-sm text-muted-foreground">{currentFood.name}</p>
                  </div>
                  {currentFood.offProductCode && (
                    <a
                      href={`https://world.openfoodfacts.org/product/${currentFood.offProductCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                    >
                      View on Open Food Facts
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {currentFood.fdcId && !currentFood.offProductCode && (
                    <a
                      href={`https://fdc.nal.usda.gov/fdc-app.html#/food-details/${currentFood.fdcId}/nutrients`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                    >
                      View on USDA FoodData Central
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods (e.g., chicken breast, brown rice)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                  data-testid="input-food-search"
                  autoFocus
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-food">
                Search
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {filteredSavedFoods && filteredSavedFoods.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Your Saved Foods
                  </h3>
                  <div className="space-y-2">
                    {filteredSavedFoods.map((food) => (
                      <FoodResultItem
                        key={food.id}
                        name={food.name}
                        dataType={food.isCustom ? "Custom" : food.dataType || "Saved"}
                        calories={food.caloriesPer100g}
                        protein={food.proteinPer100g}
                        carbs={food.carbsPer100g}
                        fat={food.fatPer100g}
                        onSelect={() => onSelectFood(food)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {offResults && offResults.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Open Food Facts Results
                  </h3>
                  <div className="space-y-2">
                    {offResults.map((product) => (
                      <FoodResultItem
                        key={product.code}
                        name={product.brand ? `${product.productName} (${product.brand})` : product.productName}
                        dataType="Open Food Facts"
                        calories={product.caloriesPer100g}
                        protein={product.proteinPer100g}
                        carbs={product.carbsPer100g}
                        fat={product.fatPer100g}
                        servingSize={product.servingSize}
                        imageUrl={product.imageUrl}
                        onSelect={() => handleSelectOFFProduct(product)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {usdaResults && usdaResults.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    USDA Database Results
                  </h3>
                  <div className="space-y-2">
                    {usdaResults.map((food) => {
                      const getNutrient = (id: number) => {
                        const nutrient = food.foodNutrients.find((n: any) => n.nutrientId === id);
                        return nutrient ? nutrient.value : 0;
                      };
                      
                      const calories = getNutrient(1008);
                      const protein = getNutrient(1003);
                      const carbs = getNutrient(1005);
                      const fat = getNutrient(1004);
                      
                      return (
                        <FoodResultItem
                          key={food.fdcId}
                          name={food.description}
                          dataType={food.dataType}
                          calories={calories}
                          protein={protein}
                          carbs={carbs}
                          fat={fat}
                          onSelect={async () => {
                            try {
                              const response = await apiRequest("POST", "/api/foods", {
                                name: food.description,
                                dataType: food.dataType,
                                fdcId: food.fdcId,
                                caloriesPer100g: calories,
                                proteinPer100g: protein,
                                carbsPer100g: carbs,
                                fatPer100g: fat,
                                isCustom: false,
                              });
                              const savedFood = await response.json();
                              queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
                              onSelectFood(savedFood);
                              toast({
                                title: "Food added",
                                description: `${savedFood.name} has been added to your foods.`,
                              });
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to save food. Please try again.",
                                variant: "destructive",
                              });
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {isLoading && (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-9 w-16" />
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && !hasResults && debouncedQuery.length >= 2 && (
                <div className="text-center py-8">
                  <SearchEmptyState query={debouncedQuery} />
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      form.setValue("name", debouncedQuery);
                      setActiveTab("custom");
                    }}
                    data-testid="button-create-custom-from-search"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Food
                  </Button>
                </div>
              )}

              {!isLoading && !hasResults && debouncedQuery.length < 2 && (
                <div className="text-center py-8 text-muted-foreground">
                  Enter at least 2 characters to search
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="flex-1 mt-4">
            <div className="bg-muted/30 rounded-md p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enter nutrition per serving</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter values exactly as they appear on the nutrition label
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="serving-mode" className="text-xs">Per 100g</Label>
                  <Switch
                    id="serving-mode"
                    checked={useServingSize}
                    onCheckedChange={(checked) => {
                      setUseServingSize(checked);
                      if (!checked) {
                        form.setValue("servingSize", 100);
                      }
                    }}
                    data-testid="switch-serving-mode"
                  />
                  <Label htmlFor="serving-mode" className="text-xs">Per serving</Label>
                </div>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCustomFood)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Food Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Store Brand Greek Yogurt" 
                          {...field} 
                          data-testid="input-custom-food-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {useServingSize && (
                  <FormField
                    control={form.control}
                    name="servingSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serving Size (grams)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="28" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-serving-size"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Enter the serving size from the label (e.g., 28g, 113g, 240g)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="calories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calories {useServingSize ? "(per serving)" : "(per 100g)"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-custom-food-calories"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="protein"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protein (g) {useServingSize ? "per serving" : "per 100g"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-custom-food-protein"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="carbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbs (g) {useServingSize ? "per serving" : "per 100g"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-custom-food-carbs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fat (g) {useServingSize ? "per serving" : "per 100g"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-custom-food-fat"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {useServingSize && servingSize > 0 && (calories > 0 || protein > 0 || carbs > 0 || fat > 0) && (
                  <div className="bg-muted/50 rounded-md p-3 border border-dashed">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Converted to per 100g (stored values):</p>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div className="text-center">
                        <span className="font-mono font-medium">{Math.round(per100g.calories)}</span>
                        <span className="text-xs text-muted-foreground block">cal</span>
                      </div>
                      <div className="text-center">
                        <span className="font-mono font-medium">{per100g.protein.toFixed(1)}g</span>
                        <span className="text-xs text-muted-foreground block">protein</span>
                      </div>
                      <div className="text-center">
                        <span className="font-mono font-medium">{per100g.carbs.toFixed(1)}g</span>
                        <span className="text-xs text-muted-foreground block">carbs</span>
                      </div>
                      <div className="text-center">
                        <span className="font-mono font-medium">{per100g.fat.toFixed(1)}g</span>
                        <span className="text-xs text-muted-foreground block">fat</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setActiveTab("search")}
                    data-testid="button-back-to-search"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Search
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createCustomFoodMutation.isPending}
                    data-testid="button-save-custom-food"
                  >
                    {createCustomFoodMutation.isPending ? "Saving..." : "Save & Select"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface FoodResultItemProps {
  name: string;
  dataType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
  imageUrl?: string | null;
  onSelect: () => void;
}

function FoodResultItem({
  name,
  dataType,
  calories,
  protein,
  carbs,
  fat,
  servingSize,
  imageUrl,
  onSelect,
}: FoodResultItemProps) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-md border border-border hover-elevate transition-all cursor-pointer"
      onClick={onSelect}
      data-testid={`food-result-${name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            className="w-10 h-10 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" size="sm">
              {dataType}
            </Badge>
            {servingSize && (
              <span className="text-xs text-muted-foreground">{servingSize}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="text-center min-w-[50px]">
          <span className="font-mono font-medium">{formatMacro(calories, 0)}</span>
          <span className="text-xs text-muted-foreground block">cal</span>
        </div>
        <div className="text-center min-w-[40px]">
          <span className="font-mono font-medium">{formatMacro(protein)}g</span>
          <span className="text-xs text-muted-foreground block">P</span>
        </div>
        <div className="text-center min-w-[40px]">
          <span className="font-mono font-medium">{formatMacro(carbs)}g</span>
          <span className="text-xs text-muted-foreground block">C</span>
        </div>
        <div className="text-center min-w-[40px]">
          <span className="font-mono font-medium">{formatMacro(fat)}g</span>
          <span className="text-xs text-muted-foreground block">F</span>
        </div>
        <Button size="sm" variant="ghost" className="ml-2">
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}