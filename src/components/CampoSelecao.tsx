import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Opcao = { valor: string; rotulo: string };

export function CampoSelecao({
  opcoes,
  valor,
  aoMudar,
  placeholder,
  rotulo,
}: {
  opcoes: Opcao[];
  valor: string | null;
  aoMudar: (valor: string | null) => void;
  placeholder: string;
  rotulo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionada = opcoes.find((o) => o.valor === valor);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={aberto}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{selecionada?.rotulo ?? placeholder}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__todos__"
                  onSelect={() => {
                    aoMudar(null);
                    setAberto(false);
                  }}
                >
                  <Check className={cn(valor === null ? "opacity-100" : "opacity-0")} />
                  Todos
                </CommandItem>
                {opcoes.map((o) => (
                  <CommandItem
                    key={o.valor}
                    value={`${o.rotulo} ${o.valor}`}
                    onSelect={() => {
                      aoMudar(o.valor);
                      setAberto(false);
                    }}
                  >
                    <Check className={cn(valor === o.valor ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.rotulo}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
