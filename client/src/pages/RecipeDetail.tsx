import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { MacroSummaryCard, MacroDisplay } from "@/components/MacroDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Pencil,
  Minus,
  Plus,
  AlertTriangle,
  Users,
  ShoppingCart,
  ListOrdered,
} from "lucide-react";
import { calculateRecipeTotals, calculatePerServingMacros, formatMacro } from "@/lib/macros";
import type { RecipeWithIngredients } from "@shared/schema";

export default function RecipeDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [servings, setServings] = useState<number | null>(null);

  const { data: recipe, isLoading } = useQuery<RecipeWithIngredients>({
    queryKey: ["/api/recipes", id],
  });

  const displayServings = servings ?? recipe?.servings ?? 1;
  const scaleFactor = recipe ? displayServings / recipe.servings : 1;

  const totals = recipe ? calculateRecipeTotals(recipe.ingredients) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const perServing = calculatePerServingMacros(totals, recipe?.servings ?? 1);
  const scaledTotals = {
    calories: perServing.calories * displayServings,
    protein: perServing.protein * displayServings,
    carbs: perServing.carbs * displayServings,
    fat: perServing.fat * displayServings,
  };

  const hasUnmatchedIngredients = recipe?.ingredients.some((i) => !i.foodId);

  const incrementServings = () => setServings((prev) => (prev ?? recipe?.servings ?? 1) + 1);
  const decrementServings = () => setServings((prev) => Math.max(1, (prev ?? recipe?.servings ?? 1) - 1));

  if (isLoading) {
    return (
      <Layout>
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[200px]" />
          </div>
          <Skeleton className="h-[200px]" />
        </div>
      </Layout>
    );
  }

  if (!recipe) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-semibold mb-2">Recipe not found</h1>
          <p className="text-muted-foreground mb-6">
            This recipe doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate("/")}>Back to Recipes</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={recipe.title}
        description={recipe.description || undefined}
        breadcrumbs={[
          { label: "Recipes", href: "/" },
          { label: recipe.title },
        ]}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/shopping-list")}
              data-testid="button-add-to-shopping"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to List
            </Button>
            <Button onClick={() => navigate(`/recipes/${id}/edit`)} data-testid="button-edit-recipe">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        }
      />

      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.tags.map((tag, index) => (
            <Badge key={index} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {hasUnmatchedIngredients && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Some ingredients are not matched
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Unmatched ingredients are excluded from macro calculations. Edit this recipe to match them to foods.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-lg font-semibold">Ingredients</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Servings:</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementServings}
                    disabled={displayServings <= 1}
                    data-testid="button-decrease-servings"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={displayServings}
                    onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 text-center font-mono"
                    min={1}
                    data-testid="input-servings"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementServings}
                    data-testid="button-increase-servings"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recipe.ingredients.map((ingredient, index) => {
                  const scaledGrams = ingredient.grams * scaleFactor;
                  const scaledAmount = ingredient.amount ? ingredient.amount * scaleFactor : null;

                  return (
                    <div
                      key={ingredient.id}
                      className={`flex items-center justify-between py-2 ${
                        index < recipe.ingredients.length - 1 ? "border-b border-border" : ""
                      }`}
                      data-testid={`ingredient-item-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        {!ingredient.foodId && (
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <div>
                          <span className="font-medium">{ingredient.displayName}</span>
                          {scaledAmount && ingredient.unit && (
                            <span className="text-muted-foreground ml-2">
                              {formatMacro(scaledAmount, scaledAmount >= 10 ? 0 : 1)} {ingredient.unit}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-muted-foreground">
                          {formatMacro(scaledGrams, 0)}g
                        </span>
                        {ingredient.food && (
                          <div className="flex gap-3 text-sm font-mono">
                            <span>{formatMacro((ingredient.food.caloriesPer100g * scaledGrams) / 100, 0)} cal</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between font-semibold">
                <span>Total ({displayServings} {displayServings === 1 ? "serving" : "servings"})</span>
                <MacroDisplay macros={scaledTotals} size="sm" showLabels={false} />
              </div>
            </CardContent>
          </Card>

          {recipe.instructions && recipe.instructions.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {recipe.instructions.map((step, index) => (
                    <li key={index} className="flex gap-4" data-testid={`instruction-step-${index}`}>
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center">
                        {index + 1}
                      </span>
                      <p className="text-muted-foreground pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div className="sticky top-20">
            <MacroSummaryCard macros={totals} servings={recipe.servings} />

            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    Original recipe makes {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
                  </span>
                </div>
                {displayServings !== recipe.servings && (
                  <p className="text-sm text-muted-foreground">
                    Currently scaled to {displayServings} {displayServings === 1 ? "serving" : "servings"} ({formatMacro(scaleFactor, 2)}x)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
