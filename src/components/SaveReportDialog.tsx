import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSaveRow } from "@/lib/db";
import type { Sheet } from "@/lib/export";

export type ReportKind = "daily" | "weekly" | "monthly";

/** Rename the generated report, then keep it in the records panel. */
export function SaveReportDialog({
  kind,
  from,
  to,
  heading,
  sheets,
  theory,
  defaultName,
}: {
  kind: ReportKind;
  from: string;
  to: string;
  heading: string;
  sheets: Sheet[];
  theory: string[];
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const save = useSaveRow("saved_reports");

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Save className="mr-1 h-4 w-4" /> Save report
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name this report</DialogTitle>
            <DialogDescription>
              Give it a name before saving. It is kept in the records panel with the dates
              {` ${from} → ${to}`}, so you can export it again any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Report name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!name.trim()) {
                  toast.error("Type a name for the report.");
                  return;
                }
                save.mutate({
                  name: name.trim(),
                  kind,
                  from_date: from,
                  to_date: to,
                  heading,
                  sheets: sheets as unknown as Record<string, unknown>[],
                  theory,
                });
                setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
