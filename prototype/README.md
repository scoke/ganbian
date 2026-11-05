# 竿边页面原型

这是独立、可点击的 Web 页面原型，不是生产业务应用，也不替代 S2 工程连接验证页。只用浏览器原生能力，不安装运行依赖，不触发数据库、通知、登录或云端操作。

## 打开方式

在仓库根目录执行：

```sh
python3 -m http.server 8092 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8092/prototype/>。也可以直接打开本目录的 HTML，但推荐 HTTP 预览。无需构建，不改动现有工程；未部署公共预览地址。

## 页面与演示路径

- 首页：出钓入口、固定样本概览、最近记录与钓点。
- 出钓准备：钓点、走水、选填实测水温、备注、竿数和统一配置。点击「应用到全部竿」后确认覆盖，仅为原型交互，不定稿 D01/D02。
- 单竿设置：单独修改饵料、钓组和 1 / 1.5 / 2 / 3 / 4 小时间隔。
- 垂钓中：静态倒计时、独立换饵记录、渔获、追加环境观察、确认手动结束。
- 历史记录与详情：固定示例、按钓点筛选。
- 统计分析：固定样本量和使用次数，不输出效果排名或预测。
- 我的目录：示例钓点、饵料、横向可滑动的跨日模拟潮汐时间轴。
- 个人设置：明确展示尚未接入的能力与数据边界。

演示操作仅保存在当前页面内存，刷新立即重置；固定历史/统计不随操作变化。示例场次不是当前真实日期。倒计时、通知、持久化、照片、真实天气潮汐、账号和同步均未实现。待确认业务规则没有因为本原型而获批。当前视觉方向用于评审，不代表最终设计或原生端适配完成。

## 验证

`verify.mjs` 用外部安装的 Playwright 驱动浏览器；它不是原型运行依赖：

```sh
# 另一个临时目录安装测试工具，不污染工程锁文件
npm install --prefix /tmp/ganbian-prototype-browser @playwright/test@1.64.1
/tmp/ganbian-prototype-browser/node_modules/.bin/playwright install chromium
PLAYWRIGHT_PACKAGE=/tmp/ganbian-prototype-browser/node_modules/@playwright/test/package.json node prototype/verify.mjs
```

可指定 `CHROMIUM_PATH` 使用已有 Chromium，`PROTOTYPE_URL` 指定预览地址，`BASELINE_URL` 指向真实 S2 验证页以重新采集基线。检查桌面 1440×1000 / 手机 390×844 的全部页面、水平溢出、异常、单竿与批量配置、半小时间隔、取消弹窗、换饵、渔获文本转义、结束状态、钓点传递、历史筛选、刷新重置。

完整实际浏览器截图及基线说明见 [视觉证据](../docs/prototype-evidence/README.md)。
