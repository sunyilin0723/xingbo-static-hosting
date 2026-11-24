# 星泊静态托管

一个自带账号体系的静态文件托管 + 图床服务。基于 React + TypeScript + Vite + Tailwind + shadcn/ui 前端，Hono + tRPC + Drizzle ORM + MySQL 后端，对象存储由平台网关注入。

## 功能

- **账密注册/登录**：用户名 + 密码，scrypt 加盐哈希存储，JWT（HttpOnly Cookie）会话 30 天
- **文件托管**：每人 20 个文件、单文件最大 20MB；公开直链 `/public/<用户名>/<链接名>` 直接下载；支持公开/私密切换、改链接名、删除
- **图床**：服务端文件魔数（magic bytes）检测，伪装成图片的文件直接拒绝；支持 JPG / PNG / GIF / WebP / BMP / AVIF / HEIC
  - ≤200KB 的小图：不限张数、不占配额
  - \>200KB 的大图：占用「高级空间」，总量 50MB；单图上限 20MB
  - 直链 `/i/<用户名>/<链接名>` 始终内联显示图片（inline），可嵌 Markdown
- **老浏览器兼容**：`@vitejs/plugin-legacy` 双轨构建，现代浏览器走原生 ESM，老浏览器自动降级 ES5 + core-js polyfill（Chrome ≥ 49 / Safari ≥ 10 / iOS ≥ 10）
- **PWA**：可添加到桌面/手机主屏
- 全站响应式（375px 以上无横向滚动），图片/文件上传过平台内容审核

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + react-router + tRPC client |
| 后端 | Hono + tRPC 11 + Node.js (ESM bundle) |
| 数据库 | MySQL（Drizzle ORM，`npm run db:push` 同步结构） |
| 存储 | 平台对象存储（`api/lib/storage.ts`，网关注入凭据，上传同步审核） |
| 认证 | scrypt 密码哈希 + HS256 JWT（自实现，见 `api/lib/auth.ts`） |

## 目录结构

```
api/                 后端（Hono + tRPC）
  boot.ts            入口：注册 /api/auth、/public、/i 路由
  files-router.ts    文件托管 tRPC 路由
  images-router.ts   图床 tRPC 路由（魔数检测 + 大小图配额分流）
  lib/auth.ts        scrypt + JWT
  lib/magic.ts       图片魔数检测
  lib/storage.ts     平台对象存储 SDK
  routes/            纯 REST 路由（auth / public 文件下载 / i 图片直链）
db/schema.ts         Drizzle 表结构（users / files / images）
contracts/           前后端共享类型
src/pages/           Login / Home（文件托管 + 图床双 Tab）/ ImageTab
public/              PWA manifest、Service Worker、图标
```

## 本地开发

```bash
npm install
npm run db:push   # 需要 DATABASE_URL（MySQL）
npm run dev       # http://localhost:3000
npm run check     # 类型检查
```

## 生产构建

```bash
npm run build     # 前端 → dist/public，后端打包 → dist/boot.js
npm start         # NODE_ENV=production node dist/boot.js（默认端口 3000，PORT 可覆盖）
```

## 自部署指南

> 本项目在 Kimi 平台创建，数据库、对象存储和网关凭据由平台在 `.env` 中注入（`.env` 已被 gitignore 排除，不会进入仓库）。导出到自托管环境时需要自行补齐以下配置。

### 1. 环境变量

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | MySQL 连接串，格式 `mysql://user:password@host:3306/dbname` |
| `APP_SECRET` | JWT 签名密钥，随便一段足够长的随机字符串 |
| `PORT` | 服务端口，默认 3000 |
| `KIMI_AGENTGW_API_KEY` | 平台网关凭据（对象存储用，服务器端专用） |
| `KIMI_AGENTGW_BASE_URL` | 网关地址 |
| `KIMI_STORAGE_RESOURCE_ID` | 存储资源 ID |

### 2. 初始化数据库

```bash
npm run db:push   # 按 db/schema.ts 建表（users / files / images）
```

### 3. 构建并启动

```bash
npm run build
NODE_ENV=production node dist/boot.js
```

### 4. 反向代理（可选）

应用本身是纯 HTTP，放在 Nginx / Caddy 后面即可，注意：
- `/api/*`、`/public/*`、`/i/*` 都路由到应用
- 开启 HTTPS（JWT Cookie 建议 SameSite=Lax + Secure）

### 5. 存储说明

`api/lib/storage.ts` 封装了对象存储 SDK（PUT 上传、签名 URL 读取、删除、列举）。上传 ≤100MB/个，同步内容审核；**APK 等安装包被平台策略禁止公开分发**，读取时返回 403。

## 已知限制

- 每人文件托管 20 个、单文件 20MB（硬限制）
- 图床小图（≤200KB）不限量；大图高级空间 50MB
- 仅支持平台网关可达的对象存储；导出代码后需替换 `api/lib/storage.ts` 适配你自己的 S3 / OSS
