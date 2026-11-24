// Workers 部署版环境变量：不使用 dotenv，全部来自 Worker 的
// vars/secrets（nodejs_compat 使 process.env 可用）。APP_SECRET 通过
// `wrangler secret put` 或 Cloudflare API 设置为 secret。
// 缺失 APP_SECRET 时退回开发默认值并告警 —— 生产环境务必配置。

const appSecret = process.env.APP_SECRET || "";

if (!appSecret && process.env.NODE_ENV === "production") {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      msg: "APP_SECRET is not set; falling back to the built-in dev secret. Set it via `wrangler secret put APP_SECRET` or the Cloudflare API.",
    }),
  );
}

export const env = {
  appId: process.env.APP_ID || "xingbo-static-hosting",
  appSecret,
  isProduction: true,
  databaseUrl: "",
};
