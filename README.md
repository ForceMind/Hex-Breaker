# 🎮 Hex Breaker - 六边形瓦片破坏者

一个基于HTML5 Canvas的现代浏览器游戏，具有丰富的武器系统、智能回旋镖机制和多样化的炸弹类型。

![游戏截图](https://img.shields.io/badge/Platform-Web-brightgreen)
![技术栈](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20JavaScript-blue)
![版本](https://img.shields.io/badge/Version-1.0.0-orange)

## 🌟 游戏特色

### 核心玩法
- **六边形瓦片**：具有厚度的立体瓦片，根据血量显示堆叠效果
- **连续生成**：瓦片从顶部连续流下，无缝衔接无空隙
- **难度递增**：随等级提升，瓦片血量和生成频率都会增加
- **移动适配**：完美支持手机和平板设备的触控操作

### 武器系统 (5级升级)
- **🔫 冲锋枪**：高射速，升级后射击更快
- **💥 霰弹枪**：散射攻击，升级后子弹更多
- **⚡ 激光炮**：高伤害穿透，升级后威力倍增
- **🌟 散射枪**：多方向攻击，升级后覆盖面更广
- **🛡️ 护盾**：临时无敌保护

### 炸弹系统 (5种类型)
- **🔴 普通炸弹**：标准圆形爆炸
- **🟠 大型炸弹**：范围和威力都更大
- **🟣 斜射炸弹**：随机斜向发射
- **🔵 横向炸弹**：水平方向发射
- **🟤 线性炸弹**：垂直条状精确爆炸

### 智能回旋镖
- **🟡 弧线飞行**：标准弧形轨迹
- **🔴 直线模式**：击杀瓦片后直线穿透
- **🟢 接住重发**：返回时可接住重复使用

## 🚀 快速开始

### 在线游戏
1. 下载项目文件
2. 在项目目录启动HTTP服务器：
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```
3. 打开浏览器访问 `https://forcemind.github.io/Hex-Breaker/`

### 本地文件
也可以直接双击 `index.html` 文件在浏览器中打开（某些浏览器可能有跨域限制）。

## 🎯 游戏操作

### 桌面端
- **←/→ 方向键**：左右移动
- **自动射击**：玩家会自动发射子弹
- **空格键**：开始游戏/重新开始

### 移动端
- **触摸按钮**：屏幕底部的左右移动按钮
- **触摸屏幕**：点击屏幕开始游戏
- **响应式设计**：自动适配不同屏幕尺寸

## 🎮 游戏机制

### 得分系统
- 摧毁瓦片获得分数
- 每8分升级一次，增加游戏难度
- 等级越高，瓦片血量越高，生成越频繁

### 武器升级
- 捡到相同武器可升级（最高5级）
- 高等级武器有更强效果
- 捡到不同武器会重置等级

### 道具掉落
- 瓦片被摧毁时随机掉落道具
- 掉落率随等级提升而增加
- 多样化的武器和炸弹类型

### 游戏结束条件
- 瓦片接触到玩家控制的橡皮时游戏结束
- 护盾可以提供临时保护

## 🛠️ 技术实现

### 架构设计
```
index.html
├── HTML结构
├── CSS样式 (响应式设计)
└── JavaScript游戏逻辑
    ├── Player类 (玩家控制)
    ├── Tile类 (瓦片管理)
    ├── Bullet类 (子弹系统)
    ├── Bomb类 (炸弹系统)
    ├── Boomerang类 (回旋镖)
    ├── ItemDrop类 (道具掉落)
    └── 游戏主循环
```

### 核心特性
- **60FPS锁定**：解决高刷新率屏幕速度问题
- **ES6类架构**：模块化的面向对象设计
- **Canvas渲染**：高性能2D图形渲染
- **事件驱动**：键盘和触摸事件处理
- **状态管理**：游戏状态机制

### 性能优化
- 对象池管理避免频繁创建销毁
- 屏幕外对象自动清理
- 优化的碰撞检测算法
- 移动端友好的帧率控制

## 📱 兼容性

### 支持的浏览器
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

### 支持的设备
- ✅ 桌面电脑 (Windows/Mac/Linux)
- ✅ 手机 (iOS/Android)
- ✅ 平板电脑
- ✅ 触摸屏设备

## 🔧 开发指南

### 项目结构
```
Hex-Breaker/
├── index.html          # 主游戏文件
├── README.md           # 项目说明
├── CHANGELOG.md        # 更新日志
├── LICENSE.md          # 开源协议
└── docs/              # 文档目录
    ├── API.md         # API文档
    ├── DEVELOPMENT.md # 开发指南
    └── DEPLOYMENT.md  # 部署指南
```

### 自定义配置
游戏中的关键参数都可以轻松修改：
```javascript
// 游戏速度
let gameSpeed = 1;

// 瓦片生成触发
if (topMostY > 0) { // 调整这个值改变生成时机

// 武器升级等级
this.weaponLevel = Math.min(5, this.weaponLevel + 1); // 最高等级

// 爆炸范围
this.maxExplosionRadius = 80; // 炸弹爆炸范围
```

## 🤝 贡献指南

### 如何贡献
1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交Pull Request

### 开发建议
- 保持代码风格一致
- 添加必要的注释
- 测试新功能在多设备上的表现
- 更新相关文档

## 📋 TODO清单

### 计划中的功能
- [ ] 音效和背景音乐
- [ ] 更多特殊武器类型
- [ ] Boss战机制
- [ ] 本地最高分保存
- [ ] 多人对战模式
- [ ] 更多视觉特效
- [ ] 成就系统

### 已完成功能
- [x] 基础游戏机制
- [x] 武器升级系统
- [x] 多种炸弹类型
- [x] 智能回旋镖
- [x] 移动端适配
- [x] 响应式设计
- [x] 瓦片厚度视觉化

## 📄 开源协议

本项目采用 MIT 协议开源，详见 [LICENSE.md](LICENSE.md) 文件。

## 🙏 致谢

- 感谢所有测试和反馈的用户
- 感谢开源社区的支持
- HTML5 Canvas技术让浏览器游戏成为可能

## 📞 联系方式

- 项目地址：[GitHub Repository](https://github.com/ForceMind/Hex-Breaker)
- 问题反馈：[Issues](https://github.com/ForceMind/Hex-Breaker/issues)
- 功能建议：[Discussions](https://github.com/ForceMind/Hex-Breaker/discussions)

---

**享受游戏乐趣！🎮**
