import { useState } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Check, Plus, Database, PenLine, ArrowLeft } from "lucide-react";
import { SearchEmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import type { Food, USDAFoodSearchResult } from "@shared/schema";
import { formatMacro } from "@/lib/macros";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const customFoodSchema = z.object({
  name: z.string().min(1, "Name is required"),
  caloriesPer100g: z.number().min(0, "Must be 0 or greater"),
  proteinPer100g: z.number().min(0, "Must be 0 or greater"),
  carbsPer100g: z.number().min(0, "Must be 0 or greater"),
  fatPer100g: z.number().min(0, "Must be 0 or greater"),
  category: z.string().optional(),
});

type CustomFoodFormValues = z.infer<typeof customFoodSchema>;

interface FoodSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFood: (food: Food | USDAFoodSearchResult) => void;
  ingredientName?: string;
}

export function FoodSearchModal({
  open,
  onOpenChange,
  onSelectFood,
  ingredientName = "",
}: FoodSearchModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"search" | "custom">("search");
  const [searchQuery, setSearchQuery] = useState(ingredientName);
  const [debouncedQuery, setDebouncedQuery] = useState(ingredientName);

  const form = useForm<CustomFoodFormValues>({
    resolver: zodResolver(customFoodSchema),
    defaultValues: {
      name: ingredientName,
      caloriesPer100g: 0,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 0,
      category: "",
    },
  });

  const { data: savedFoods, isLoading: loadingSaved } = useQuery<Food[]>({
    queryKey: ["/api/foods"],
    enabled: open,
  });

  const { data: usdaResults, isLoading: loadingUSDA } = useQuery<USDAFoodSearchResult[]>({
    queryKey: ["/api/usda/search", debouncedQuery],
    enabled: open && debouncedQuery.length >= 2,
  });

  const createCustomFoodMutation = useMutation({
    mutationFn: async (data: CustomFoodFormValues) => {
      const response = await apiRequest("POST", "/api/foods", {
        ...data,
        isCustom: true,
      });
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

  const filteredSavedFoods = savedFoods?.filter((food) =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = loadingSaved || loadingUSDA;
  const hasResults = (filteredSavedFoods && filteredSavedFoods.length > 0) || 
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

              {usdaResults && usdaResults.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    USDA FoodData Central Results
                  </h3>
                  <div className="space-y-2">
                    {usdaResults.map((food) => {
                      const calories = food.foodNutrients.find(n => n.nutrientId === 1008)?.value || 0;
                      const protein = food.foodNutrients.find(n => n.nutrientId === 1003)?.value || 0;
                      const carbs = food.foodNutrients.find(n => n.nutrientId === 1005)?.value || 0;
                      const fat = food.foodNutrients.find(n => n.nutrientId === 1004)?.value || 0;

                      return (
                        <FoodResultItem
                          key={food.fdcId}
                          name={food.description}
                          dataType={food.dataType}
                          calories={calories}
                          protein={protein}
                          carbs={carbs}
                          fat={fat}
                          onSelect={() => onSelectFood(food)}
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
              <p className="text-sm text-muted-foreground">
                Enter nutrition facts from a food label. Values should be per 100g serving.
              </p>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="caloriesPer100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calories (per 100g)</FormLabel>
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
                    name="proteinPer100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protein (g per 100g)</FormLabel>
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
                    name="carbsPer100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbs (g per 100g)</FormLabel>
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
                    name="fatPer100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fat (g per 100g)</FormLabel>
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
  onSelect: () => void;
}

function FoodResultItem({
  name,
  dataType,
  calories,
  protein,
  carbs,
  fat,
  onSelect,
}: FoodResultItemProps) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-md border border-border hover-elevate transition-all cursor-pointer"
      onClick={onSelect}
      data-testid={`food-result-${name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}
    >
      <div className="flex-1 min-w-0 mr-4">
        <p className="font-medium truncate">{name}</p>
        <Badge variant="outline" size="sm" className="mt-1">
          {dataType}
        </Badge>
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
