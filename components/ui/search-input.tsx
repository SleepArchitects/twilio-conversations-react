"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  placeholder?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  delay?: number;
}

export function SearchInput({
  placeholder = "Search...",
  defaultValue = "",
  onChange,
  className,
  delay = 300,
}: SearchInputProps) {
  const [value, setValue] = React.useState(defaultValue);

  // Sync internal state if defaultValue changes externally
  React.useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const debouncedOnChange = useDebouncedCallback((newValue: string) => {
    onChange?.(newValue);
  }, delay);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedOnChange(newValue);
  };

  const handleClear = () => {
    setValue("");
    onChange?.("");
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9 pr-9 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-400 focus-visible:ring-purple-500"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white focus:outline-none"
          type="button"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
