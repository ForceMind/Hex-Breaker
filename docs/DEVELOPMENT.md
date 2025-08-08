# 🛠️ 开发指南

本指南将帮助开发者了解 Hex Breaker 项目的开发流程、代码规范和最佳实践。

## 📋 目录

- [开发环境](#开发环境)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [开发流程](#开发流程)
- [调试技巧](#调试技巧)
- [性能优化](#性能优化)
- [测试指南](#测试指南)

## 🚀 开发环境

### 必要条件

- **现代浏览器**：Chrome 80+, Firefox 75+, Safari 13+
- **代码编辑器**：推荐 VS Code, WebStorm, 或 Sublime Text
- **本地服务器**：Python, Node.js, 或任何HTTP服务器
- **版本控制**：Git

### 推荐工具

```bash
# VS Code 扩展
- Live Server          # 实时预览
- Prettier             # 代码格式化
- ESLint              # 代码检查
- Bracket Pair Colorizer # 括号配对
- GitLens             # Git增强

# 浏览器开发工具
- Chrome DevTools     # 主要调试工具
- Firefox Developer Tools # 替代调试工具
```

### 本地开发服务器

```bash
# 方法1: Python (推荐)
cd hex-breaker
python -m http.server 8000

# 方法2: Node.js
npx serve . -p 8000

# 方法3: VS Code Live Server
# 右键 index.html -> Open with Live Server

# 方法4: PHP
php -S localhost:8000
```

## 📁 项目结构

```
Hex-Breaker/
├── index.html              # 🎮 主游戏文件 (单文件架构)
├── README.md               # 📖 项目说明
├── CHANGELOG.md            # 📋 更新日志
├── LICENSE.md              # 📄 开源协议
├── docs/                   # 📚 文档目录
│   ├── API.md             # 🔧 API接口文档
│   ├── DEVELOPMENT.md     # 🛠️ 开发指南 (本文件)
│   └── DEPLOYMENT.md      # 🚀 部署指南
├── assets/ (计划中)        # 🎨 资源文件
│   ├── images/            # 图片资源
│   ├── sounds/            # 音效文件
│   └── fonts/             # 字体文件
└── tests/ (计划中)         # 🧪 测试文件
    ├── unit/              # 单元测试
    └── integration/       # 集成测试
```

### 单文件架构说明

目前项目采用单文件架构，所有代码都在 `index.html` 中：

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Meta信息和favicon -->
</head>
<body>
    <!-- HTML结构 -->
    <canvas id="gameCanvas"></canvas>
    <div class="ui-elements">...</div>
    
    <style>
        /* CSS样式 */
    </style>
    
    <script>
        // JavaScript游戏逻辑
    </script>
</body>
</html>
```

**优点：**
- 部署简单，只需一个文件
- 无需构建工具
- 便于快速原型开发

**缺点：**
- 代码管理相对困难
- 不利于团队协作
- 无法使用模块化

## 📝 代码规范

### JavaScript 规范

```javascript
// ✅ 良好的类定义
class Player {
    constructor() {
        // 使用驼峰命名
        this.playerSpeed = 5;
        this.weaponType = 'default';
        
        // 常量使用大写
        this.MAX_HEALTH = 100;
    }
    
    // 方法命名清晰
    moveToPosition(x, y) {
        // 使用const/let，避免var
        const deltaX = x - this.x;
        const deltaY = y - this.y;
        
        // 适当的注释
        // 移动玩家到指定位置
        this.x = x;
        this.y = y;
    }
}

// ✅ 函数定义
function createNewTileRow() {
    // 早期返回，减少嵌套
    if (!gameActive) return;
    
    // 清晰的变量命名
    const tileCount = Math.floor(canvas.width / TILE_SPACING);
    
    for (let i = 0; i < tileCount; i++) {
        // 具体的实现
    }
}

// ❌ 避免的写法
var a = 10; // 不使用var
function f() {} // 不使用单字母函数名
if(x==y){} // 缺少空格和使用==
```

### CSS 规范

```css
/* ✅ 良好的CSS结构 */
.game-container {
    /* 按逻辑分组属性 */
    /* 布局属性 */
    display: flex;
    position: relative;
    
    /* 尺寸属性 */
    width: 100%;
    height: 100vh;
    
    /* 外观属性 */
    background: #000;
    border: none;
    
    /* 文字属性 */
    font-family: Arial, sans-serif;
    color: #fff;
}

/* 移动端优先的响应式设计 */
@media (max-width: 768px) {
    .mobile-controls {
        display: block;
    }
    
    .desktop-only {
        display: none;
    }
}
```

### HTML 规范

```html
<!-- ✅ 语义化标签 -->
<main class="game-container">
    <canvas id="gameCanvas" 
            width="800" 
            height="600"
            aria-label="游戏画布">
    </canvas>
    
    <section class="game-ui">
        <header class="score-board">
            <span class="score">分数: <span id="score">0</span></span>
            <span class="level">等级: <span id="level">1</span></span>
        </header>
        
        <nav class="mobile-controls" aria-label="移动控制">
            <button type="button" 
                    class="control-btn left-btn"
                    aria-label="向左移动">
                ←
            </button>
        </nav>
    </section>
</main>
```

## 🔄 开发流程

### 功能开发流程

1. **需求分析**
   ```markdown
   - 明确功能需求
   - 确定影响范围
   - 评估开发难度
   - 制定开发计划
   ```

2. **代码实现**
   ```javascript
   // 1. 创建新的类或函数
   class NewFeature {
       constructor() {
           // 初始化
       }
   }
   
   // 2. 集成到主游戏循环
   function update() {
       // 现有逻辑...
       newFeature.update();
   }
   
   // 3. 添加绘制逻辑
   function draw() {
       // 现有绘制...
       newFeature.draw();
   }
   ```

3. **测试验证**
   ```bash
   # 功能测试清单
   □ 基本功能正常
   □ 边界情况处理
   □ 性能无显著下降
   □ 移动端兼容性
   □ 不同浏览器测试
   ```

4. **代码审查**
   ```markdown
   - 代码风格一致性
   - 逻辑清晰度
   - 性能考虑
   - 错误处理
   - 文档更新
   ```

### Git 工作流

```bash
# 1. 创建功能分支
git checkout -b feature/new-weapon-system

# 2. 开发过程中提交
git add index.html
git commit -m "feat: add plasma weapon basic structure"

# 3. 功能完成后
git add .
git commit -m "feat: complete plasma weapon with upgrade system"

# 4. 推送和合并
git push origin feature/new-weapon-system
# 创建 Pull Request

# 5. 合并到主分支
git checkout main
git pull origin main
git merge feature/new-weapon-system
```

### 提交信息规范

```bash
# 格式: type(scope): description

# 功能类型
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具相关

# 示例
feat(weapons): add plasma cannon with charge mechanic
fix(mobile): resolve touch control responsiveness issue
docs(api): update Bomb class documentation
style(format): apply consistent indentation
refactor(collision): optimize collision detection algorithm
```

## 🐛 调试技巧

### 浏览器开发工具

```javascript
// 1. Console调试
console.log('Player position:', player.x, player.y);
console.table(tiles); // 表格形式显示数组
console.time('update'); // 性能计时开始
updateGame();
console.timeEnd('update'); // 性能计时结束

// 2. 断点调试
function update() {
    debugger; // 设置断点
    // 代码逻辑
}

// 3. 条件断点
if (player.health < 10) {
    debugger; // 只在特定条件下触发
}
```

### 游戏状态调试

```javascript
// 调试面板 (可添加到游戏中)
function drawDebugInfo() {
    if (!DEBUG_MODE) return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 150);
    
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${currentFPS}`, 20, 30);
    ctx.fillText(`Tiles: ${tiles.length}`, 20, 50);
    ctx.fillText(`Bullets: ${bullets.length}`, 20, 70);
    ctx.fillText(`Player: ${player.x}, ${player.y}`, 20, 90);
    ctx.fillText(`Level: ${level}`, 20, 110);
    ctx.fillText(`Score: ${score}`, 20, 130);
}

// 在draw函数中调用
function draw() {
    // 正常绘制逻辑...
    drawDebugInfo();
}
```

### 性能监控

```javascript
// 性能监控器
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = Date.now();
        this.fps = 0;
        this.averageFrameTime = 0;
        this.frameTimes = [];
    }
    
    update() {
        const now = Date.now();
        const frameTime = now - this.lastTime;
        
        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > 60) {
            this.frameTimes.shift();
        }
        
        this.averageFrameTime = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
        this.fps = 1000 / this.averageFrameTime;
        
        this.lastTime = now;
        this.frameCount++;
    }
    
    getReport() {
        return {
            fps: Math.round(this.fps),
            averageFrameTime: Math.round(this.averageFrameTime * 100) / 100,
            totalFrames: this.frameCount
        };
    }
}
```

## ⚡ 性能优化

### 渲染优化

```javascript
// 1. 对象池模式避免频繁创建销毁
class BulletPool {
    constructor(size = 100) {
        this.pool = [];
        this.activeObjects = [];
        
        // 预创建对象
        for (let i = 0; i < size; i++) {
            this.pool.push(new Bullet(0, 0));
        }
    }
    
    get() {
        if (this.pool.length > 0) {
            const bullet = this.pool.pop();
            this.activeObjects.push(bullet);
            return bullet;
        }
        return new Bullet(0, 0); // 池空时创建新对象
    }
    
    release(bullet) {
        const index = this.activeObjects.indexOf(bullet);
        if (index > -1) {
            this.activeObjects.splice(index, 1);
            bullet.reset(); // 重置对象状态
            this.pool.push(bullet);
        }
    }
}

// 2. 减少重复计算
class OptimizedTile {
    constructor(x, y, health) {
        this.x = x;
        this.y = y;
        this.health = health;
        
        // 缓存计算结果
        this.centerX = x + this.size / 2;
        this.centerY = y + this.size / 2;
        this.boundingBox = {
            left: x,
            right: x + this.size,
            top: y,
            bottom: y + this.size
        };
    }
    
    updatePosition() {
        this.y += gameSpeed;
        
        // 只在位置改变时更新缓存
        this.centerY = this.y + this.size / 2;
        this.boundingBox.top = this.y;
        this.boundingBox.bottom = this.y + this.size;
    }
}
```

### 碰撞检测优化

```javascript
// 空间分割优化
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = new Array(this.cols * this.rows);
        this.clear();
    }
    
    clear() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = [];
        }
    }
    
    insert(object) {
        const cellX = Math.floor(object.x / this.cellSize);
        const cellY = Math.floor(object.y / this.cellSize);
        
        if (cellX >= 0 && cellX < this.cols && cellY >= 0 && cellY < this.rows) {
            const index = cellY * this.cols + cellX;
            this.grid[index].push(object);
        }
    }
    
    getNearby(object, radius = 1) {
        const nearby = [];
        const cellX = Math.floor(object.x / this.cellSize);
        const cellY = Math.floor(object.y / this.cellSize);
        
        for (let y = cellY - radius; y <= cellY + radius; y++) {
            for (let x = cellX - radius; x <= cellX + radius; x++) {
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    const index = y * this.cols + x;
                    nearby.push(...this.grid[index]);
                }
            }
        }
        
        return nearby;
    }
}
```

### 内存管理

```javascript
// 定期清理无效对象
function cleanupObjects() {
    // 清理屏幕外的对象
    tiles = tiles.filter(tile => tile.y < canvas.height + 100);
    bullets = bullets.filter(bullet => bullet.y > -50);
    itemDrops = itemDrops.filter(item => item.y < canvas.height + 50);
    
    // 强制垃圾回收 (谨慎使用)
    if (window.gc && frameCount % 3600 === 0) { // 每分钟一次
        window.gc();
    }
}
```

## 🧪 测试指南

### 单元测试示例

```javascript
// 测试框架 (简单版本)
function test(name, testFunction) {
    try {
        testFunction();
        console.log(`✅ ${name} - 通过`);
    } catch (error) {
        console.error(`❌ ${name} - 失败:`, error.message);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || '断言失败');
    }
}

// 测试用例
test('玩家移动功能', () => {
    const player = new Player();
    const initialX = player.x;
    
    player.moveLeft();
    assert(player.x < initialX, '玩家应该向左移动');
    
    player.moveRight();
    player.moveRight();
    assert(player.x > initialX, '玩家应该向右移动');
});

test('瓦片碰撞检测', () => {
    const tile = new Tile(100, 100, 5);
    const bullet = new Bullet(125, 125, 'normal');
    
    assert(bullet.checkCollision(tile), '子弹应该与瓦片碰撞');
    
    bullet.x = 200;
    assert(!bullet.checkCollision(tile), '远距离子弹不应该碰撞');
});

test('武器升级系统', () => {
    const player = new Player();
    
    player.pickupItem('uzi');
    assert(player.weapon === 'uzi', '应该装备冲锋枪');
    assert(player.weaponLevel === 1, '初始等级应该是1');
    
    player.pickupItem('uzi');
    assert(player.weaponLevel === 2, '相同武器应该升级');
    
    player.pickupItem('laser');
    assert(player.weapon === 'laser', '应该切换到激光炮');
    assert(player.weaponLevel === 1, '新武器等级应该重置');
});
```

### 集成测试

```javascript
// 游戏流程测试
test('完整游戏流程', () => {
    // 初始化游戏
    startGame();
    assert(gameState === 'playing', '游戏应该开始');
    assert(tiles.length > 0, '应该生成初始瓦片');
    
    // 模拟游戏进行
    for (let i = 0; i < 100; i++) {
        update();
    }
    
    // 检查游戏状态
    assert(tiles.length > 0, '应该持续生成瓦片');
    assert(score >= 0, '分数应该有效');
});
```

### 性能测试

```javascript
// 压力测试
test('大量对象性能测试', () => {
    // 创建大量对象
    for (let i = 0; i < 1000; i++) {
        tiles.push(new Tile(Math.random() * canvas.width, Math.random() * canvas.height, 5));
        bullets.push(new Bullet(Math.random() * canvas.width, Math.random() * canvas.height, 'normal'));
    }
    
    const startTime = performance.now();
    
    // 运行更新循环
    for (let i = 0; i < 60; i++) { // 1秒
        update();
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    assert(duration < 1000, `性能测试失败: ${duration}ms > 1000ms`);
    console.log(`性能测试通过: ${duration.toFixed(2)}ms`);
});
```

### 兼容性测试

```javascript
// 浏览器兼容性检查
function checkCompatibility() {
    const features = {
        canvas: !!document.createElement('canvas').getContext,
        requestAnimationFrame: !!window.requestAnimationFrame,
        classList: !!document.createElement('div').classList,
        addEventListener: !!window.addEventListener,
        JSON: !!window.JSON,
        localStorage: !!window.localStorage
    };
    
    for (const [feature, supported] of Object.entries(features)) {
        if (!supported) {
            console.warn(`不支持的功能: ${feature}`);
            return false;
        }
    }
    
    return true;
}
```

## 📱 移动端优化

### 触摸事件处理

```javascript
// 防止默认滚动行为
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// 触摸优化
class TouchHandler {
    constructor() {
        this.touches = new Map();
        this.setupEvents();
    }
    
    setupEvents() {
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }
    
    handleTouchStart(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startTime: Date.now()
            });
        }
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        // 处理移动逻辑
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            const touchData = this.touches.get(touch.identifier);
            if (touchData) {
                const duration = Date.now() - touchData.startTime;
                const distance = Math.sqrt(
                    Math.pow(touch.clientX - touchData.x, 2) +
                    Math.pow(touch.clientY - touchData.y, 2)
                );
                
                // 区分点击和滑动
                if (duration < 200 && distance < 10) {
                    this.handleTap(touch.clientX, touch.clientY);
                }
                
                this.touches.delete(touch.identifier);
            }
        }
    }
}
```

## 🔄 代码重构建议

### 模块化改造

```javascript
// 将来可以考虑的模块化结构
// game/
// ├── core/
// │   ├── Engine.js      // 游戏引擎
// │   ├── Scene.js       // 场景管理
// │   └── Input.js       // 输入处理
// ├── entities/
// │   ├── Player.js      // 玩家类
// │   ├── Tile.js        // 瓦片类
// │   └── Weapon.js      // 武器类
// ├── systems/
// │   ├── Physics.js     // 物理系统
// │   ├── Collision.js   // 碰撞系统
// │   └── Rendering.js   // 渲染系统
// └── utils/
//     ├── Math.js        // 数学工具
//     └── Audio.js       // 音频工具
```

---

**开发者注意事项：**
- 优先保证功能正确性，再考虑性能优化
- 移动端测试同样重要
- 保持代码简洁和可读性
- 定期备份和版本控制
- 关注用户反馈和bug报告
