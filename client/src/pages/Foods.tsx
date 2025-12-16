import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Edit2, Trash2, Package, ExternalLink, Calculator } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Food } from "@shared/schema";

interface FoodFormData {
  name: string;
  servingSize: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  krogerProductId?: string;
  krogerProductName?: string;
}

const defaultFormData: FoodFormData = {
  name: "",
  servingSize: 100,
  caloriesPerServing: 0,
  proteinPerServing: 0,
  carbsPerServing: 0,
  fatPerServing: 0,
  krogerProductId: "",
  krogerProductName: "",
};

function convertToPer100g(perServing: number, servingSize: number): number {
  if (servingSize <= 0) return 0;
  return (perServing / servingSize) * 100;
}

function convertToPerServing(per100g: number, servingSize: number): number {
  if (servingSize <= 0) return 0;
  return (per100g / 100) * servingSize;
}

export default function Foods() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [formData, setFormData] = useState<FoodFormData>(defaultFormData);
  const [useServingMode, setUseServingMode] = useState(true);

  const { data: foods, isLoading } = useQuery<Food[]>({
    queryKey: ["/api/foods"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FoodFormData) => {
      const per100gData = {
        name: data.name,
        caloriesPer100g: convertToPer100g(data.caloriesPerServing, data.servingSize),
        proteinPer100g: convertToPer100g(data.proteinPerServing, data.servingSize),
        carbsPer100g: convertToPer100g(data.carbsPerServing, data.servingSize),
        fatPer100g: convertToPer100g(data.fatPerServing, data.servingSize),
        krogerProductId: data.krogerProductId || undefined,
        krogerProductName: data.krogerProductName || undefined,
        dataType: "Custom",
      };
      return await apiRequest("POST", "/api/foods", per100gData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
      toast({ title: "Food created", description: "Your custom food has been added to the library." });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create food.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FoodFormData }) => {
      const per100gData = {
        name: data.name,
        caloriesPer100g: convertToPer100g(data.caloriesPerServing, data.servingSize),
        proteinPer100g: convertToPer100g(data.proteinPerServing, data.servingSize),
        carbsPer100g: convertToPer100g(data.carbsPerServing, data.servingSize),
        fatPer100g: convertToPer100g(data.fatPerServing, data.servingSize),
        krogerProductId: data.krogerProductId || undefined,
        krogerProductName: data.krogerProductName || undefined,
        dataType: "Custom",
      };
      return await apiRequest("PUT", `/api/foods/${id}`, per100gData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
      toast({ title: "Food updated", description: "Nutrition data has been saved." });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update food.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/foods/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/foods"] });
      toast({ title: "Food deleted", description: "The food has been removed from your library." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete food.", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingFood(null);
    setFormData(defaultFormData);
    setUseServingMode(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (food: Food) => {
    setEditingFood(food);
    setFormData({
      name: food.name,
      servingSize: 100,
      caloriesPerServing: food.caloriesPer100g ?? 0,
      proteinPerServing: food.proteinPer100g ?? 0,
      carbsPerServing: food.carbsPer100g ?? 0,
      fatPerServing: food.fatPer100g ?? 0,
      krogerProductId: food.krogerProductId || "",
      krogerProductName: food.krogerProductName || "",
    });
    setUseServingMode(false);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFood(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFood) {
      updateMutation.mutate({ id: editingFood.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const per100gPreview = useMemo(() => {
    if (formData.servingSize <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      calories: convertToPer100g(formData.caloriesPerServing, formData.servingSize),
      protein: convertToPer100g(formData.proteinPerServing, formData.servingSize),
      carbs: convertToPer100g(formData.carbsPerServing, formData.servingSize),
      fat: convertToPer100g(formData.fatPerServing, formData.servingSize),
    };
  }, [formData]);

  const filteredFoods = foods?.filter((food) =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <Layout>
      <PageHeader
        title="Food Library"
        breadcrumbs={[{ label: "Foods" }]}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Your Custom Foods</CardTitle>
            <Button onClick={openCreateDialog} data-testid="button-create-food">
              <Plus className="h-4 w-4 mr-2" />
              Add Food
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-foods"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : filteredFoods.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-md">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No foods in your library yet</p>
                <p className="text-sm mb-4">Add custom foods with nutrition data to use across your recipes</p>
                <Button variant="outline" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Food
                </Button>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Source</TableHead>
                      <TableHead className="text-right font-mono">Cal</TableHead>
                      <TableHead className="text-right font-mono">P</TableHead>
                      <TableHead className="text-right font-mono">C</TableHead>
                      <TableHead className="text-right font-mono">F</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFoods.map((food) => (
                      <TableRow key={food.id} data-testid={`row-food-${food.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{food.name}</div>
                            {food.krogerProductId && (
                              <a
                                href={`https://www.kroger.com/p/${food.krogerProductId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5 hover:underline"
                              >
                                <Package className="h-3 w-3" />
                                {food.krogerProductName || "View on Kroger"}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {food.dataType || "Custom"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{Math.round(food.caloriesPer100g ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono">{food.proteinPer100g?.toFixed(1) ?? "0.0"}</TableCell>
                        <TableCell className="text-right font-mono">{food.carbsPer100g?.toFixed(1) ?? "0.0"}</TableCell>
                        <TableCell className="text-right font-mono">{food.fatPer100g?.toFixed(1) ?? "0.0"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(food)}
                              data-testid={`button-edit-food-${food.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(food.id)}
                              data-testid={`button-delete-food-${food.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFood ? "Edit Food" : "Add Custom Food"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Chicken breast"
                  required
                  data-testid="input-food-name"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="serving-mode" className="flex-1 text-sm">
                  Enter nutrition per serving size
                </Label>
                <Switch
                  id="serving-mode"
                  checked={useServingMode}
                  onCheckedChange={(checked) => {
                    setUseServingMode(checked);
                    if (checked) {
                      setFormData({ ...formData, servingSize: 100 });
                    }
                  }}
                  data-testid="switch-serving-mode"
                />
              </div>

              {useServingMode && (
                <div className="space-y-2">
                  <Label htmlFor="servingSize">Serving Size (grams)</Label>
                  <Input
                    id="servingSize"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.servingSize}
                    onChange={(e) => setFormData({ ...formData, servingSize: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                    data-testid="input-serving-size"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the serving size from the nutrition label (e.g., 28g for chips)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Nutrition per {useServingMode ? `${formData.servingSize || 100}g serving` : "100g"}
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Calories</Label>
                    <Input
                      type="number"
                      value={formData.caloriesPerServing}
                      onChange={(e) => setFormData({ ...formData, caloriesPerServing: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                      data-testid="input-food-calories"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Protein (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.proteinPerServing}
                      onChange={(e) => setFormData({ ...formData, proteinPerServing: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                      data-testid="input-food-protein"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Carbs (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.carbsPerServing}
                      onChange={(e) => setFormData({ ...formData, carbsPerServing: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                      data-testid="input-food-carbs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Fat (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.fatPerServing}
                      onChange={(e) => setFormData({ ...formData, fatPerServing: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                      data-testid="input-food-fat"
                    />
                  </div>
                </div>
              </div>

              {useServingMode && formData.servingSize !== 100 && formData.servingSize > 0 && (
                <div className="p-3 rounded-md bg-muted/50 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Stored as per 100g:</p>
                  <div className="flex gap-4 text-xs font-mono">
                    <span>{Math.round(per100gPreview.calories)} cal</span>
                    <span>{per100gPreview.protein.toFixed(1)}g protein</span>
                    <span>{per100gPreview.carbs.toFixed(1)}g carbs</span>
                    <span>{per100gPreview.fat.toFixed(1)}g fat</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="krogerProductId">Kroger Product ID (optional)</Label>
                <Input
                  id="krogerProductId"
                  value={formData.krogerProductId}
                  onChange={(e) => setFormData({ ...formData, krogerProductId: e.target.value })}
                  placeholder="Link to Kroger product for shopping"
                  data-testid="input-food-kroger-id"
                />
                {formData.krogerProductId && (
                  <a
                    href={`https://www.kroger.com/p/${formData.krogerProductId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View product on Kroger
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="krogerProductName">Kroger Product Name (optional)</Label>
                <Input
                  id="krogerProductName"
                  value={formData.krogerProductName}
                  onChange={(e) => setFormData({ ...formData, krogerProductName: e.target.value })}
                  placeholder="Display name for Kroger product"
                  data-testid="input-food-kroger-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-food"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
