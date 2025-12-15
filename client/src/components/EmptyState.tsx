import { LucideIcon, ChefHat, ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = ChefHat,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-4",
        className
      )}
      data-testid="empty-state"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">
        {title}
      </h3>
      <p className="text-muted-foreground max-w-sm mb-6" data-testid="text-empty-description">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} data-testid="button-empty-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function RecipesEmptyState({ onCreateRecipe }: { onCreateRecipe: () => void }) {
  return (
    <EmptyState
      icon={ChefHat}
      title="No recipes yet"
      description="Create your first recipe to start tracking accurate macros for your meal prep."
      actionLabel="Create Recipe"
      onAction={onCreateRecipe}
    />
  );
}

export function ShoppingListEmptyState({ onSelectRecipes }: { onSelectRecipes: () => void }) {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Shopping list is empty"
      description="Select recipes to generate a consolidated shopping list with all the ingredients you need."
      actionLabel="Select Recipes"
      onAction={onSelectRecipes}
    />
  );
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any foods matching "${query}". Try a different search term or create a custom food entry.`}
    />
  );
}
