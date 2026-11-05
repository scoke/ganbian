# 本机 Web 首版视觉证据

- **Before**：真实原型 revision `d9382b3041c54f0721a1e7de0462f6874624d6b9`，`/prototype/#home`，初始入口无操作，固定模拟数据。
- **After**：本 PR 的 `local/` 实现，`/local/#home`，初始入口无操作，本机空数据。具体 changed revision 见 PR 描述。
- 相同 Chrome、浅色主题、桌面 1440×1000 / 手机 390×844。实际应用截图，不是制作的 mockup。对照展示原来可用原型与新增真实记录入口，并非原型路由被替换或已有个人数据消失。新入口不读取模拟历史。
- 同时提供实际完成配置、单竿调整、换饵与鱼获后的垂钓页。

| 视口 | Before | After | 现场状态 |
| --- | --- | --- | --- |
| 桌面 | [Before](before-desktop.png) | [After](after-desktop.png) | [垂钓中](fishing-desktop.png) |
| 手机 | [Before](before-mobile.png) | [After](after-mobile.png) | [垂钓中](fishing-mobile.png) |

由 `local/verify.mjs` 从真实浏览器采集。自动检查全部六个路由在 320、375、390、1440 宽度无页面横向溢出，必填、单竿独立、1.5 小时、零水温、刷新恢复、历史统计与文本转义通过。执行模型不支持图片输入，因此不声称逐像素人工视觉检查；请求人可在 PR 查看截图审阅。无真实私人记录、凭据或私聊内容。
