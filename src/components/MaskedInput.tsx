"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { formatInput, maskPlaceholder, type MaskKind } from "@/lib/input-masks";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  kind: MaskKind;
  onValueChange?: (value: string) => void;
};

export const MaskedInput = forwardRef<HTMLInputElement, Props>(function MaskedInput(
  { kind, value, onChange, onValueChange, placeholder, ...props }, ref
) {
  return <input {...props} ref={ref} type="text" inputMode="numeric"
    placeholder={placeholder ?? maskPlaceholder[kind]}
    value={value === undefined ? undefined : formatInput(String(value), kind)}
    onChange={(event) => {
      const formatted = formatInput(event.target.value, kind);
      event.target.value = formatted;
      onValueChange?.(formatted);
      onChange?.(event);
    }} />;
});
