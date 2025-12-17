import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout, PageHeader } from "@/components/Layout";
import { IngredientRow, IngredientTableHeader, IngredientTotalsRow, type EditableIngredient } from "@/components/IngredientRow";
import { FoodSearchModal } from "@/components/FoodSearchModal";
import { ToolAutocomplete } from "@/components/ToolAutocomplete";
import { RecipeReferenceSidebar } from "@/components/RecipeReferenceSidebar";
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
import { Plus, Trash2, Save, X, GripVertical, Sparkles } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateRecipeTotals } from "@/lib/macros";
import type { RecipeWithIngredients, Food, OFFSearchResult } from "@shared/schema";

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
  const [tools, setTools] = useState<string[]>([]);
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
  const [autoMatchingIndices, setAutoMatchingIndices] = useState<Set<number>>(new Set());
  const [draggedInstructionIndex, setDraggedInstructionIndex] = useState<number | null>(null);

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
        recipe.ingredients.map((ing, index) => ({
          ...ing,
          localId: crypto.randomUUID(),
          sortOrder: ing.sortOrder ?? index,
        }))
      );
      setInstructions(recipe.instructions || []);
      setTools(recipe.tools?.map(t => t.name) || []);
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
        tools: tools.filter(Boolean).map((name, index) => ({ name, sortOrder: index })),
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

  const generateInstructionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-instructions", {
        title: form.getValues("title"),
        description: form.getValues("description") || null,
        ingredients: ingredients.map(ing => ({
          name: ing.displayName,
          amount: ing.amount,
          unit: ing.unit,
          grams: ing.grams,
        })),
        tools,
      });
      return await response.json();
    },
    onSuccess: (data: { instructions: string[] }) => {
      setInstructions(data.instructions);
      toast({
        title: "Instructions generated",
        description: "AI has created cooking steps for your recipe.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate instructions. Please try again.",
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

  const handleSelectFood = async (food: Food | OFFSearchResult) => {
    if (editingIngredientIndex === null) return;

    if ("id" in food) {
      updateIngredient(editingIngredientIndex, {
        foodId: food.id,
        food: food,
      });
    } else {
      toast({
        title: "Error",
        description: "Please select a saved food.",
        variant: "destructive",
      });
    }

    setFoodSearchOpen(false);
    setEditingIngredientIndex(null);
  };

  // Handle Kroger product selection - use UPC barcode for exact match, then fall back to name search
  const handleKrogerProductSelect = useCallback(async (index: number, product: KrogerProduct) => {
    updateIngredient(index, { 
      displayName: product.description,
      krogerProductId: product.productId,
    });

    setAutoMatchingIndices(prev => new Set(prev).add(index));

    try {
      // STEP 1: Try exact barcode lookup using Kroger product UPC
      if (product.upc) {
        const barcodeResponse = await fetch(`/api/openfoodfacts/product/${product.upc}`);
        
        if (barcodeResponse.ok) {
          const exactMatch: OFFSearchResult = await barcodeResponse.json();
          
          if (exactMatch.caloriesPer100g > 0 || exactMatch.proteinPer100g > 0) {
            const saveResponse = await apiRequest("POST", "/api/foods", {
              name: exactMatch.brand ? `${exactMatch.productName} (${exactMatch.brand})` : exactMatch.productName,
              dataType: 'Open Food Facts',
              offProductCode: exactMatch.code,
              caloriesPer100g: exactMatch.caloriesPer100g,
              proteinPer100g: exactMatch.proteinPer100g,
              carbsPer100g: exactMatch.carbsPer100g,
              fatPer100g: exactMatch.fatPer100g,
              isCustom: false,
            });

            const savedFood: Food = await saveResponse.json();
            
            updateIngredient(index, {
              foodId: savedFood.id,
              food: savedFood,
            });
            
            toast({
              title: "Exact match found",
              description: `Linked to ${savedFood.name} via barcode`,
            });
            return;
          }
        }
      }

      // STEP 2: Fall back to USDA search for whole foods (better for raw ingredients)
      const cleanDescription = (desc: string): string => {
        const commonBrands = [
          'kroger', 'simple truth', 'private selection', 'heritage farm',
          'comforts', 'big k', 'check this out', 'psst'
        ];
        let cleaned = desc.toLowerCase();
        commonBrands.forEach(brand => {
          cleaned = cleaned.replace(new RegExp(brand, 'gi'), '');
        });
        cleaned = cleaned.replace(/\d+(\.\d+)?\s*(oz|lb|lbs|ct|pack|count|fl\s*oz|ml|g|kg|each|per|pound)/gi, '');
        cleaned = cleaned.replace(/[^a-zA-Z\s]/g, ' ');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
      };
      
      const searchTerm = cleanDescription(product.description).split(' ').slice(0, 4).join(' ');
      
      if (searchTerm.length >= 3) {
        const usdaResponse = await fetch(`/api/usda/search?q=${encodeURIComponent(searchTerm)}`);
        
        if (usdaResponse.ok) {
          const usdaResults = await usdaResponse.json();
          
          if (usdaResults.length > 0) {
            const usdaMatch = usdaResults[0];
            
            const getNutrient = (id: number) => {
              const nutrient = usdaMatch.foodNutrients.find((n: any) => n.nutrientId === id);
              return nutrient ? nutrient.value : 0;
            };
            
            const calories = getNutrient(1008);
            const protein = getNutrient(1003);
            const carbs = getNutrient(1005);
            const fat = getNutrient(1004);
            
            if (calories > 0 || protein > 0) {
              const saveResponse = await apiRequest("POST", "/api/foods", {
                name: usdaMatch.description,
                dataType: usdaMatch.dataType,
                fdcId: usdaMatch.fdcId,
                caloriesPer100g: calories,
                proteinPer100g: protein,
                carbsPer100g: carbs,
                fatPer100g: fat,
                isCustom: false,
              });

              const savedFood: Food = await saveResponse.json();
              
              updateIngredient(index, {
                foodId: savedFood.id,
                food: savedFood,
              });
              
              toast({
                title: "Matched from USDA",
                description: `Linked to ${savedFood.name}`,
              });
              return;
            }
          }
        }
      }
      
      // STEP 3: If USDA fails, try Open Food Facts name search as last resort
      if (searchTerm.length >= 3) {
        const response = await fetch(`/api/openfoodfacts/search?q=${encodeURIComponent(searchTerm)}`);
        
        if (response.ok) {
          const results: OFFSearchResult[] = await response.json();
          
          if (results.length > 0) {
            const bestMatch = results[0];
            
            if (bestMatch.caloriesPer100g > 0 || bestMatch.proteinPer100g > 0) {
              const saveResponse = await apiRequest("POST", "/api/foods", {
                name: bestMatch.brand ? `${bestMatch.productName} (${bestMatch.brand})` : bestMatch.productName,
                dataType: 'Open Food Facts',
                offProductCode: bestMatch.code,
                caloriesPer100g: bestMatch.caloriesPer100g,
                proteinPer100g: bestMatch.proteinPer100g,
                carbsPer100g: bestMatch.carbsPer100g,
                fatPer100g: bestMatch.fatPer100g,
                isCustom: false,
              });

              const savedFood: Food = await saveResponse.json();
              
              updateIngredient(index, {
                foodId: savedFood.id,
                food: savedFood,
              });
              
              toast({
                title: "Matched from Open Food Facts",
                description: `Linked to ${savedFood.name}`,
              });
              return;
            }
          }
        }
      }
      
      toast({
        title: "No nutrition match found",
        description: "You can manually link this ingredient using the Match button.",
        variant: "default",
      });
    } catch (error) {
      console.error('Auto-match error:', error);
      toast({
        title: "Auto-match failed",
        description: "You can manually link this ingredient using the Match button.",
        variant: "destructive",
      });
    } finally {
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

  const handleInstructionDragStart = (index: number) => {
    setDraggedInstructionIndex(index);
  };

  const handleInstructionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedInstructionIndex === null || draggedInstructionIndex === index) return;
    
    const newInstructions = [...instructions];
    const draggedItem = newInstructions[draggedInstructionIndex];
    newInstructions.splice(draggedInstructionIndex, 1);
    newInstructions.splice(index, 0, draggedItem);
    setInstructions(newInstructions);
    setDraggedInstructionIndex(index);
  };

  const handleInstructionDragEnd = () => {
    setDraggedInstructionIndex(null);
  };

  const addTool = () => {
    setTools((prev) => [...prev, ""]);
  };

  const updateTool = (index: number, value: string) => {
    setTools((prev) => prev.map((tool, i) => (i === index ? value : tool)));
  };

  const deleteTool = (index: number) => {
    setTools((prev) => prev.filter((_, i) => i !== index));
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
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
                        placeholder="e.g., Quick weeknight stir-fry with bold Asian flavors. Spicy and savory with crispy vegetables."
                        {...field}
                        data-testid="input-recipe-description"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Tip: Add details about cooking style, difficulty, flavors, or texture to help AI generate better instructions
                    </p>
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateInstructionsMutation.mutate()}
                  disabled={generateInstructionsMutation.isPending || ingredients.length === 0 || !form.getValues("title")}
                  data-testid="button-generate-instructions"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generateInstructionsMutation.isPending ? "Generating..." : "Auto-Generate"}
                </Button>
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
              </div>
            </CardHeader>
            <CardContent>
              {instructions.length > 0 ? (
                <div className="space-y-3">
                  {instructions.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 ${draggedInstructionIndex === index ? "opacity-50" : ""}`}
                      draggable
                      onDragStart={() => handleInstructionDragStart(index)}
                      onDragOver={(e) => handleInstructionDragOver(e, index)}
                      onDragEnd={handleInstructionDragEnd}
                    >
                      <div className="flex-shrink-0 flex items-center gap-1 mt-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center">
                          {index + 1}
                        </div>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Cooking Tools</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTool}
                data-testid="button-add-tool"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tool
              </Button>
            </CardHeader>
            <CardContent>
              {tools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool, index) => (
                    <ToolAutocomplete
                      key={index}
                      value={tool}
                      onChange={(value) => updateTool(index, value)}
                      onDelete={() => deleteTool(index)}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                  <p className="mb-2">No cooking tools added yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTool}
                    data-testid="button-add-first-tool"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Tool
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

        <div className="hidden lg:block">
          <RecipeReferenceSidebar
            onAddPantryStaple={(name) => {
              setIngredients((prev) => [
                ...prev,
                {
                  localId: crypto.randomUUID(),
                  displayName: name,
                  amount: null,
                  unit: null,
                  grams: 0,
                  foodId: null,
                  food: null,
                  category: null,
                  isPantryStaple: true,
                  sortOrder: prev.length,
                },
              ]);
            }}
            onAddTool={(name) => {
              if (!tools.includes(name)) {
                setTools((prev) => [...prev, name]);
              }
            }}
          />
        </div>
      </div>

      <FoodSearchModal
        open={foodSearchOpen}
        onOpenChange={setFoodSearchOpen}
        onSelectFood={handleSelectFood}
        ingredientName={
          editingIngredientIndex !== null
            ? ingredients[editingIngredientIndex]?.displayName
            : ""
        }
        currentFood={
          editingIngredientIndex !== null
            ? ingredients[editingIngredientIndex]?.food
            : null
        }
      />
    </Layout>
  );
}
