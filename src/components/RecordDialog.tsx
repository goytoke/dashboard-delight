import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Row } from "@/lib/db";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "password" | "textarea" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
};

const NONE = "__none__";

export function RecordDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  onSubmit,
  extra,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FieldSpec[];
  initial?: Row | null;
  onSubmit: (values: Row) => void;
  extra?: ReactNode;
}) {
  const [values, setValues] = useState<Row>({});

  useEffect(() => {
    if (!open) return;
    const base: Row = {};
    fields.forEach((f) => {
      const v = initial?.[f.name];
      base[f.name] = v === null || v === undefined ? "" : v;
    });
    if (initial?.["id"]) base["id"] = initial["id"];
    setValues(base);
  }, [open, initial, fields]);

  const set = (name: string, v: unknown) => setValues((p) => ({ ...p, [name]: v }));

  const submit = () => {
    const out: Row = {};
    if (values["id"]) out["id"] = values["id"];
    fields.forEach((f) => {
      const raw = values[f.name];
      if (f.type === "number") out[f.name] = raw === "" ? null : Number(raw);
      else out[f.name] = raw === "" || raw === NONE ? null : raw;
    });
    onSubmit(out);
  };

  const missing = fields.some((f) => f.required && !values[f.name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div
              key={f.name}
              className={f.full || f.type === "textarea" ? "col-span-2 space-y-1.5" : "space-y-1.5"}
            >
              <Label htmlFor={f.name} className="text-xs text-muted-foreground">
                {f.label}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                  rows={2}
                />
              ) : f.type === "select" ? (
                <Select
                  value={String(values[f.name] ?? "") || NONE}
                  onValueChange={(v) => set(f.name, v === NONE ? "" : v)}
                >
                  <SelectTrigger id={f.name}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value={NONE}>None</SelectItem>}
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={f.name}
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                />
              )}
            </div>
          ))}
          {extra}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={missing}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
