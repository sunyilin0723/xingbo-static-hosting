import { useCallback, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth, apiLogout } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageTab from "./ImageTab";

const MAX_FILES = 20;
const MAX_BYTES = 20 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const list = trpc.files.list.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.files.upload.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(`已上传 ${vars.name}`);
      utils.files.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.files.update.useMutation({
    onSuccess: () => {
      toast.success("已保存");
      utils.files.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.files.remove.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.files.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<number | null>(null);
  const [renameSlug, setRenameSlug] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const f of arr) {
        if (f.size > MAX_BYTES) {
          toast.error(`「${f.name}」超过 20MB，已跳过`);
          continue;
        }
        setUploading(f.name);
        try {
          const contentBase64 = await toBase64(f);
          await upload.mutateAsync({
            name: f.name,
            contentBase64,
            contentType: f.type || undefined,
          });
        } catch {
          // toast handled by mutation
        } finally {
          setUploading(null);
        }
      }
    },
    [upload],
  );

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void doUpload(e.dataTransfer.files);
  }

  async function onLogout() {
    await apiLogout();
    utils.files.me.invalidate();
    navigate("/login", { replace: true });
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[hsl(240,20%,99%)] flex items-center justify-center text-sm text-[hsl(240,4%,46%)]">
        加载中…
      </div>
    );
  }
  if (!isAuthenticated || !user) {
    navigate("/login", { replace: true });
    return null;
  }

  const items = list.data ?? [];
  const usedBytes = items.reduce((s, f) => s + f.size, 0);
  const quotaPct = Math.min(100, (items.length / MAX_FILES) * 100);

  return (
    <div className="min-h-dvh bg-[hsl(240,20%,99%)]">
      <header className="border-b border-[hsl(240,6%,90%)] bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(248,79%,58%)] text-xs font-bold text-white">
              泊
            </div>
            <span className="font-semibold tracking-tight">星泊静态托管</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-[hsl(240,4%,46%)]">
              {user.username}
            </span>
            <Button variant="outline" size="sm" onClick={onLogout}>
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="files">文件托管</TabsTrigger>
            <TabsTrigger value="images">图床</TabsTrigger>
          </TabsList>
          <TabsContent value="files">
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-[hsl(240,6%,90%)] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1.5 flex items-baseline gap-3">
              <span className="text-sm font-medium text-[hsl(240,10%,8%)]">
                文件配额
              </span>
              <span className="text-sm text-[hsl(240,4%,46%)]">
                {items.length} / {MAX_FILES} 个文件 · 共 {fmtSize(usedBytes)}
              </span>
            </div>
            <div className="h-1.5 w-full sm:w-72 rounded-full bg-[hsl(240,6%,92%)]">
              <div
                className="h-1.5 rounded-full bg-[hsl(248,79%,58%)] transition-all"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          </div>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={items.length >= MAX_FILES || !!uploading}
          >
            {uploading ? "上传中…" : "上传文件"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void doUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed transition-colors ${
            dragging
              ? "border-[hsl(248,79%,58%)] bg-[hsl(248,79%,97%)]"
              : "border-transparent"
          }`}
        >
          <section className="overflow-hidden rounded-2xl border border-[hsl(240,6%,90%)] bg-white shadow-sm">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-base font-medium text-[hsl(240,10%,8%)]">
                  还没有文件
                </p>
                <p className="mt-1 text-sm text-[hsl(240,4%,46%)]">
                  点击「上传文件」或把文件拖到这里
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[hsl(240,6%,93%)]">
                {items.map((f) => {
                  const publicUrl = `${window.location.origin}/public/${user.username}/${f.slug}`;
                  return (
                    <li
                      key={f.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate font-mono text-sm font-medium text-[hsl(240,10%,8%)] hover:underline"
                          >
                            {f.name}
                          </a>
                          <Badge
                            variant={f.isPublic ? "default" : "secondary"}
                            className="shrink-0 text-xs"
                          >
                            {f.isPublic ? "公开" : "私密"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-xs text-[hsl(240,4%,52%)]">
                          /public/{user.username}/{f.slug} · {fmtSize(f.size)} ·{" "}
                          {f.contentType}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (navigator.clipboard?.writeText) {
                              navigator.clipboard
                                .writeText(publicUrl)
                                .then(() => toast.success("链接已复制"))
                                .catch(() => toast.error("复制失败"));
                            } else {
                              const ta = document.createElement("textarea");
                              ta.value = publicUrl;
                              document.body.appendChild(ta);
                              ta.select();
                              try {
                                document.execCommand("copy");
                                toast.success("链接已复制");
                              } catch {
                                toast.error("复制失败");
                              }
                              document.body.removeChild(ta);
                            }
                          }}
                        >
                          复制链接
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRenameTarget(f.id);
                            setRenameSlug(f.slug);
                          }}
                        >
                          改名
                        </Button>
                        <div className="flex items-center gap-1.5 px-1">
                          <Switch
                            checked={f.isPublic}
                            onCheckedChange={(v) =>
                              update.mutate({ id: f.id, isPublic: v })
                            }
                            aria-label="公开访问"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[hsl(0,72%,50%)]"
                          onClick={() => setDeleteTarget(f.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
          </TabsContent>
          <TabsContent value="images">
            <ImageTab username={user.username} />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改链接名</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="slug">链接名（URL 末尾）</Label>
            <Input
              id="slug"
              value={renameSlug}
              onChange={(e) => setRenameSlug(e.target.value)}
              placeholder="字母、数字、._-"
            />
            <p className="text-xs text-[hsl(240,4%,52%)]">
              {window.location.origin}/public/{user.username}/
              <span className="font-mono">{renameSlug}</span>
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (renameTarget !== null) {
                  update.mutate(
                    { id: renameTarget, slug: renameSlug },
                    { onSuccess: () => setRenameTarget(null) },
                  );
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(240,4%,46%)]">
            文件将从存储中移除，公开链接立即失效，且无法恢复。
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget !== null) {
                  remove.mutate({ id: deleteTarget }, {
                    onSuccess: () => setDeleteTarget(null),
                  });
                }
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
