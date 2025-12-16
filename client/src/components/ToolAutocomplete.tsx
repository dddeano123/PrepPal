import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Tool } from "@shared/schema";

interface ToolAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onDelete: () => void;
  index: number;
}

export function ToolAutocomplete({ value, onChange, onDelete, index }: ToolAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useQuery<Tool[]>({
    queryKey: ["/api/tools/search", inputValue],
    enabled: inputValue.length >= 1,
  });

  const createToolMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/tools", { name });
      return await response.json() as Tool;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
    },
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (inputValue !== value) {
          handleSelectTool(inputValue);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, value]);

  const handleSelectTool = async (toolName: string) => {
    const trimmedName = toolName.trim();
    if (!trimmedName) return;
    
    const existingTool = suggestions?.find(
      t => t.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (!existingTool) {
      try {
        await createToolMutation.mutateAsync(trimmedName);
      } catch {
      }
    }
    
    onChange(trimmedName);
    setInputValue(trimmedName);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSelectTool(inputValue);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const filteredSuggestions = suggestions?.filter(
    t => t.name.toLowerCase().includes(inputValue.toLowerCase())
  ) || [];

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="e.g., Rice cooker, Pan"
        className="h-8 w-40 bg-transparent border-0 focus-visible:ring-0"
        data-testid={`input-tool-${index}`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onDelete}
        data-testid={`button-delete-tool-${index}`}
      >
        <X className="h-3 w-3" />
      </Button>

      {isOpen && inputValue.length >= 1 && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-50 max-h-40 overflow-auto">
          {filteredSuggestions.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover-elevate",
                tool.name.toLowerCase() === inputValue.toLowerCase() && "bg-accent"
              )}
              onClick={() => {
                onChange(tool.name);
                setInputValue(tool.name);
                setIsOpen(false);
              }}
              data-testid={`suggestion-tool-${tool.id}`}
            >
              {tool.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
