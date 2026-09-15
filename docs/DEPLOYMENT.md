# ☁️ 部署指南

Hex Breaker 是纯静态站点：`npm run build` 产出 `dist/`，部署到任意静态托管即可。主路径为 **Cloudflare Pages**，线上地址 <https://hex-breaker.pages.dev>。

## base 路径机制

`vite.config.ts` 通过环境变量 `BASE_PATH` 控制构建的 base：

```ts
const base = process.env.BASE_PATH ?? '/';
```

- 根路径托管（Cloudflare Pages、自有域名）：不用设置，默认 `/`
- 子路径托管（GitHub Pages 项目页）：构建前显式设置，如 `BASE_PATH=/Hex-Breaker/`

## 主路径：Cloudflare Pages

### 一键部署

`package.json` 内置了部署脚本：

```bash
npm run deploy:cf
```

等价于依次执行：

```bash
npm run build
npx wrangler pages deploy dist --project-name hex-breaker --branch main --commit-dirty=true
```

- `--project-name hex-breaker`：对应 Cloudflare Pages 项目（即 `hex-breaker.pages.dev`）
- `--branch main`：作为生产分支发布
- `--commit-dirty=true`：允许工作区有未提交改动时直接部署本地构建产物

### 首次使用

1. 安装依赖后 wrangler 已随 `devDependencies` 提供（`npx wrangler` 直接可用）；
2. 登录：`npx wrangler login`（浏览器授权）；
3. 项目不存在时先创建：`npx wrangler pages project create hex-breaker --production-branch main`；
4. 之后每次 `npm run deploy:cf` 即可。

### 验证部署

部署完成后访问 <https://hex-breaker.pages.dev>，确认：

- 主页正常显示，无控制台报错；
- 开始游戏后画面、音效、存档（localStorage `hex-breaker:save`）正常；
- 手机访问时竖屏全屏、PC 宽屏时显示居中手机框。

## 备选：GitHub Pages

仓库名为 `Hex-Breaker` 时，项目页路径是 `/Hex-Breaker/`，必须覆盖 base：

```bash
BASE_PATH=/Hex-Breaker/ npm run build
```

然后把 `dist/` 发布到 `gh-pages` 分支（任选一种）：

```bash
# 方式一：gh-pages 包
npx gh-pages -d dist

# 方式二：手工推 subtree
git subtree push --prefix dist origin gh-pages
```

仓库 Settings → Pages 选择 `gh-pages` 分支后，访问 `https://<用户名>.github.io/Hex-Breaker/`。

> ⚠️ 如果仓库改名，记得同步修改 `BASE_PATH`。base 不对的典型症状：页面空白，控制台报资源 404。

## 其他静态托管

Netlify、Vercel、对象存储 + CDN 等都适用，通用配置：

| 配置项 | 值 |
| --- | --- |
| 构建命令 | `npm run build` |
| 产物目录 | `dist` |
| Node 版本 | ≥ 20 |
| base | 根路径托管保持默认 `/`；子路径托管设 `BASE_PATH` |

游戏无服务端路由，无需配置 SPA 回退（`index.html` 为唯一入口，无前端路由）。

## 构建产物说明

- `dist/index.html`：唯一入口
- Phaser 单独拆 chunk（`vite.config.ts` 的 `manualChunks`），业务代码与引擎并行加载
- 构建目标 `es2019`，关闭 sourcemap；版本号通过 `__APP_VERSION__` 注入，主页底部可见

## 部署排错

| 症状 | 排查 |
| --- | --- |
| 页面空白、资源 404 | base 路径不对：子路径托管忘了设 `BASE_PATH` |
| 手机访问不是全屏 | 属正常：PC 宽屏才显示手机框；手机请竖屏全屏访问 |
| 没有声音 | 浏览器自动播放策略：首次点击页面后 AudioContext 才解锁 |
| 存档丢失 | localStorage 按域名隔离；换域名 / 隐私模式都会导致读不到旧存档 |
