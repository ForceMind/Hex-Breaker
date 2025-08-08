# 🚀 部署指南

本指南将帮助您将 Hex Breaker 游戏部署到各种平台和环境中。

## 📋 目录

- [快速部署](#快速部署)
- [静态网站托管](#静态网站托管)
- [自建服务器](#自建服务器)
- [CDN优化](#CDN优化)
- [移动端打包](#移动端打包)
- [性能监控](#性能监控)

## ⚡ 快速部署

### GitHub Pages (推荐)

最简单的免费部署方式：

1. **上传到GitHub仓库**
   ```bash
   git add .
   git commit -m "Initial game release"
   git push origin main
   ```

2. **启用GitHub Pages**
   - 进入仓库 Settings > Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main"
   - 点击 Save

3. **访问游戏**
   - 访问 `https://yourusername.github.io/hex-breaker`
   - 通常需要几分钟生效

### Netlify 一键部署

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yourusername/hex-breaker)

手动部署步骤：

1. **创建账户**: 访问 [netlify.com](https://netlify.com)
2. **拖拽部署**: 直接将项目文件夹拖到 Netlify 部署区域
3. **自动生成域名**: 获得 `https://random-name.netlify.app` 域名
4. **自定义域名**: 可选择绑定自己的域名

### Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 在项目目录运行
cd hex-breaker
vercel

# 按提示操作，自动部署
```

### Surge.sh 部署

```bash
# 安装 Surge
npm install -g surge

# 部署
cd hex-breaker
surge

# 选择域名，例如: hex-breaker.surge.sh
```

## 🌐 静态网站托管

### Apache 配置

创建 `.htaccess` 文件：

```apache
# 启用压缩
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# 缓存设置
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType text/html "access plus 1 hour"
</IfModule>

# HTTPS重定向
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# 移动端优化
<IfModule mod_headers.c>
    Header set X-Content-Type-Options nosniff
    Header set X-Frame-Options DENY
    Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

### Nginx 配置

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;
    
    # HTTPS重定向
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;
    
    # SSL证书配置
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # 网站根目录
    root /var/www/hex-breaker;
    index index.html;
    
    # 压缩设置
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/xml+rss 
               application/json;
    
    # 缓存设置
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files $uri $uri/ /index.html;
        
        # 安全头设置
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }
    
    # 移动端特殊处理
    location ~* \.(html)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
```

## 🔧 自建服务器

### Docker 部署

创建 `Dockerfile`:

```dockerfile
FROM nginx:alpine

# 复制游戏文件
COPY . /usr/share/nginx/html/

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["nginx", "-g", "daemon off;"]
```

创建 `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json 
               application/javascript text/xml application/xml 
               application/xml+rss text/javascript;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # 静态资源缓存
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public";
        }
    }
}
```

构建和运行：

```bash
# 构建镜像
docker build -t hex-breaker .

# 运行容器
docker run -d -p 80:80 --name hex-breaker-game hex-breaker

# 使用 docker-compose
```

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  hex-breaker:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    restart: unless-stopped
    
  # 可选：添加 SSL 证书自动更新
  certbot:
    image: certbot/certbot
    volumes:
      - ./ssl:/etc/letsencrypt
      - ./www:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email youremail@domain.com --agree-tos --no-eff-email -d yourdomain.com
```

### Node.js 简单服务器

创建 `server.js`:

```javascript
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
}));

// 压缩中间件
app.use(compression());

// 静态文件服务
app.use(express.static('.', {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
    etag: true,
    lastModified: true
}));

// 所有路由都返回 index.html (SPA 路由)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    console.log(`🎮 Hex Breaker running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} to play`);
});
```

运行服务器：

```bash
npm init -y
npm install express compression helmet
node server.js
```

## 🚄 CDN优化

### Cloudflare 设置

1. **添加站点到 Cloudflare**
   - 注册 Cloudflare 账户
   - 添加你的域名
   - 更新 DNS 设置

2. **优化设置**
   ```javascript
   // Page Rules 设置
   *.yourdomain.com/index.html
   - Browser Cache TTL: 2 hours
   - Cache Level: Bypass
   
   *.yourdomain.com/*
   - Browser Cache TTL: 1 year
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   ```

3. **Cloudflare Workers** (可选)
   ```javascript
   addEventListener('fetch', event => {
       event.respondWith(handleRequest(event.request))
   })
   
   async function handleRequest(request) {
       const url = new URL(request.url)
       
       // 移动端检测
       const userAgent = request.headers.get('User-Agent') || ''
       const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent)
       
       if (isMobile) {
           // 移动端优化逻辑
           return fetch(request)
       }
       
       return fetch(request)
   }
   ```

### 其他 CDN 选择

```html
<!-- 可以考虑使用 CDN 加载资源 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- 预加载关键资源 -->
<link rel="preload" href="data:image/svg+xml,..." as="image">
```

## 📱 移动端打包

### PWA (Progressive Web App) 配置

创建 `manifest.json`:

```json
{
  "name": "Hex Breaker",
  "short_name": "HexBreaker",
  "description": "A modern HTML5 tile-breaking game",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#000000",
  "background_color": "#000000",
  "lang": "zh-CN",
  "scope": "/",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["games", "entertainment"],
  "screenshots": [
    {
      "src": "screenshot1.png",
      "sizes": "1280x720",
      "type": "image/png"
    }
  ]
}
```

添加 Service Worker (`sw.js`):

```javascript
const CACHE_NAME = 'hex-breaker-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    // 添加其他需要缓存的资源
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 返回缓存或网络请求
                return response || fetch(event.request);
            }
        )
    );
});

// 更新缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
```

在 `index.html` 中注册：

```html
<head>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#000000">
    
    <!-- iOS 支持 -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="apple-mobile-web-app-title" content="Hex Breaker">
    <link rel="apple-touch-icon" href="/icon-192.png">
</head>

<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
</script>
```

### Cordova/PhoneGap 打包

```bash
# 安装 Cordova
npm install -g cordova

# 创建项目
cordova create hex-breaker-mobile com.example.hexbreaker HexBreaker

# 添加平台
cd hex-breaker-mobile
cordova platform add android
cordova platform add ios

# 复制游戏文件到 www 目录
cp ../index.html www/
cp ../manifest.json www/

# 构建
cordova build android
cordova build ios
```

### Capacitor 现代化打包

```bash
# 安装 Capacitor
npm install @capacitor/core @capacitor/cli

# 初始化
npx cap init hex-breaker com.example.hexbreaker

# 添加平台
npx cap add android
npx cap add ios

# 构建并同步
npm run build
npx cap sync

# 打开 IDE
npx cap open android
npx cap open ios
```

## 📊 性能监控

### 基础性能监控

添加到游戏中的监控代码：

```javascript
// 性能监控
class PerformanceTracker {
    constructor() {
        this.metrics = {
            fps: 0,
            memory: 0,
            loadTime: 0,
            renderTime: 0
        };
        
        this.startTime = performance.now();
        this.setupMonitoring();
    }
    
    setupMonitoring() {
        // FPS 监控
        let frames = 0;
        let lastTime = performance.now();
        
        const trackFPS = () => {
            frames++;
            const now = performance.now();
            
            if (now - lastTime >= 1000) {
                this.metrics.fps = Math.round(frames * 1000 / (now - lastTime));
                frames = 0;
                lastTime = now;
                
                this.sendMetrics();
            }
            
            requestAnimationFrame(trackFPS);
        };
        
        requestAnimationFrame(trackFPS);
        
        // 内存监控
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            }, 5000);
        }
    }
    
    trackLoadTime() {
        this.metrics.loadTime = performance.now() - this.startTime;
    }
    
    trackRenderTime(startTime) {
        this.metrics.renderTime = performance.now() - startTime;
    }
    
    sendMetrics() {
        // 发送到分析服务
        if (window.gtag) {
            gtag('event', 'performance', {
                'custom_parameter_fps': this.metrics.fps,
                'custom_parameter_memory': this.metrics.memory
            });
        }
        
        // 或发送到自定义端点
        fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.metrics)
        }).catch(err => console.log('Metrics failed:', err));
    }
}

// 使用监控
const tracker = new PerformanceTracker();

// 在游戏加载完成后
window.addEventListener('load', () => {
    tracker.trackLoadTime();
});

// 在渲染循环中
function draw() {
    const renderStart = performance.now();
    
    // 渲染逻辑...
    
    tracker.trackRenderTime(renderStart);
}
```

### Google Analytics 集成

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
    
    // 游戏事件追踪
    function trackGameEvent(action, value) {
        gtag('event', action, {
            'event_category': 'game',
            'event_label': 'hex_breaker',
            'value': value
        });
    }
    
    // 使用示例
    // trackGameEvent('game_start', 1);
    // trackGameEvent('level_up', level);
    // trackGameEvent('game_over', score);
</script>
```

## 🔧 部署清单

### 部署前检查

```markdown
□ 代码压缩和优化
□ 图片压缩和优化
□ HTTPS 证书配置
□ 域名和 DNS 设置
□ 移动端适配测试
□ 跨浏览器兼容性测试
□ 性能测试 (Lighthouse)
□ SEO 优化
□ 错误监控设置
□ 备份和恢复方案
```

### 上线后监控

```markdown
□ 服务器状态监控
□ 网站可用性监控
□ 性能指标监控
□ 用户行为分析
□ 错误日志监控
□ CDN 缓存监控
□ SSL 证书有效期监控
```

---

**部署注意事项：**
- 选择合适的托管方案
- 注意移动端性能优化
- 设置正确的缓存策略
- 配置安全头和 HTTPS
- 建立监控和备份机制
