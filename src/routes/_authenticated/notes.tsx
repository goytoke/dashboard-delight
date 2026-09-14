import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, ListTodo, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useDeleteNote, useNotes, useSaveNote, type Note } from "@/lib/notes";
import { today } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes & To-do — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Write notes, move the important ones onto a to-do list with a deadline and track progress with a bar.",
      },
      { property: "og:title", content: "Notes & To-do — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Shared notes, to-do list with deadlines and progress tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { data: notes = [] } = useNotes();
  const save = useSaveNote();
  const remove = useDeleteNote();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");


  const todos = useMemo(() => notes.filter((n) => n.is_todo), [notes]);
  const plain = useMemo(() => notes.filter((n) => !n.is_todo), [notes]);
  const overall = todos.length
    ? Math.round(todos.reduce((s, n) => s + (n.done ? 100 : n.progress), 0) / todos.length)
    : 0;

  const addNote = () => {
    if (!title.trim()) {
      toast.error("Type a title first.");
      return;
    }
    save.mutate(
      { title: title.trim(), body: body.trim() || null },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
        },
      },
    );
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & to-do"
        subtitle="Write anything down. Move what matters onto the to-do list with a deadline and progress."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Details (optional)</Label>
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button onClick={addNote} disabled={save.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add note
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" /> To-do list ({todos.length})
          </CardTitle>
          <div className="w-40">
            <Progress value={overall} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{overall}% done</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {todos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing on the to-do list. Anything left as a plain note counts as “not necessary”.
            </p>
          )}
          {todos.map((n) => (
            <TodoRow key={n.id} note={n} onSave={save.mutate} onDelete={remove.mutate} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes ({plain.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plain.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {plain.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{n.title}</div>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  written {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    save.mutate({ id: n.id, is_todo: true, deadline: n.deadline ?? today() })
                  }
                >
                  <ListTodo className="mr-1 h-4 w-4" /> Add to to-do
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete note"
                  onClick={() => {
                    if (confirm(`Delete “${n.title}”?`)) remove.mutate(n.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Admin logins are created on the “Admin accounts” page in the side menu.
      </p>
    </div>
  );
}

export function TodoRow({
  note,
  onSave,
  onDelete,
  readOnly = false,
}: {
  note: Note;
  onSave?: (row: Partial<Note> & { id: string }) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}) {
  const [progress, setProgress] = useState(note.progress);
  const late = note.deadline && !note.done && note.deadline < today();

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            {note.done && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {note.title}
          </div>
          {note.body && <p className="text-sm text-muted-foreground">{note.body}</p>}
        </div>
        <div className="flex items-center gap-2">
          {note.deadline && (
            <Badge variant={late ? "destructive" : "outline"}>Due {note.deadline}</Badge>
          )}
          <Badge variant="secondary">{note.done ? 100 : note.progress}%</Badge>
        </div>
      </div>

      <Progress value={note.done ? 100 : note.progress} />

      {!readOnly && onSave && (
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Deadline</Label>
            <Input
              type="date"
              className="w-40"
              value={note.deadline ?? ""}
              onChange={(e) => onSave({ id: note.id, deadline: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Progress %</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                className="w-24"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onSave({ id: note.id, progress: Math.max(0, Math.min(100, progress)) })
                }
              >
                Update
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              checked={note.done}
              onCheckedChange={(v) => onSave({ id: note.id, done: v, progress: v ? 100 : progress })}
            />
            <span className="text-sm">Done</span>
          </div>
          <div className="ml-auto flex items-center gap-2 pb-1">
            <Button size="sm" variant="ghost" onClick={() => onSave({ id: note.id, is_todo: false })}>
              Move back to notes
            </Button>
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete to-do"
                onClick={() => {
                  if (confirm(`Delete “${note.title}”?`)) onDelete(note.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
