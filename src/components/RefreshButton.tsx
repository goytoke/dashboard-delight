import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RefreshButton() {
  const qc = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  const refresh = async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    await qc.refetchQueries({ type: "active" });
    setSpinning(false);
    toast.success("Refreshed");
  };

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Refresh data"
      title="Refresh"
      onClick={refresh}
      disabled={spinning}
    >
      <RotateCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
    </Button>
  );
}
