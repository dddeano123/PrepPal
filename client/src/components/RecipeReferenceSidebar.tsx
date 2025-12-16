import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Package, Wrench } from "lucide-react";
import { useState } from "react";
import type { PantryStaple, Tool } from "@shared/schema";

interface RecipeReferenceSidebarProps {
  onAddPantryStaple?: (name: string) => void;
  onAddTool?: (name: string) => void;
}

export function RecipeReferenceSidebar({ onAddPantryStaple, onAddTool }: RecipeReferenceSidebarProps) {
  const [pantryOpen, setPantryOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  const { data: pantryStaples, isLoading: loadingPantry } = useQuery<PantryStaple[]>({
    queryKey: ["/api/pantry-staples"],
  });

  const { data: userTools, isLoading: loadingTools } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reference</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={pantryOpen} onOpenChange={setPantryOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2"
              data-testid="button-toggle-pantry-section"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Pantry Staples
                {pantryStaples && (
                  <Badge variant="secondary" className="ml-1">
                    {pantryStaples.length}
                  </Badge>
                )}
              </span>
              {pantryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-[150px] mt-2">
              {loadingPantry ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-5/6" />
                </div>
              ) : pantryStaples && pantryStaples.length > 0 ? (
                <div className="flex flex-wrap gap-1 px-2">
                  {pantryStaples.map((staple) => (
                    <Badge
                      key={staple.id}
                      variant="outline"
                      className="text-xs cursor-pointer"
                      onClick={() => onAddPantryStaple?.(staple.name)}
                      data-testid={`badge-pantry-${staple.id}`}
                    >
                      {staple.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground px-2">
                  No pantry staples defined. Add ingredients as pantry staples from your recipes.
                </p>
              )}
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2"
              data-testid="button-toggle-tools-section"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Wrench className="h-4 w-4" />
                My Tools
                {userTools && (
                  <Badge variant="secondary" className="ml-1">
                    {userTools.length}
                  </Badge>
                )}
              </span>
              {toolsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-[150px] mt-2">
              {loadingTools ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-5/6" />
                </div>
              ) : userTools && userTools.length > 0 ? (
                <div className="flex flex-wrap gap-1 px-2">
                  {userTools.map((tool) => (
                    <Badge
                      key={tool.id}
                      variant="outline"
                      className="text-xs cursor-pointer"
                      onClick={() => onAddTool?.(tool.name)}
                      data-testid={`badge-tool-${tool.id}`}
                    >
                      {tool.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground px-2">
                  No tools in your inventory. Add tools to recipes to build your collection.
                </p>
              )}
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
