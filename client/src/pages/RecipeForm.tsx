import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout, PageHeader } from "@/components/Layout";
import { IngredientRow, IngredientTableHeader, IngredientTotalsRow, type EditableIngredient } from "@/components/IngredientRow";
import { FoodSearchModal } from "@/components/FoodSearchModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Trash2, Save, X, GripVertical } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateRecipeTotals } from "@/lib/macros";
import type { RecipeWithIngredients, Food, USDAFoodSearchResult } from "@shared/schema";

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  images?: { perspective: string; sizes: { size: string; url: string }[] }[];
  items?: { price?: { regular: number; promo?: number }; size?: string }[];
}

const recipeFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  servings: z.number().min(1, "At least 1 serving required"),
  tags: z.string().optional(),
});

type RecipeFormValues = z.infer<typeof recipeFormSchema>;

interface LocalIngredient extends EditableIngredient {
  localId: string;
  sortOrder: number;
}

export default function RecipeForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
  const [autoMatchingIndices, setAutoMatchingIndices] = useState<Set<number>>(new Set());

  const { data: recipe, isLoading } = useQuery<RecipeWithIngredients>({
    queryKey: ["/api/recipes", id],
    enabled: isEditing,
  });

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      title: "",
      description: "",
      servings: 4,
      tags: "",
    },
  });

  useEffect(() => {
    if (recipe) {
      form.reset({
        title: recipe.title,
        description: recipe.description || "",
        servings: recipe.servings,
        tags: recipe.tags?.join(", ") || "",
      });
      setIngredients(
        recipe.ingredients.map((ing) => ({
          ...ing,
          localId: crypto.randomUUID(),
        }))
      );
      setInstructions(recipe.instructions || []);
    }
  }, [recipe, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: RecipeFormValues) => {
      const payload = {
        title: data.title,
        description: data.description || null,
        servings: data.servings,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        instructions: instructions.filter(Boolean),
        ingredients: ingredients.map((ing, index) => ({
          displayName: ing.displayName,
          amount: ing.amount,
          unit: ing.unit,
          grams: ing.grams,
          foodId: ing.foodId,
          category: ing.category,
          isPantryStaple: ing.isPantryStaple,
          sortOrder: index,
        })),
      };

      if (isEditing) {
        return await apiRequest("PUT", `/api/recipes/${id}`, payload);
      } else {
        return await apiRequest("POST", "/api/recipes", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: isEditing ? "Recipe updated" : "Recipe created",
        description: isEditing
          ? "Your changes have been saved."
          : "Your new recipe is ready to use.",
      });
      navigate("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save recipe. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        displayName: "",
        amount: null,
        unit: null,
        grams: 0,
        foodId: null,
        food: null,
        category: null,
        isPantryStaple: false,
        sortOrder: prev.length,
      },
    ]);
  };

  const updateIngredient = (index: number, updates: Partial<LocalIngredient>) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
    );
  };

  const deleteIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const openFoodSearch = (index: number) => {
    setEditingIngredientIndex(index);
    setFoodSearchOpen(true);
  };

  const handleSelectFood = async (food: Food | USDAFoodSearchResult) => {
    if (editingIngredientIndex === null) return;

    if ("id" in food) {
      updateIngredient(editingIngredientIndex, {
        foodId: food.id,
        food: food,
      });
    } else {
      try {
        const response = await apiRequest("POST", "/api/foods", {
          fdcId: food.fdcId,
          name: food.description,
          dataType: food.dataType,
          caloriesPer100g: food.foodNutrients.find((n) => n.nutrientId === 1008)?.value || 0,
          proteinPer100g: food.foodNutrients.find((n) => n.nutrientId === 1003)?.value || 0,
          carbsPer100g: food.foodNutrients.find((n) => n.nutrientId === 1005)?.value || 0,
          fatPer100g: food.foodNutrients.find((n) => n.nutrientId === 1004)?.value || 0,
        });

        const savedFood: Food = await response.json();
        updateIngredient(editingIngredientIndex, {
          foodId: savedFood.id,
          food: savedFood,
        });

        queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
      } catch {
        toast({
          title: "Error",
          description: "Failed to save food. Please try again.",
          variant: "destructive",
        });
      }
    }

    setFoodSearchOpen(false);
    setEditingIngredientIndex(null);
  };

  // Handle Kroger product selection - auto-search USDA and match nutrition
  const handleKrogerProductSelect = useCallback(async (index: number, product: KrogerProduct) => {
    // Update ingredient name with product description
    updateIngredient(index, { 
      displayName: product.description,
      krogerProductId: product.productId,
    });

    // Set auto-matching state
    setAutoMatchingIndices(prev => new Set(prev).add(index));

    try {
      // Common brand names to remove from search
      const commonBrands = [
        'kroger', 'simple truth', 'private selection', 'heritage farm',
        'comforts', 'big k', 'check this out', 'psst', 'lala', 'borden',
        'organic', 'natural', 'fresh', 'premium', 'select', 'choice',
        'usda', 'certified', 'angus', 'grass fed', 'free range', 'cage free',
        'all natural', 'no antibiotics', 'hormone free', 'boneless', 'skinless'
      ];
      
      // Helper to clean product description for USDA search
      const cleanDescription = (desc: string): string => {
        let cleaned = desc.toLowerCase();
        // Remove brand names
        commonBrands.forEach(brand => {
          cleaned = cleaned.replace(new RegExp(brand, 'gi'), '');
        });
        // Remove size/weight info
        cleaned = cleaned.replace(/\d+(\.\d+)?\s*(oz|lb|lbs|ct|pack|count|fl\s*oz|ml|g|kg|each|per|pound)/gi, '');
        // Remove special characters except spaces
        cleaned = cleaned.replace(/[^a-zA-Z\s]/g, ' ');
        // Remove extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
      };
      
      // Generate multiple search term variations to try
      const generateSearchTerms = (desc: string): string[] => {
        const cleaned = cleanDescription(desc);
        const words = cleaned.split(' ').filter(w => w.length > 2);
        
        const terms: string[] = [];
        
        // Try full cleaned description (first 4 words)
        if (words.length > 0) {
          terms.push(words.slice(0, 4).join(' '));
        }
        
        // Try first 2 words (more generic)
        if (words.length >= 2) {
          terms.push(words.slice(0, 2).join(' '));
        }
        
        // Try just the first word (most generic, e.g., "chicken", "beef")
        if (words.length >= 1) {
          terms.push(words[0]);
        }
        
        // Try last 2 meaningful words (sometimes the food type is at the end)
        if (words.length >= 3) {
          terms.push(words.slice(-2).join(' '));
        }
        
        // Remove duplicates
        return Array.from(new Set(terms)).filter(t => t.length >= 3);
      };
      
      const searchTermsList = generateSearchTerms(product.description);
      
      // Try each search term until we find a match
      let bestMatch = null;
      for (const searchTerm of searchTermsList) {
        const response = await fetch(`/api/usda/search?query=${encodeURIComponent(searchTerm)}&pageSize=5`);
        
        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        
        if (data.foods && data.foods.length > 0) {
          // Found results - pick the first one
          bestMatch = data.foods[0];
          break;
        }
      }
      
      if (bestMatch) {
        // Extract nutrition data with validation
        const getNutrient = (id: number) => 
          bestMatch.foodNutrients?.find((n: any) => n.nutrientId === id)?.value;
        
        const calories = getNutrient(1008);
        const protein = getNutrient(1003);
        const carbs = getNutrient(1005);
        const fat = getNutrient(1004);
        
        // Validate that we have at least calories data
        if (calories === undefined || calories === null) {
          toast({
            title: "Incomplete nutrition data",
            description: "USDA data is missing calories. Please manually link this ingredient.",
            variant: "default",
          });
          return;
        }
        
        // Save the food to our database
        const saveResponse = await apiRequest("POST", "/api/foods", {
          fdcId: bestMatch.fdcId,
          name: bestMatch.description,
          dataType: bestMatch.dataType || 'SR Legacy',
          caloriesPer100g: calories || 0,
          proteinPer100g: protein || 0,
          carbsPer100g: carbs || 0,
          fatPer100g: fat || 0,
        });

        const savedFood: Food = await saveResponse.json();
        
        // Update ingredient with matched food
        updateIngredient(index, {
          foodId: savedFood.id,
          food: savedFood,
        });

        queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
        
        toast({
          title: "Nutrition matched",
          description: `Matched "${product.description}" to USDA: ${savedFood.name}`,
        });
      } else {
        toast({
          title: "No nutrition match found",
          description: "You can manually link this ingredient to USDA data.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Auto-match error:', error);
      toast({
        title: "Auto-match failed",
        description: "You can manually link this ingredient using the search button.",
        variant: "destructive",
      });
    } finally {
      // Remove from auto-matching state
      setAutoMatchingIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }, [toast, updateIngredient]);

  const addInstruction = () => {
    setInstructions((prev) => [...prev, ""]);
  };

  const updateInstruction = (index: number, value: string) => {
    setInstructions((prev) =>
      prev.map((step, i) => (i === index ? value : step))
    );
  };

  const deleteInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: RecipeFormValues) => {
    // Prevent submission while auto-matching is in progress
    if (autoMatchingIndices.size > 0) {
      toast({
        title: "Please wait",
        description: "Ingredients are still being matched. Please wait for completion.",
      });
      return;
    }
    saveMutation.mutate(data);
  };

  const totals = calculateRecipeTotals(ingredients);

  if (isEditing && isLoading) {
    return (
      <Layout>
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={isEditing ? "Edit Recipe" : "New Recipe"}
        breadcrumbs={[
          { label: "Recipes", href: "/" },
          { label: isEditing ? "Edit" : "New" },
        ]}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Chicken Stir Fry"
                        {...field}
                        data-testid="input-recipe-title"
                      />
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
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A brief description of your recipe..."
                        {...field}
                        data-testid="input-recipe-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="servings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servings</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          data-testid="input-recipe-servings"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (comma-separated)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., dinner, asian, high-protein"
                          {...field}
                          data-testid="input-recipe-tags"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Ingredients</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addIngredient}
                data-testid="button-add-ingredient"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </CardHeader>
            <CardContent>
              {ingredients.length > 0 ? (
                <div className="border rounded-md overflow-visible">
                  <IngredientTableHeader />
                  <div className="divide-y">
                    {ingredients.map((ingredient, index) => (
                      <IngredientRow
                        key={ingredient.localId}
                        ingredient={ingredient}
                        index={index}
                        onUpdate={(updates) => updateIngredient(index, updates)}
                        onDelete={() => deleteIngredient(index)}
                        onMatchFood={() => openFoodSearch(index)}
                        onKrogerProductSelect={(product) => handleKrogerProductSelect(index, product)}
                        isAutoMatching={autoMatchingIndices.has(index)}
                      />
                    ))}
                  </div>
                  <IngredientTotalsRow totals={totals} />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                  <p className="mb-2">No ingredients added yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addIngredient}
                    data-testid="button-add-first-ingredient"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Ingredient
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Instructions</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInstruction}
                data-testid="button-add-instruction"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </CardHeader>
            <CardContent>
              {instructions.length > 0 ? (
                <div className="space-y-3">
                  {instructions.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center mt-2">
                        {index + 1}
                      </div>
                      <Textarea
                        value={step}
                        onChange={(e) => updateInstruction(index, e.target.value)}
                        placeholder={`Step ${index + 1}...`}
                        className="flex-1"
                        data-testid={`input-instruction-${index}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteInstruction(index)}
                        data-testid={`button-delete-instruction-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                  <p className="mb-2">No instructions added yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addInstruction}
                    data-testid="button-add-first-instruction"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save-recipe"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Recipe"}
            </Button>
          </div>
        </form>
      </Form>

      <FoodSearchModal
        open={foodSearchOpen}
        onOpenChange={setFoodSearchOpen}
        onSelectFood={handleSelectFood}
        ingredientName={
          editingIngredientIndex !== null
            ? ingredients[editingIngredientIndex]?.displayName
            : ""
        }
      />
    </Layout>
  );
}
