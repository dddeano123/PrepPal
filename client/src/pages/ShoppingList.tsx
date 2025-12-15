import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  Copy,
  Check,
  Plus,
  X,
  ChefHat,
  Link2,
  Settings2,
  Trash2,
  Store,
  MapPin,
  Loader2,
  ExternalLink,
  Unlink,
} from "lucide-react";
import { SiKroger } from "react-icons/si";
import { formatMacro } from "@/lib/macros";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RecipeWithIngredients, ShoppingListItem, IngredientAlias, PantryStaple } from "@shared/schema";

interface KrogerStatus {
  isConfigured: boolean;
  isConnected: boolean;
  locationId: string | null;
}

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  images?: { perspective: string; sizes: { size: string; url: string }[] }[];
  items?: { price?: { regular: number; promo?: number }; size?: string }[];
}

interface KrogerLocation {
  locationId: string;
  chain: string;
  name: string;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

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

// Kroger Add to Cart Dialog Component
function KrogerAddToCartDialog({
  open,
  onOpenChange,
  shoppingItems,
  selectedProducts,
  setSelectedProducts,
  onAddToCart,
  isAdding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoppingItems: ShoppingListItem[];
  selectedProducts: Map<string, { upc: string; quantity: number }>;
  setSelectedProducts: (products: Map<string, { upc: string; quantity: number }>) => void;
  onAddToCart: () => void;
  isAdding: boolean;
}) {
  const [searchResults, setSearchResults] = useState<Map<string, KrogerProduct[]>>(new Map());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  
  const searchProduct = async (itemName: string) => {
    setLoadingItems((prev) => new Set(prev).add(itemName));
    try {
      const response = await fetch(`/api/kroger/products?term=${encodeURIComponent(itemName)}`);
      if (response.ok) {
        const products = await response.json();
        setSearchResults((prev) => new Map(prev).set(itemName, products));
      } else if (response.status === 401) {
        toast({
          title: "Session Expired",
          description: "Please reconnect your Kroger account.",
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/kroger/status"] });
      } else {
        toast({
          title: "Search Failed",
          description: "Could not search Kroger products. Try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching products:", error);
      toast({
        title: "Connection Error",
        description: "Could not connect to Kroger. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemName);
        return next;
      });
    }
  };

  const selectProduct = (itemName: string, product: KrogerProduct) => {
    setSelectedProducts(
      new Map(selectedProducts).set(itemName, { upc: product.upc, quantity: 1 })
    );
  };

  const removeProduct = (itemName: string) => {
    const next = new Map(selectedProducts);
    next.delete(itemName);
    setSelectedProducts(next);
  };

  const getProductImage = (product: KrogerProduct): string | null => {
    const frontImage = product.images?.find((img) => img.perspective === "front");
    const thumbnail = frontImage?.sizes?.find((s) => s.size === "thumbnail" || s.size === "small");
    return thumbnail?.url || null;
  };

  const getProductPrice = (product: KrogerProduct): string | null => {
    const price = product.items?.[0]?.price;
    if (price?.promo) {
      return `$${price.promo.toFixed(2)}`;
    }
    if (price?.regular) {
      return `$${price.regular.toFixed(2)}`;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Add to Kroger Cart
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Search for products and add them to your Kroger cart. Click on an ingredient to search for matching products.
        </p>
        <ScrollArea className="flex-1 mt-4">
          <div className="space-y-3 pr-4">
            {shoppingItems.map((item) => {
              const selected = selectedProducts.get(item.displayName);
              const results = searchResults.get(item.displayName);
              const isLoading = loadingItems.has(item.displayName);

              return (
                <div
                  key={item.displayName}
                  className="border rounded-md p-3"
                  data-testid={`kroger-item-${item.displayName.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.displayName}</span>
                      <Badge variant="outline" size="sm" className="font-mono">
                        {formatMacro(item.totalGrams, 0)}g
                      </Badge>
                    </div>
                    {selected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(item.displayName)}
                        data-testid={`button-remove-kroger-product-${item.displayName.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => searchProduct(item.displayName)}
                        disabled={isLoading}
                        data-testid={`button-search-kroger-${item.displayName.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Search"
                        )}
                      </Button>
                    )}
                  </div>

                  {selected && (
                    <div className="mt-2 p-2 bg-muted/50 rounded-md flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Product selected</span>
                    </div>
                  )}

                  {!selected && results && results.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {results.slice(0, 5).map((product) => {
                        const imageUrl = getProductImage(product);
                        const price = getProductPrice(product);
                        return (
                          <div
                            key={product.productId}
                            className="flex items-center gap-3 p-2 rounded-md border hover-elevate cursor-pointer"
                            onClick={() => selectProduct(item.displayName, product)}
                            data-testid={`product-${product.productId}`}
                          >
                            {imageUrl && (
                              <img
                                src={imageUrl}
                                alt={product.description}
                                className="w-12 h-12 object-contain rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {product.description}
                              </p>
                              {product.brand && (
                                <p className="text-xs text-muted-foreground">
                                  {product.brand}
                                </p>
                              )}
                            </div>
                            {price && (
                              <span className="text-sm font-mono font-medium">
                                {price}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!selected && results && results.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No products found. Try searching with different terms.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4">
          <div className="flex items-center justify-between w-full gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedProducts.size} of {shoppingItems.length} items selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={onAddToCart}
                disabled={selectedProducts.size === 0 || isAdding}
                data-testid="button-confirm-add-to-kroger"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4 mr-2" />
                )}
                Add {selectedProducts.size} to Cart
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const searchString = useSearch();
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [excludePantryStaples, setExcludePantryStaples] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [pantryDialogOpen, setPantryDialogOpen] = useState(false);
  const [krogerDialogOpen, setKrogerDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [newAliasCanonical, setNewAliasCanonical] = useState("");
  const [newAliasName, setNewAliasName] = useState("");
  const [newPantryStaple, setNewPantryStaple] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { upc: string; quantity: number }>>(new Map());

  // Handle Kroger OAuth callback notifications
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("kroger") === "connected") {
      toast({
        title: "Kroger Connected",
        description: "Your Kroger account is now connected. You can add items to your cart.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/kroger/status"] });
      window.history.replaceState({}, "", "/shopping-list");
    } else if (params.get("error") === "kroger_auth_failed") {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Kroger. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/shopping-list");
    }
  }, [searchString, toast]);

  const { data: recipes, isLoading } = useQuery<RecipeWithIngredients[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: aliases } = useQuery<IngredientAlias[]>({
    queryKey: ["/api/ingredient-aliases"],
  });

  const { data: pantryStaples } = useQuery<PantryStaple[]>({
    queryKey: ["/api/pantry-staples"],
  });

  const { data: krogerStatus, isLoading: krogerStatusLoading } = useQuery<KrogerStatus>({
    queryKey: ["/api/kroger/status"],
  });

  const { data: krogerLocations, refetch: refetchLocations, isFetching: locationsLoading } = useQuery<KrogerLocation[]>({
    queryKey: ["/api/kroger/locations", zipCode],
    enabled: false,
  });

  // Connect to Kroger
  const connectKrogerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/kroger/auth-url");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to get auth URL");
      }
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to Kroger",
        variant: "destructive",
      });
    },
  });

  // Disconnect from Kroger
  const disconnectKrogerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/kroger/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kroger/status"] });
      toast({
        title: "Disconnected",
        description: "Your Kroger account has been disconnected.",
      });
    },
  });

  // Set Kroger location
  const setLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      await apiRequest("PUT", "/api/kroger/location", { locationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kroger/status"] });
      setStoreDialogOpen(false);
      toast({
        title: "Store Selected",
        description: "Your preferred Kroger store has been saved.",
      });
    },
  });

  // Add items to Kroger cart
  const addToCartMutation = useMutation({
    mutationFn: async (items: { upc: string; quantity: number }[]) => {
      const response = await apiRequest("POST", "/api/kroger/cart", { items });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add to cart");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Added to Kroger Cart",
        description: `${data.itemCount} item(s) added to your Kroger cart.`,
      });
      setSelectedProducts(new Map());
      setKrogerDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add items to cart",
        variant: "destructive",
      });
    },
  });

  // Build pantry staples lookup set
  const pantryStaplesSet = useMemo(() => {
    const set = new Set<string>();
    pantryStaples?.forEach((staple) => {
      set.add(staple.name.toLowerCase().trim());
    });
    return set;
  }, [pantryStaples]);

  // Build alias lookup map
  const aliasMap = useMemo(() => {
    const map = new Map<string, string>();
    aliases?.forEach((alias) => {
      map.set(alias.aliasName.toLowerCase().trim(), alias.canonicalName.toLowerCase().trim());
    });
    return map;
  }, [aliases]);

  const createAliasMutation = useMutation({
    mutationFn: async (data: { canonicalName: string; aliasName: string }) => {
      const response = await apiRequest("POST", "/api/ingredient-aliases", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create alias");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-aliases"] });
      toast({
        title: "Alias created",
        description: "The ingredient alias has been saved.",
      });
      setNewAliasCanonical("");
      setNewAliasName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create alias. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ingredient-aliases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-aliases"] });
      toast({
        title: "Alias deleted",
        description: "The ingredient alias has been removed.",
      });
    },
  });

  const createPantryStapleMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/pantry-staples", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add pantry staple");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry-staples"] });
      toast({
        title: "Pantry staple added",
        description: "This ingredient will be excluded from shopping lists.",
      });
      setNewPantryStaple("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add pantry staple. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deletePantryStapleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pantry-staples/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry-staples"] });
      toast({
        title: "Pantry staple removed",
        description: "This ingredient will appear in shopping lists.",
      });
    },
  });

  const shoppingItems = useMemo(() => {
    if (!recipes) return [];

    const selectedRecipes = recipes.filter((r) =>
      selectedRecipeIds.includes(r.id)
    );

    const itemMap = new Map<string, ShoppingListItem>();

    // Build reverse alias map to get canonical name for display
    const reverseAliasMap = new Map<string, string>();
    aliases?.forEach((alias) => {
      // Capitalize the canonical name for display
      const canonical = alias.canonicalName.trim();
      const displayCanonical = canonical.charAt(0).toUpperCase() + canonical.slice(1);
      reverseAliasMap.set(alias.aliasName.toLowerCase().trim(), displayCanonical);
    });

    // Helper function to get canonical name key
    const getCanonicalKey = (name: string) => {
      const normalized = name.toLowerCase().trim();
      return aliasMap.get(normalized) || normalized;
    };

    // Helper function to get display name (capitalize canonical if alias exists)
    const getDisplayName = (name: string) => {
      const normalized = name.toLowerCase().trim();
      const canonicalDisplay = reverseAliasMap.get(normalized);
      return canonicalDisplay || name;
    };

    for (const recipe of selectedRecipes) {
      for (const ingredient of recipe.ingredients) {
        // Check if ingredient is a pantry staple (either marked on ingredient or in user's pantry list)
        const normalizedName = ingredient.displayName.toLowerCase().trim();
        const isPantry = ingredient.isPantryStaple || pantryStaplesSet.has(normalizedName);
        if (excludePantryStaples && isPantry) continue;

        // Use canonical name for consolidation key
        const key = getCanonicalKey(ingredient.displayName);
        const existing = itemMap.get(key);

        if (existing) {
          existing.totalGrams += ingredient.grams;
          if (!existing.recipeNames.includes(recipe.title)) {
            existing.recipeNames.push(recipe.title);
          }
          if (ingredient.amount && ingredient.unit) {
            existing.amounts.push({
              amount: ingredient.amount,
              unit: ingredient.unit,
              recipeName: recipe.title,
            });
          }
        } else {
          // Use canonical display name if ingredient is an alias
          const displayName = getDisplayName(ingredient.displayName);
          itemMap.set(key, {
            displayName,
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
  }, [recipes, selectedRecipeIds, excludePantryStaples, aliasMap, aliases, pantryStaplesSet]);

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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Kroger Integration Button */}
            {krogerStatus?.isConfigured && (
              <>
                {krogerStatus.isConnected ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" data-testid="button-kroger-menu">
                        <Store className="h-4 w-4 mr-2" />
                        Kroger
                        <Badge variant="secondary" size="sm" className="ml-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Connected
                        </Badge>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56" align="end">
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => setStoreDialogOpen(true)}
                          data-testid="button-select-store"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          {krogerStatus.locationId ? "Change Store" : "Select Store"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-destructive"
                          onClick={() => disconnectKrogerMutation.mutate()}
                          disabled={disconnectKrogerMutation.isPending}
                          data-testid="button-disconnect-kroger"
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => connectKrogerMutation.mutate()}
                    disabled={connectKrogerMutation.isPending}
                    data-testid="button-connect-kroger"
                  >
                    {connectKrogerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Store className="h-4 w-4 mr-2" />
                    )}
                    Connect Kroger
                  </Button>
                )}
              </>
            )}
            <Dialog open={pantryDialogOpen} onOpenChange={setPantryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-manage-pantry">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Pantry
                  {pantryStaples && pantryStaples.length > 0 && (
                    <Badge variant="secondary" size="sm" className="ml-1">
                      {pantryStaples.length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Pantry Staples</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Items you always have on hand. These will be excluded from shopping lists when the "Exclude pantry staples" option is enabled.
                </p>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., salt, olive oil, garlic"
                      value={newPantryStaple}
                      onChange={(e) => setNewPantryStaple(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newPantryStaple.trim()) {
                          createPantryStapleMutation.mutate({ name: newPantryStaple.trim() });
                        }
                      }}
                      data-testid="input-pantry-staple"
                    />
                    <Button
                      onClick={() => {
                        if (newPantryStaple.trim()) {
                          createPantryStapleMutation.mutate({ name: newPantryStaple.trim() });
                        }
                      }}
                      disabled={!newPantryStaple.trim() || createPantryStapleMutation.isPending}
                      data-testid="button-add-pantry-staple"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {pantryStaples && pantryStaples.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-muted-foreground">Your pantry staples</Label>
                    <ScrollArea className="max-h-[250px] mt-2">
                      <div className="flex flex-wrap gap-2">
                        {pantryStaples.map((staple) => (
                          <Badge
                            key={staple.id}
                            variant="secondary"
                            className="pr-1 gap-1"
                            data-testid={`pantry-staple-${staple.id}`}
                          >
                            {staple.name}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1 p-0"
                              onClick={() => deletePantryStapleMutation.mutate(staple.id)}
                              data-testid={`button-delete-pantry-${staple.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            {selectedRecipeIds.length > 0 && (
              <>
                <Button onClick={copyToClipboard} variant="outline" data-testid="button-copy-list">
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
                {krogerStatus?.isConnected && (
                  <Button onClick={() => setKrogerDialogOpen(true)} data-testid="button-add-to-kroger">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Kroger Cart
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Store Selection Dialog */}
      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Your Kroger Store</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter your zip code to find nearby Kroger stores.
          </p>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter zip code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                maxLength={5}
                data-testid="input-zip-code"
              />
              <Button
                onClick={() => refetchLocations()}
                disabled={zipCode.length < 5 || locationsLoading}
                data-testid="button-search-stores"
              >
                {locationsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
            {krogerLocations && krogerLocations.length > 0 && (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {krogerLocations.map((location) => (
                    <div
                      key={location.locationId}
                      className="flex items-center justify-between gap-2 p-3 rounded-md border hover-elevate cursor-pointer"
                      onClick={() => setLocationMutation.mutate(location.locationId)}
                      data-testid={`store-${location.locationId}`}
                    >
                      <div>
                        <p className="font-medium">{location.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {location.address.addressLine1}, {location.address.city}
                        </p>
                      </div>
                      {krogerStatus?.locationId === location.locationId && (
                        <Badge variant="secondary" size="sm">
                          <Check className="h-3 w-3 mr-1" />
                          Selected
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {krogerLocations && krogerLocations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Kroger stores found near this zip code.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Kroger Add to Cart Dialog */}
      <KrogerAddToCartDialog
        open={krogerDialogOpen}
        onOpenChange={setKrogerDialogOpen}
        shoppingItems={shoppingItems}
        selectedProducts={selectedProducts}
        setSelectedProducts={setSelectedProducts}
        onAddToCart={() => {
          const items = Array.from(selectedProducts.values());
          if (items.length > 0) {
            addToCartMutation.mutate(items);
          }
        }}
        isAdding={addToCartMutation.isPending}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {selectedRecipeIds.length === 0 ? (
            <ShoppingListEmptyState
              onSelectRecipes={() => setSelectDialogOpen(true)}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="exclude-pantry"
                      checked={excludePantryStaples}
                      onCheckedChange={setExcludePantryStaples}
                      data-testid="switch-exclude-pantry"
                    />
                    <Label htmlFor="exclude-pantry">Exclude pantry staples</Label>
                  </div>
                  <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid="button-manage-aliases">
                        <Link2 className="h-4 w-4 mr-1" />
                        Aliases
                        {aliases && aliases.length > 0 && (
                          <Badge variant="secondary" size="sm" className="ml-1">
                            {aliases.length}
                          </Badge>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Ingredient Aliases</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Group similar ingredients together. For example, "chicken breast boneless" can be an alias for "chicken breast".
                      </p>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="canonical">Base ingredient name</Label>
                          <Input
                            id="canonical"
                            placeholder="e.g., chicken breast"
                            value={newAliasCanonical}
                            onChange={(e) => setNewAliasCanonical(e.target.value)}
                            data-testid="input-alias-canonical"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="alias">Alias (will be grouped as above)</Label>
                          <Input
                            id="alias"
                            placeholder="e.g., chicken breast boneless"
                            value={newAliasName}
                            onChange={(e) => setNewAliasName(e.target.value)}
                            data-testid="input-alias-name"
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (newAliasCanonical.trim() && newAliasName.trim()) {
                              createAliasMutation.mutate({
                                canonicalName: newAliasCanonical.trim(),
                                aliasName: newAliasName.trim(),
                              });
                            }
                          }}
                          disabled={!newAliasCanonical.trim() || !newAliasName.trim() || createAliasMutation.isPending}
                          data-testid="button-add-alias"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Alias
                        </Button>
                      </div>
                      {aliases && aliases.length > 0 && (
                        <div className="mt-4">
                          <Label className="text-muted-foreground">Existing aliases</Label>
                          <ScrollArea className="max-h-[200px] mt-2">
                            <div className="space-y-2">
                              {aliases.map((alias) => (
                                <div
                                  key={alias.id}
                                  className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50"
                                  data-testid={`alias-item-${alias.id}`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm truncate">
                                      <span className="text-muted-foreground">{alias.aliasName}</span>
                                      <span className="mx-2 text-muted-foreground/50">&rarr;</span>
                                      <span className="font-medium">{alias.canonicalName}</span>
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteAliasMutation.mutate(alias.id)}
                                    data-testid={`button-delete-alias-${alias.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
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
