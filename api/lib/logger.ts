// Structured logger — Workers 部署版。
//
// 与原版的唯一区别：不写 /tmp/kimi-logs/app.log（Worker 没有文件系统），
// 只输出到 stdout（Workers 会通过 `wrangler tail` / dashboard 收集）。
// 行格式保持 JSON 不变，scrub / requestId 关联逻辑原样保留。
import { currentRequestId } from "./requestcontext";
import { scrubCtx, scrubValue } from "./scrub";

type Level = "debug" | "info" | "warn" | "error";

const RESERVED_KEYS = new Set(["ts", "level", "msg", "requestId"]);

function write(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  let line: string;
  try {
    const requestId = currentRequestId();
    const extra = Object.fromEntries(
      Object.entries(scrubCtx(ctx) ?? {}).filter(([k]) => !RESERVED_KEYS.has(k)),
    );
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ...(requestId ? { requestId } : {}),
      msg: scrubValue(msg),
      ...extra,
    });
  } catch {
    return;
  }
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function appendLine(line: string): void {
  try {
    console.log(line);
  } catch {
    // stdout is best-effort.
  }
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    write("error", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
};

export const logFilePath = "";
