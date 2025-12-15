import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Check, Plus, Database } from "lucide-react";
import { SearchEmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import type { Food, USDAFoodSearchResult } from "@shared/schema";
import { formatMacro } from "@/lib/macros";

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
  const [searchQuery, setSearchQuery] = useState(ingredientName);
  const [debouncedQuery, setDebouncedQuery] = useState(ingredientName);

  const { data: savedFoods, isLoading: loadingSaved } = useQuery<Food[]>({
    queryKey: ["/api/foods"],
    enabled: open,
  });

  const { data: usdaResults, isLoading: loadingUSDA } = useQuery<USDAFoodSearchResult[]>({
    queryKey: ["/api/usda/search", debouncedQuery],
    enabled: open && debouncedQuery.length >= 2,
  });

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
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
            <SearchEmptyState query={debouncedQuery} />
          )}

          {!isLoading && !hasResults && debouncedQuery.length < 2 && (
            <div className="text-center py-8 text-muted-foreground">
              Enter at least 2 characters to search
            </div>
          )}
        </div>
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
