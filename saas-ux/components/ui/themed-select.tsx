// components/ui/themed-select.tsx
"use client";

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface ThemedSelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Shown before the label, e.g. a flag. */
  icon?: ReactNode;
}

interface ThemedSelectProps<T extends string | number> {
  id?: string;
  label?: string;
  value: T;
  options: ReadonlyArray<ThemedSelectOption<T>>;
  onChange: (value: T) => void;
}

/**
 * A select that follows the app theme in light and dark (the native list
 * renders with the operating system's colours, which clash on dark pages).
 * Keyboard and screen reader behaviour comes from Headless UI's Listbox.
 */
export function ThemedSelect<T extends string | number>({ id, label, value, options, onChange }: ThemedSelectProps<T>) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          id={id}
          aria-label={label}
          className="gs-select flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm"
        >
          {selected?.icon}
          <span className="flex-1 truncate">{selected?.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          transition
          className="gs-select-options z-50 w-[var(--button-width)] rounded-lg border p-1 shadow-xl [--anchor-gap:4px] focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="gs-select-option group flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm"
            >
              {option.icon}
              <span className="flex-1">{option.label}</span>
              <Check className="invisible h-4 w-4 group-data-[selected]:visible" aria-hidden="true" />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
