import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Copy, AlertTriangle, Users, Utensils, UtensilsCrossed } from "lucide-react";
import { MacroDisplay } from "./MacroDisplay";
import type { RecipeWithIngredients, MacroTotals } from "@shared/schema";
import { calculateRecipeTotals, calculatePerServingMacros } from "@/lib/macros";
import { cn } from "@/lib/utils";
import { getTagClasses } from "@/lib/tagColors";

interface RecipeCardProps {
  recipe: RecipeWithIngredients;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleEating?: () => void;
  compact?: boolean;
}

export function RecipeCard({ recipe, onEdit, onDelete, onDuplicate, onToggleEating, compact }: RecipeCardProps) {
  const totals = calculateRecipeTotals(recipe.ingredients);
  const perServing = calculatePerServingMacros(totals, recipe.servings);
  const hasUnmatchedIngredients = recipe.ingredients.some(i => !i.foodId);

  if (compact) {
    return (
      <div 
        className="flex items-center gap-4 p-3 rounded-md border bg-card hover-elevate transition-all"
        data-testid={`row-recipe-${recipe.id}`}
      >
        {onToggleEating && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleEating();
            }}
            className={cn(
              "shrink-0",
              recipe.isCurrentlyEating && "text-green-600 dark:text-green-400"
            )}
            data-testid={`button-toggle-eating-${recipe.id}`}
            aria-label={recipe.isCurrentlyEating ? "Remove from meal plan" : "Add to meal plan"}
          >
            {recipe.isCurrentlyEating ? <Utensils className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
          </Button>
        )}
        <Link href={`/recipes/${recipe.id}`} className="flex-1 min-w-0 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" data-testid={`text-recipe-title-${recipe.id}`}>
              {recipe.title}
            </div>
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {recipe.tags.slice(0, 3).map((tag, index) => (
                  <span 
                    key={index} 
                    className={cn("px-1.5 py-0.5 rounded text-xs", getTagClasses(tag))}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm font-mono text-muted-foreground shrink-0">
            <span>{Math.round(perServing.calories)} cal</span>
            <span>{perServing.protein.toFixed(1)}p</span>
            <span>{perServing.carbs.toFixed(1)}c</span>
            <span>{perServing.fat.toFixed(1)}f</span>
          </div>
        </Link>
        <div className="flex gap-1 shrink-0">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-recipe-${recipe.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete} data-testid={`button-delete-recipe-${recipe.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      className="group relative hover-elevate transition-all duration-200"
      data-testid={`card-recipe-${recipe.id}`}
    >
      {onToggleEating && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleEating();
          }}
          className={cn(
            "absolute top-3 left-3 z-10",
            recipe.isCurrentlyEating && "text-green-600 dark:text-green-400"
          )}
          data-testid={`button-toggle-eating-${recipe.id}`}
          aria-label={recipe.isCurrentlyEating ? "Remove from meal plan" : "Add to meal plan"}
        >
          {recipe.isCurrentlyEating ? <Utensils className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
        </Button>
      )}
      <Link href={`/recipes/${recipe.id}`} className="block">
        <CardHeader className={cn("flex flex-row items-start justify-between gap-2 pb-3", onToggleEating && "pl-14")}>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-medium truncate" data-testid={`text-recipe-title-${recipe.id}`}>
              {recipe.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}</span>
              </div>
              {hasUnmatchedIngredients && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Incomplete
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {recipe.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index} 
                  className={cn("px-2 py-0.5 rounded text-xs font-medium", getTagClasses(tag))}
                >
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <Badge variant="secondary" size="sm">
                  +{recipe.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
          <MacroDisplay macros={perServing} size="sm" showLabels perServing />
        </CardContent>
      </Link>
      
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        {onDuplicate && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDuplicate();
            }}
            data-testid={`button-duplicate-recipe-${recipe.id}`}
            aria-label="Duplicate recipe"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            data-testid={`button-edit-recipe-${recipe.id}`}
            aria-label="Edit recipe"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`button-delete-recipe-${recipe.id}`}
            aria-label="Delete recipe"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

interface RecipeCardSkeletonProps {
  className?: string;
}

export function RecipeCardSkeleton({ className }: RecipeCardSkeletonProps) {
  return (
    <Card className={cn("animate-pulse", className)}>
      <CardHeader className="pb-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/3 mt-2" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-5 bg-muted rounded w-12" />
              <div className="h-3 bg-muted rounded w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
