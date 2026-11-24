import { useRef, useState, type DragEvent } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const QUOTA_BYTES = 50 * 1024 * 1024;
const MAX_BYTES = 20 * 1024 * 1024;

export function fmtSize(bytes: number): string {
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

export default function ImageTab({ username }: { username: string }) {
  const utils = trpc.useUtils();
  const list = trpc.images.list.useQuery();
  const upload = trpc.images.upload.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(`图片已上传：${vars.name}`);
      utils.images.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.images.update.useMutation({
    onSuccess: () => {
      toast.success("已保存");
      utils.images.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.images.remove.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.images.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<number | null>(null);
  const [renameSlug, setRenameSlug] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = list.data ?? [];
  const bigItems = items.filter((i) => i.usesQuota);
  const usedBytes = bigItems.reduce((s, i) => s + i.size, 0);
  const quotaPct = Math.min(100, (usedBytes / QUOTA_BYTES) * 100);

  async function doUpload(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) {
        toast.error(`「${f.name}」超过单图 20MB 上限，已跳过`);
        continue;
      }
      setUploading(f.name);
      try {
        const contentBase64 = await toBase64(f);
        await upload.mutateAsync({ name: f.name, contentBase64 });
      } catch {
        // handled by mutation
      } finally {
        setUploading(null);
      }
    }
  }

  function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success("链接已复制"))
        .catch(() => toast.error("复制失败"));
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
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
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void doUpload(e.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed transition-colors ${
        dragging ? "border-[hsl(248,79%,58%)] bg-[hsl(248,79%,97%)]" : "border-transparent"
      }`}
    >
      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-[hsl(240,6%,90%)] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-medium">高级空间（&gt;200KB 图片）</span>
            <span className="text-sm text-[hsl(240,4%,46%)]">
              {fmtSize(usedBytes)} / 50 MB · {items.length - bigItems.length} 张小图免费 · {bigItems.length} 张大图
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[hsl(240,6%,92%)] sm:w-72">
            <div
              className="h-1.5 rounded-full bg-[hsl(248,79%,58%)] transition-all"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[hsl(240,4%,52%)]">
            ≤200KB 的图片不限张数、不占空间；单图最大 20MB
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={!!uploading}>
          {uploading ? "上传中…" : "上传图片"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void doUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[hsl(240,6%,90%)] bg-white shadow-sm">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-medium">还没有图片</p>
            <p className="mt-1 text-sm text-[hsl(240,4%,46%)]">
              点击「上传图片」或把图片拖到这里
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(240,6%,93%)]">
            {items.map((img) => {
              const url = `${window.location.origin}/i/${username}/${img.slug}`;
              const small = !img.usesQuota;
              return (
                <li key={img.id} className="flex gap-4 px-5 py-4">
                  <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                    <img
                      src={url}
                      alt={img.name}
                      loading="lazy"
                      className="h-16 w-16 rounded-lg border border-[hsl(240,6%,90%)] object-cover"
                    />
                  </a>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium">{img.name}</span>
                      <Badge variant={small ? "secondary" : "default"} className="shrink-0 text-xs">
                        {small ? "免费小图" : "高级"}
                      </Badge>
                      <span className="text-xs text-[hsl(240,4%,52%)]">
                        {fmtSize(img.size)} · {img.contentType}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-[hsl(240,4%,52%)]">
                      /i/{username}/{img.slug}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyText(url)}>
                        复制直链
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyText(`![${img.name}](${url})`)}
                      >
                        复制 Markdown
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRenameTarget(img.id);
                          setRenameSlug(img.slug);
                        }}
                      >
                        改名
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[hsl(0,72%,50%)]"
                        onClick={() => setDeleteTarget(img.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={renameTarget !== null} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改链接名</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="img-slug">链接名（URL 末尾）</Label>
            <Input
              id="img-slug"
              value={renameSlug}
              onChange={(e) => setRenameSlug(e.target.value)}
              placeholder="字母、数字、._-"
            />
            <p className="text-xs text-[hsl(240,4%,52%)]">
              {window.location.origin}/i/{username}/
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
                  update.mutate({ id: renameTarget, slug: renameSlug }, {
                    onSuccess: () => setRenameTarget(null),
                  });
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(240,4%,46%)]">
            图片将从存储中移除，所有引用该图的链接立即失效。
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget !== null) {
                  remove.mutate({ id: deleteTarget }, { onSuccess: () => setDeleteTarget(null) });
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
