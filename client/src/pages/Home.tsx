import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { RecipeCard, RecipeCardSkeleton } from "@/components/RecipeCard";
import { RecipesEmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RecipeWithIngredients } from "@shared/schema";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteRecipeId, setDeleteRecipeId] = useState<number | null>(null);

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

  const filteredRecipes = recipes?.filter((recipe) =>
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateRecipe = () => {
    navigate("/recipes/new");
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
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-recipes"
              />
            </div>
          </div>

          {filteredRecipes && filteredRecipes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onEdit={() => navigate(`/recipes/${recipe.id}/edit`)}
                  onDelete={() => setDeleteRecipeId(recipe.id)}
                  onDuplicate={() => duplicateMutation.mutate(recipe.id)}
                />
              ))}
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
