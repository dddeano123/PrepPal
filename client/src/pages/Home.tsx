import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { RecipeCard, RecipeCardSkeleton } from "@/components/RecipeCard";
import { RecipesEmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, X, Tag, LayoutGrid, List, Utensils } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getTagClasses } from "@/lib/tagColors";
import { calculateRecipeTotals, calculatePerServingMacros } from "@/lib/macros";
import type { RecipeWithIngredients, MacroTotals } from "@shared/schema";

type ViewMode = "grid" | "list";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [deleteRecipeId, setDeleteRecipeId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("recipeViewMode") as ViewMode) || "grid";
  });

  const { data: recipes, isLoading } = useQuery<RecipeWithIngredients[]>({
    queryKey: ["/api/recipes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recipes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Recipe deleted",
        description: "The recipe has been removed from your collection.",
      });
      setDeleteRecipeId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recipe. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/recipes/${id}/duplicate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Recipe duplicated",
        description: "A copy of the recipe has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate recipe. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleEatingMutation = useMutation({
    mutationFn: async ({ id, isCurrentlyEating }: { id: number; isCurrentlyEating: boolean }) => {
      return await apiRequest("PATCH", `/api/recipes/${id}/eating-status`, { isCurrentlyEating });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update eating status.",
        variant: "destructive",
      });
    },
  });

  // Extract all unique tags from recipes
  const allTags = useMemo(() => {
    if (!recipes) return [];
    const tagSet = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [recipes]);

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Clear all tag filters
  const clearTagFilters = () => {
    setSelectedTags([]);
  };

  // Filter recipes by search query AND selected tags
  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    
    return recipes.filter((recipe) => {
      const matchesSearch = searchQuery === "" ||
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every((tag) => recipe.tags?.includes(tag));
      
      return matchesSearch && matchesTags;
    });
  }, [recipes, searchQuery, selectedTags]);

  // Separate recipes by eating status
  const currentlyEating = useMemo(() => 
    filteredRecipes.filter(r => r.isCurrentlyEating),
    [filteredRecipes]
  );

  const notEating = useMemo(() => 
    filteredRecipes.filter(r => !r.isCurrentlyEating),
    [filteredRecipes]
  );

  // Calculate daily totals for currently eating recipes (per-serving macros)
  const dailyTotals = useMemo<MacroTotals>(() => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    currentlyEating.forEach(recipe => {
      const recipeTotals = calculateRecipeTotals(recipe.ingredients);
      // Use per-serving macros since user eats one serving at a time
      const perServing = calculatePerServingMacros(recipeTotals, recipe.servings);
      totalCalories += perServing.calories;
      totalProtein += perServing.protein;
      totalCarbs += perServing.carbs;
      totalFat += perServing.fat;
    });

    return {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
    };
  }, [currentlyEating]);

  const handleCreateRecipe = () => {
    navigate("/recipes/new");
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("recipeViewMode", mode);
  };

  const handleToggleEating = (recipe: RecipeWithIngredients) => {
    toggleEatingMutation.mutate({
      id: recipe.id,
      isCurrentlyEating: !recipe.isCurrentlyEating,
    });
  };

  const renderRecipes = (recipeList: RecipeWithIngredients[]) => {
    if (viewMode === "list") {
      return (
        <div className="space-y-2">
          {recipeList.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onEdit={() => navigate(`/recipes/${recipe.id}/edit`)}
              onDelete={() => setDeleteRecipeId(recipe.id)}
              onDuplicate={() => duplicateMutation.mutate(recipe.id)}
              onToggleEating={() => handleToggleEating(recipe)}
              compact
            />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipeList.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onEdit={() => navigate(`/recipes/${recipe.id}/edit`)}
            onDelete={() => setDeleteRecipeId(recipe.id)}
            onDuplicate={() => duplicateMutation.mutate(recipe.id)}
            onToggleEating={() => handleToggleEating(recipe)}
          />
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <PageHeader
        title="Recipes"
        description="Manage your recipes with accurate macro calculations"
        action={
          <Button onClick={handleCreateRecipe} data-testid="button-new-recipe">
            <Plus className="h-4 w-4 mr-2" />
            New Recipe
          </Button>
        }
      />

      {isLoading ? (
        <>
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                className="pl-10"
                disabled
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <RecipeCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : recipes && recipes.length > 0 ? (
        <>
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-recipes"
                />
              </div>
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => handleViewModeChange("grid")}
                  data-testid="button-view-grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => handleViewModeChange("list")}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Filter by tag:
                </span>
                {allTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <span
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all",
                        isSelected 
                          ? getTagClasses(tag) + " ring-2 ring-offset-1 ring-primary"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      data-testid={`tag-filter-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {tag}
                      {isSelected && <X className="h-3 w-3 ml-1 inline" />}
                    </span>
                  );
                })}
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTagFilters}
                    className="text-muted-foreground"
                    data-testid="button-clear-tag-filters"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            )}
          </div>

          {filteredRecipes && filteredRecipes.length > 0 ? (
            <div className="space-y-8">
              {currentlyEating.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Utensils className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h2 className="text-lg font-semibold">Currently Eating</h2>
                    <Badge variant="secondary" className="ml-2">
                      {currentlyEating.length} {currentlyEating.length === 1 ? "recipe" : "recipes"}
                    </Badge>
                  </div>
                  {renderRecipes(currentlyEating)}
                </section>
              )}

              {notEating.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                      {currentlyEating.length > 0 ? "Other Recipes" : "All Recipes"}
                    </h2>
                    <Badge variant="outline" className="ml-2">
                      {notEating.length}
                    </Badge>
                  </div>
                  {renderRecipes(notEating)}
                </section>
              )}

              {currentlyEating.length > 0 && (
                <Card className="sticky bottom-4 border-green-200 dark:border-green-800 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="font-semibold">Daily Totals</span>
                        <span className="text-sm text-muted-foreground">
                          ({currentlyEating.length} {currentlyEating.length === 1 ? "recipe" : "recipes"})
                        </span>
                      </div>
                      <div className="flex items-center gap-6 font-mono text-sm">
                        <div className="text-center">
                          <div className="text-lg font-bold" data-testid="text-daily-calories">
                            {Math.round(dailyTotals.calories)}
                          </div>
                          <div className="text-xs text-muted-foreground">calories</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400" data-testid="text-daily-protein">
                            {dailyTotals.protein.toFixed(1)}g
                          </div>
                          <div className="text-xs text-muted-foreground">protein</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="text-daily-carbs">
                            {dailyTotals.carbs.toFixed(1)}g
                          </div>
                          <div className="text-xs text-muted-foreground">carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-rose-600 dark:text-rose-400" data-testid="text-daily-fat">
                            {dailyTotals.fat.toFixed(1)}g
                          </div>
                          <div className="text-xs text-muted-foreground">fat</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No recipes match your search.
            </div>
          )}
        </>
      ) : (
        <RecipesEmptyState onCreateRecipe={handleCreateRecipe} />
      )}

      <AlertDialog
        open={deleteRecipeId !== null}
        onOpenChange={(open) => !open && setDeleteRecipeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this recipe and all its ingredients.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRecipeId && deleteMutation.mutate(deleteRecipeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
