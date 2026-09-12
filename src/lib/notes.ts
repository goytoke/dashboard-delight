import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Note {
  id: string;
  author_id: string;
  title: string;
  body: string | null;
  is_todo: boolean;
  deadline: string | null;
  progress: number;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Note[];
    },
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<Note> & { id?: string }) => {
      const { id, ...rest } = row;
      if (id) {
        const { error } = await supabase
          .from("notes")
          .update(rest as never)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("notes")
        .insert({ ...rest, author_id: userData.user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admins see a read-only mirror of the workspace; everyone else gets the normal console. */
export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
