import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shadcn/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shadcn/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/components/ui/popover";
import { Label } from "@/shadcn/components/ui/label";
import { cn } from "@/shadcn/lib/utils/utils";
import {
  searchLocations,
  type LocationSearchResult,
} from "@/lib/open-meteo";

type SearchStatus = "idle" | "loading" | "success" | "error";

export function LocationCombobox({
  value,
  onChange,
  onError,
}: {
  value: LocationSearchResult | null;
  onChange: (location: LocationSearchResult | null) => void;
  onError?: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [options, setOptions] = useState<LocationSearchResult[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
      setStatus("idle");
      setOptions([]);
      onError?.(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setStatus("loading");
      onError?.(null);

      searchLocations(trimmedQuery)
        .then((results) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          setOptions(results);
          setStatus("success");
        })
        .catch((error) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          const message =
            error instanceof Error ? error.message : "Falha ao buscar locais.";
          setOptions([]);
          setStatus("error");
          onError?.(message);
        });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [query, onError]);

  const selectedLabel = value ? locationLabel(value) : "Buscar cidade ou local";
  const emptyMessage = useMemo(() => {
    if (status === "loading") {
      return "Buscando locais...";
    }

    if (status === "error") {
      return "Não foi possível buscar agora. Tente novamente.";
    }

    if (query.trim().length < 3) {
      return "Digite pelo menos 3 caracteres para pesquisar.";
    }

    return "Nenhum local encontrado.";
  }, [query, status]);

  return (
    <div className="location-combobox">
      <Label htmlFor="location-combobox">Buscar local</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="location-combobox"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("location-combobox-trigger", !value && "is-empty")}
          >
            <span className="location-combobox-value">
              <MapPin />
              {selectedLabel}
            </span>
            <span className="location-combobox-actions">
              {value ? (
                <X
                  aria-label="Limpar local selecionado"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(null);
                    setQuery("");
                    setOptions([]);
                  }}
                />
              ) : null}
              <ChevronsUpDown />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="location-combobox-popover">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Ex.: Niterói, RJ"
              isLoading={status === "loading"}
            />
            <CommandList>
              {options.length > 0 ? (
                <CommandGroup>
                  {options.map((location) => {
                    const optionValue = location.id.toString();
                    const isSelected = value?.id === location.id;

                    return (
                      <CommandItem
                        key={optionValue}
                        value={optionValue}
                        onSelect={() => {
                          onChange(location);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <div className="location-option">
                          <strong>{location.name}</strong>
                          <span>
                            {[location.admin1, location.country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                          <small>
                            {formatCoordinate(location.latitude)},{" "}
                            {formatCoordinate(location.longitude)}
                          </small>
                        </div>
                        <Check className={isSelected ? "is-selected" : ""} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function locationLabel(location: LocationSearchResult): string {
  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(", ");
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}
