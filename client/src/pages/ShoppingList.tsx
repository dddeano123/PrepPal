import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { ShoppingListEmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Copy,
  Check,
  Plus,
  X,
  ChefHat,
} from "lucide-react";
import { formatMacro } from "@/lib/macros";
import { useToast } from "@/hooks/use-toast";
import type { RecipeWithIngredients, ShoppingListItem } from "@shared/schema";

const CATEGORY_ORDER = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "condiments",
  "spices",
  "beverages",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat & Poultry",
  seafood: "Seafood",
  dairy: "Dairy & Eggs",
  bakery: "Bakery",
  frozen: "Frozen",
  pantry: "Pantry",
  condiments: "Condiments & Sauces",
  spices: "Spices & Seasonings",
  beverages: "Beverages",
  other: "Other",
};

export default function ShoppingList() {
  const { toast } = useToast();
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [excludePantryStaples, setExcludePantryStaples] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);

  const { data: recipes, isLoading } = useQuery<RecipeWithIngredients[]>({
    queryKey: ["/api/recipes"],
  });

  const shoppingItems = useMemo(() => {
    if (!recipes) return [];

    const selectedRecipes = recipes.filter((r) =>
      selectedRecipeIds.includes(r.id)
    );

    const itemMap = new Map<string, ShoppingListItem>();

    for (const recipe of selectedRecipes) {
      for (const ingredient of recipe.ingredients) {
        if (excludePantryStaples && ingredient.isPantryStaple) continue;

        const key = ingredient.displayName.toLowerCase().trim();
        const existing = itemMap.get(key);

        if (existing) {
          existing.totalGrams += ingredient.grams;
          existing.recipeNames.push(recipe.title);
          if (ingredient.amount && ingredient.unit) {
            existing.amounts.push({
              amount: ingredient.amount,
              unit: ingredient.unit,
              recipeName: recipe.title,
            });
          }
        } else {
          itemMap.set(key, {
            displayName: ingredient.displayName,
            totalGrams: ingredient.grams,
            category: ingredient.category || "other",
            isPantryStaple: ingredient.isPantryStaple || false,
            recipeNames: [recipe.title],
            amounts:
              ingredient.amount && ingredient.unit
                ? [
                    {
                      amount: ingredient.amount,
                      unit: ingredient.unit,
                      recipeName: recipe.title,
                    },
                  ]
                : [],
          });
        }
      }
    }

    return Array.from(itemMap.values());
  }, [recipes, selectedRecipeIds, excludePantryStaples]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingListItem[]> = {};

    for (const item of shoppingItems) {
      const category = item.category || "other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    }

    return CATEGORY_ORDER.filter((cat) => groups[cat]?.length > 0).map(
      (category) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        items: groups[category].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        ),
      })
    );
  }, [shoppingItems]);

  const toggleRecipe = (recipeId: number) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const toggleItem = (itemName: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  const copyToClipboard = async () => {
    const lines: string[] = [];

    for (const group of groupedItems) {
      lines.push(`\n${group.label.toUpperCase()}`);
      lines.push("-".repeat(group.label.length));
      for (const item of group.items) {
        const checked = checkedItems.has(item.displayName) ? "[x]" : "[ ]";
        const recipes = `(${item.recipeNames.join(", ")})`;
        lines.push(`${checked} ${item.displayName} - ${formatMacro(item.totalGrams, 0)}g ${recipes}`);
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Shopping list copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const selectedRecipes = recipes?.filter((r) =>
    selectedRecipeIds.includes(r.id)
  );

  if (isLoading) {
    return (
      <Layout>
        <PageHeader title="Shopping List" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Skeleton className="h-[400px]" />
          </div>
          <Skeleton className="h-[300px]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Shopping List"
        description="Generate a consolidated shopping list from your recipes"
        action={
          selectedRecipeIds.length > 0 && (
            <Button onClick={copyToClipboard} data-testid="button-copy-list">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy List
                </>
              )}
            </Button>
          )
        }
      />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {selectedRecipeIds.length === 0 ? (
            <ShoppingListEmptyState
              onSelectRecipes={() => setSelectDialogOpen(true)}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="exclude-pantry"
                    checked={excludePantryStaples}
                    onCheckedChange={setExcludePantryStaples}
                    data-testid="switch-exclude-pantry"
                  />
                  <Label htmlFor="exclude-pantry">Exclude pantry staples</Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  {shoppingItems.length} items
                </span>
              </div>

              {groupedItems.map((group) => (
                <Card key={group.category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">
                      {group.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.displayName}
                          className="flex items-start gap-3 py-2"
                          data-testid={`shopping-item-${item.displayName.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Checkbox
                            id={item.displayName}
                            checked={checkedItems.has(item.displayName)}
                            onCheckedChange={() => toggleItem(item.displayName)}
                            className="mt-0.5"
                            data-testid={`checkbox-${item.displayName.toLowerCase().replace(/\s+/g, "-")}`}
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={item.displayName}
                              className={`font-medium cursor-pointer ${
                                checkedItems.has(item.displayName)
                                  ? "line-through text-muted-foreground"
                                  : ""
                              }`}
                            >
                              {item.displayName}
                            </label>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-sm font-mono text-muted-foreground">
                                {formatMacro(item.totalGrams, 0)}g
                              </span>
                              {item.recipeNames.length > 1 && (
                                <Badge variant="secondary" size="sm">
                                  from {item.recipeNames.length} recipes
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card className="sticky top-20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base font-medium">
                Selected Recipes
              </CardTitle>
              <Dialog open={selectDialogOpen} onOpenChange={setSelectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-select-recipes">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Recipes</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {recipes?.map((recipe) => (
                        <div
                          key={recipe.id}
                          className="flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                          onClick={() => toggleRecipe(recipe.id)}
                          data-testid={`recipe-select-${recipe.id}`}
                        >
                          <Checkbox
                            checked={selectedRecipeIds.includes(recipe.id)}
                            onCheckedChange={() => toggleRecipe(recipe.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{recipe.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {recipe.ingredients.length} ingredients
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {selectedRecipes && selectedRecipes.length > 0 ? (
                <div className="space-y-2">
                  {selectedRecipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChefHat className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{recipe.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleRecipe(recipe.id)}
                        data-testid={`button-remove-recipe-${recipe.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recipes selected
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
