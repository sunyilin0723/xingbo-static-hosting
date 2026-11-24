# 星泊静态托管

静态文件托管 + 图床全栈网站。Kimi 平台创建，技术栈见 README.md。

- 前端：React 19 + TypeScript + Vite + Tailwind + shadcn/ui
- 后端：Hono + tRPC 11 + Drizzle ORM + MySQL
- 认证：自实现账密（scrypt + JWT HttpOnly Cookie）
- 存储：平台对象存储（网关注入凭据，上传同步审核）

## 构建

```bash
npm run build    # 前端 → dist/public，后端 esbuild 打包 → dist/boot.js
```

生产运行：`NODE_ENV=production node dist/boot.js`（默认端口 3000）。
