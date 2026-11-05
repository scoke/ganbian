const $ = (s) => document.querySelector(s);
const pages = [
  ["home", "⌂", "首页"],
  ["prepare", "☷", "出钓准备"],
  ["fishing", "◷", "垂钓中"],
  ["history", "▤", "历史记录"],
  ["stats", "▥", "统计分析"],
  ["catalog", "◇", "我的目录"],
  ["profile", "⚙", "个人设置"],
];
const rigs = [
  "三叉钩＋浮球",
  "翻板钩·钢丝可定型款",
  "翻板钩·普通尼龙线款",
  "反底钓浮钓组（名称待核对）",
];
const baits = ["玉米粒", "发酵麦粒", "自配糠饼"];
const intervals = [1, 1.5, 2, 3, 4];
const initialRod = () => ({ bait: "玉米粒", rig: rigs[0], interval: "2" });
let rods = Array.from({ length: 3 }, initialRod);
let plan = { spot: "江湾老钓位", flow: "缓流", water: "", note: "" };
let events = ["09:00 · 示例场次开始", "09:20 · 2 号竿记录渔获 · 鲫鱼 1 尾"];
let ended = false,
  historyFilter = "全部",
  detailSpot = "江湾老钓位",
  noticeTimer;
const escape = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const options = (items, value) =>
  items
    .map(
      (x) =>
        `<option ${String(x) === String(value) ? "selected" : ""} value="${escape(x)}">${escape(x)}</option>`,
    )
    .join("");
const btn = (label, action, kind = "") =>
  `<button class="button ${kind}" data-action="${action}">${label}</button>`;
const heading = (en, title, desc, action = "") =>
  `<div class="page-title"><div><p class="eyebrow">${en}</p><h1>${title}</h1><p class="sub">${desc}</p></div>${action}</div>`;
const panel = (title, body) =>
  `<section class="panel"><h2>${title}</h2>${body}</section>`;
const metrics = (items) =>
  `<div class="grid metrics">${items.map(([name, value, unit, foot]) => `<div class="stat"><p>${name}</p><strong>${value}<small>${unit}</small></strong><div class="foot">${foot}</div></div>`).join("")}</div>`;
const trips = () =>
  ["江湾老钓位", "北岸芦苇荡", "石桥下游"]
    .map(
      (name, i) =>
        `<a class="trip-row list-card" href="#detail" data-detail="${name}"><div><h3>${name} <span class="chip">已结束 · 示例</span></h3><p>示例 ${["10 月 26 日", "10 月 19 日", "10 月 12 日"][i]} · ${[3, 4, 3][i]} 支竿 · 缓流</p></div><div><strong>${[6, 4, 2][i]} 尾</strong><p style="margin-top:7px">${[4.5, 3, 5][i]} 小时　›</p></div></a>`,
    )
    .join("");
const tide = () =>
  `<p class="sub">模拟曲线，不代表任何站点真实水位；左右滑动查看跨日时间。</p><div class="tide-scroll"><div><svg class="tide-chart" viewBox="0 0 800 130" role="img" aria-label="模拟跨日潮汐曲线"><path d="M0 100 Q100 5 200 70 T400 65 T600 55 T800 80 L800 130 L0 130Z" fill="#edf3e8"/><path d="M0 100 Q100 5 200 70 T400 65 T600 55 T800 80" fill="none" stroke="#8ba681" stroke-width="3"/><path d="M340 0V130" stroke="#a8b59a" stroke-dasharray="4 5"/></svg><div class="tide-times"><span>当日 00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>次日 00:00</span><span>06:00</span></div></div></div>`;
function home() {
  return (
    heading(
      "A QUIET DAY BY THE WATER",
      "把时间，留给水边。",
      "从一次准备充分的出钓开始，慢慢积累自己的垂钓经验。",
    ) +
    `<section class="hero"><div><div class="hero-label"><span>出钓计划</span><span>—</span><span>准备好下一次出发</span></div><h2>每一竿，都心中有数。</h2><p>记录水情，安排钓组，让每次换饵都有迹可循。</p></div><a class="button" href="#prepare">＋ 新建出钓</a></section>` +
    metrics([
      ["累计出钓", "12", "次", "以下均为示例数据"],
      ["水边时光", "48.5", "小时", "准备时间不计入"],
      ["累计渔获", "36", "尾", "样本不代表预测"],
    ]) +
    `<div class="columns"><section class="panel"><div class="panel-heading"><h2>最近的水边时光</h2><a class="link" href="#history">全部记录 ↗</a></div>${trips()}</section><section class="panel"><div class="panel-heading"><h2>常去的钓点</h2><span class="chip">示例</span></div><div class="landscape" role="img" aria-label="抽象河岸装饰"></div><h3>江湾老钓位</h3><p class="sub">河道 · 南岸缓坡</p><div class="meta"><span>最近出钓 10 月 26 日</span><span>6 次记录</span></div><div class="actions"><a class="button small" href="#catalog">查看钓点 ›</a></div></section></div>`
  );
}
function prepare() {
  return (
    heading(
      "BEFORE YOU CAST",
      "出钓准备",
      "先观察环境，再为每支竿做好安排。",
      `<a class="button" href="#home">返回首页</a>`,
    ) +
    `<div class="steps"><span class="selected">01 钓点与环境</span><span>02 统一配置</span><span>03 逐竿确认</span></div><form id="plan-form">${panel("钓点与现场观察", `<div class="form-grid"><label>本次钓点<select name="spot">${options(["江湾老钓位", "北岸芦苇荡", "石桥下游"], plan.spot)}</select></label><label>现场走水<select name="flow">${options(["未观察", "静水", "缓流", "急流"], plan.flow)}</select></label><label>实测水温 · °C（选填）<input type="number" step="0.1" name="water" value="${escape(plan.water)}" placeholder="尚未测量；不是气温"></label><label>本场备注（选填）<input name="note" maxlength="120" value="${escape(plan.note)}" placeholder="记下水边的第一印象"></label></div>`)}${panel("本场安排与统一配置", `<p class="hint">演示：应用前会确认覆盖所有竿。真实覆盖规则仍待确认。</p><div class="form-grid"><label>竿数<select name="count">${options([1, 2, 3, 4, 5, 6], rods.length)}</select></label><label>饵料<select name="bait">${options(baits, baits[0])}</select></label><label>钓组<select name="rig">${options(rigs, rigs[0])}</select></label><label>换饵间隔 · 小时<select name="interval">${options(intervals, 2)}</select></label></div><div class="actions">${btn("应用到全部竿", "batch")}</div>`)}<div class="panel-heading"><h2 class="section-title">逐竿确认</h2><span class="badge-num">${rods.length} 支竿</span></div><div class="grid">${rods.map((r, i) => `<section class="panel rod"><div class="rod-head"><span class="rod-number">0${i + 1}</span><a class="link" href="#rod-${i}">单竿设置 ↗</a></div><h3>${escape(r.bait)}</h3><div class="details"><span>钓组</span><b>${escape(r.rig)}</b></div><div class="details"><span>换饵间隔</span><b>${r.interval} 小时</b></div></section>`).join("")}</div><div class="notice">这是流程演示，开始后仅切换到模拟垂钓页，不建立真实计时或系统提醒。</div><div class="actions">${btn("确认配置，预览垂钓中 →", "start", "primary")}</div></form>`
  );
}
function rodPage(index) {
  const r = rods[index];
  if (!r)
    return heading(
      "ROD",
      "未找到这支竿",
      "请返回出钓准备重新选择。",
      '<a class="button" href="#prepare">返回准备</a>',
    );
  return (
    heading(
      "ONE ROD AT A TIME",
      `${index + 1} 号竿 · 单竿设置`,
      "这支竿可以有自己的安排，不影响其他竿。",
    ) +
    `<form id="rod-form" data-index="${index}">${panel("配置这支竿", `<div class="form-grid"><label>饵料 · 必填<select name="bait">${options(baits, r.bait)}</select></label><label>钓组 · 必填<select name="rig">${options(rigs, r.rig)}</select></label><label>换饵间隔 · 小时<select name="interval">${options(intervals, r.interval)}</select></label></div><p class="hint">只保存当前竿。更换饵料不会自动覆盖已选择的间隔。</p>`)}<div class="actions"><a class="button" href="#prepare">取消</a><button class="button primary" type="submit">保存单竿配置</button></div></form>`
  );
}
function fishing() {
  return (
    heading(
      "STAY BY THE WATER",
      "垂钓中",
      `${escape(plan.spot)} · ${escape(plan.flow)} · ${plan.water ? `实测水温 ${escape(plan.water)}°C` : "水温未记录"}`,
      ended
        ? '<a class="button" href="#history">查看历史</a>'
        : btn("结束本场", "end", "danger"),
    ) +
    `<div class="notice">${ended ? "本场演示已结束，不再接受现场操作。" : "静态时钟示例，倒计时不会实际运行；换饵和渔获仅临时保存在当前页面内存。首次投饵和到期提醒规则未定稿。"}</div>` +
    metrics([
      ["本场时长", ended ? "已结束" : "02:15", "", "示例时长，不是真实计时"],
      ["当前竿数", rods.length, "支", "各竿独立配置"],
      [
        "本场渔获",
        events.filter((e) => e.includes("渔获")).length,
        "条记录",
        "仅用于交互演示",
      ],
    ]) +
    `<div class="grid">${rods.map((r, i) => `<section class="panel rod"><div class="rod-head"><span class="rod-number">0${i + 1}</span><span class="chip ${i === 1 ? "amber" : ""}">${ended ? "已结束" : i === 1 ? "待换饵 · 示例" : "垂钓中"}</span></div><h3>${escape(r.bait)}</h3><p class="hint">${escape(r.rig)}</p><div class="details"><span>换饵间隔</span><b>${r.interval} 小时</b></div><div class="timer">${i === 1 ? "00:00" : "01:24"}</div><div class="timer-label">${i === 1 ? "示例：本竿已到换饵时间" : "距下次换饵 · 静态示例"}</div><button class="button primary" data-action="rebait-${i}" ${ended ? "disabled" : ""}>记录本竿换饵</button></section>`).join("")}</div><div class="columns"><section class="panel"><div class="panel-heading"><h2>现场时间线</h2><button class="button small" data-action="catch" ${ended ? "disabled" : ""}>＋ 记一笔渔获</button></div><div class="timeline">${events
      .map((e) => {
        const [time, ...text] = e.split(" · ");
        return `<p><time>${escape(time)}</time>${escape(text.join(" · "))}</p>`;
      })
      .join(
        "",
      )}</div></section>${panel("环境观察", `<p class="sub">水情不等于潮汐阶段。观察应独立记录。</p><div class="actions"><button class="button" data-action="observe" ${ended ? "disabled" : ""}>＋ 补充现场观察</button></div>`)}</div>`
  );
}
function history() {
  return (
    heading(
      "YOUR DAYS OUT",
      "历史记录",
      "回看每一次出钓，保留自己的水边记忆。",
    ) +
    `<div class="tabs">${["全部", "江湾老钓位", "北岸芦苇荡"].map((x) => btn(x, `filter-${x}`, historyFilter === x ? "selected" : "")).join("")}</div><section class="panel">${historyFilter === "全部" ? trips() : `<a class="trip-row list-card" href="#detail" data-detail="${historyFilter}"><div><h3>${historyFilter}</h3><p>示例记录 · 缓流 · 3 支竿</p></div><strong>查看详情 ›</strong></a>`}</section>`
  );
}
function detail() {
  const index = ["江湾老钓位", "北岸芦苇荡", "石桥下游"].indexOf(detailSpot);
  const hours = [4.5, 3, 5][index] || 4.5;
  const count = [6, 4, 2][index] || 6;
  return (
    heading(
      "SESSION NOTES",
      escape(detailSpot),
      `示例场次 · 09:00 开始 · ${hours} 小时 · 已结束`,
      '<a class="button" href="#history">返回历史</a>',
    ) +
    metrics([
      ["垂钓时长", hours, "小时", "不含准备时间"],
      ["本场渔获", count, "尾", "部分未称重"],
      ["实测水温", "未记录", "", "不以气温代替"],
    ]) +
    panel(
      "本场配置",
      `<div class="trip-row"><span>1 – 3 号竿</span><strong>玉米粒 / 三叉钩＋浮球 / 2 小时</strong></div><p class="hint">历史展示当时快照；目录重命名不应改写过去。</p>`,
    ) +
    panel(
      "本场时间线",
      '<div class="timeline"><p><time>09:00</time>开始垂钓 · 缓流</p><p><time>10:20</time>2 号竿 · 鲫鱼 2 尾 · 未称重</p><p><time>11:00</time>1 号竿 · 换饵</p><p><time>结束</time>手动结束本场</p></div>',
    )
  );
}
function stats() {
  return (
    heading(
      "LOOK BACK, LEARN SLOWLY",
      "统计分析",
      "找到自己的习惯，不把历史样本当作未来预测。",
    ) +
    `<div class="notice">以下为固定示例汇总，不随演示操作变化。只展示样本量，不给出“最佳饵料”或渔获预测。</div>` +
    metrics([
      ["出钓样本", "12", "场", "固定示例数据"],
      ["总垂钓时长", "48.5", "小时", "仅计算已结束场次"],
      ["未称重记录", "8", "条", "缺失值不记为零"],
    ]) +
    `<div class="grid two">${panel(
      "常用饵料 · 使用场次",
      [
        ["玉米粒", 8, 80],
        ["发酵麦粒", 3, 30],
        ["自配糠饼", 1, 10],
      ]
        .map(
          ([x, n, w]) =>
            `<div class="bar-row"><span>${x}</span><div class="bar"><i style="width:${w}%"></i></div><span>${n} 场</span></div>`,
        )
        .join("") +
        '<p class="hint">场次使用频率不是效果排名，同一场可使用多种饵料。</p>',
    )}${panel(
      "常去钓点 · 出钓次数",
      [
        ["江湾老钓位", 6, 75],
        ["北岸芦苇荡", 4, 50],
        ["石桥下游", 2, 25],
      ]
        .map(
          ([x, n, w]) =>
            `<div class="bar-row"><span>${x}</span><div class="bar"><i style="width:${w}%"></i></div><span>${n} 次</span></div>`,
        )
        .join(""),
    )}</div>`
  );
}
function catalog() {
  return (
    heading(
      "KEEP WHAT WORKS FOR YOU",
      "我的目录",
      "熟悉的钓点、常用的饵料，下次不必从头填写。",
    ) +
    `<div class="grid two">${panel(
      "钓点",
      [
        ["江湾老钓位", "河道 · 南岸缓坡"],
        ["北岸芦苇荡", "湖库 · 北岸浅滩"],
        ["石桥下游", "河道 · 石桥下游"],
      ]
        .map(
          ([x, d]) =>
            `<div class="trip-row"><div><h3>${x}</h3><p>${d} · 示例</p></div><a class="link" href="#prepare" data-spot="${x}">去准备 ›</a></div>`,
        )
        .join(""),
    )}${panel("饵料", baits.map((x, i) => `<div class="trip-row"><div><h3>${x}</h3><p>常用间隔 ${[2, 1.5, 3][i]} 小时 · 仅供填写参考</p></div><span class="chip">示例</span></div>`).join(""))}</div>` +
    panel("潮汐时间轴 · 模拟", tide())
  );
}
function profile() {
  return (
    heading(
      "YOUR SPACE",
      "个人与设置",
      "预览能力状态，真实登录与同步尚未接入。",
    ) +
    panel(
      "当前身份",
      '<div class="trip-row"><div><h3>演示访客</h3><p>不绑定账号 · 不收集个人数据</p></div><span class="chip">原型模式</span></div>',
    ) +
    panel(
      "能力与边界",
      [
        ["系统通知", "未接入；不会发送真实换饵提醒"],
        ["离线保存", "未实现；刷新或关闭页面即丢失演示操作"],
        ["账号与云同步", "待确认登录方式和多设备责任"],
        ["环境与潮汐", "模拟展示，不可用于实际水情判断"],
        ["照片与导出", "尚未实现"],
      ]
        .map(
          ([x, d]) =>
            `<div class="toggle-row"><div><p>${x}</p><small>${d}</small></div><span class="chip">未接入</span></div>`,
        )
        .join(""),
    ) +
    `<div class="actions">${btn("重置演示数据", "reset")}</div>`
  );
}
function render() {
  const focusAction = document.activeElement?.dataset.action;
  let route = location.hash.slice(1) || "home";
  const navRoute = route.startsWith("rod-")
    ? "prepare"
    : route === "detail"
      ? "history"
      : route;
  $("#nav").innerHTML = pages
    .map(
      ([id, icon, name]) =>
        `<a href="#${id}" ${navRoute === id ? 'class="active" aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span>${name}</a>`,
    )
    .join("");
  $("#crumb").textContent = pages.find((x) => x[0] === navRoute)?.[2] || "首页";
  const views = {
    home,
    prepare,
    fishing,
    history,
    detail,
    stats,
    catalog,
    profile,
  };
  $("#main").innerHTML = route.startsWith("rod-")
    ? rodPage(Number(route.slice(4)))
    : (views[route] || home)();
  const focusTarget =
    [...document.querySelectorAll("[data-action]")].find(
      (el) => el.dataset.action === focusAction,
    ) || document.querySelector("h1");
  if (focusTarget) {
    if (focusTarget.tagName === "H1") focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}
function toast(text) {
  clearTimeout(noticeTimer);
  $("#toast").textContent = text;
  $("#toast").style.display = "block";
  noticeTimer = setTimeout(() => ($("#toast").style.display = "none"), 3500);
}
function savePlan() {
  const f = $("#plan-form");
  if (f) {
    const d = new FormData(f);
    plan = {
      spot: d.get("spot"),
      flow: d.get("flow"),
      water: d.get("water"),
      note: d.get("note"),
    };
  }
}
function dialog(title, body, submit) {
  const d = document.createElement("dialog");
  d.innerHTML = `<form method="dialog"><h2 id="dialog-title">${title}</h2><div class="dialog-fields">${body}</div><div class="actions"><button class="button" value="cancel" formnovalidate>取消</button><button class="button primary" value="confirm">确认</button></div></form>`;
  d.setAttribute("aria-labelledby", "dialog-title");
  document.body.append(d);
  d.addEventListener("close", () => {
    if (d.returnValue === "confirm")
      submit(new FormData(d.querySelector("form")));
    d.remove();
  });
  d.showModal();
}
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (link?.dataset.detail) detailSpot = link.dataset.detail;
  if (link?.dataset.spot) plan.spot = link.dataset.spot;
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  e.preventDefault();
  if (action === "reset") {
    location.reload();
    return;
  }
  if (action === "batch") {
    savePlan();
    const d = new FormData($("#plan-form"));
    dialog(
      "覆盖全部竿配置？",
      '<p class="sub">仅演示：将覆盖单竿已做的调整。此处不代表最终产品覆盖规则。</p>',
      () => {
        rods = Array.from({ length: Number(d.get("count")) }, () => ({
          bait: d.get("bait"),
          rig: d.get("rig"),
          interval: d.get("interval"),
        }));
        render();
        toast("已应用到全部竿 · 仅本次演示");
      },
    );
  } else if (action === "start") {
    savePlan();
    ended = false;
    events = ["09:00 · 开始模拟场次"];
    location.hash = "fishing";
  } else if (action === "end") {
    dialog(
      "结束本场演示？",
      '<p class="sub">结束后本场不能继续记录。不会保存真实历史。</p>',
      () => {
        ended = true;
        events.push("11:15 · 手动结束本场演示");
        render();
        toast("本场演示已结束");
      },
    );
  } else if (action.startsWith("rebait-")) {
    if (ended) return;
    const n = Number(action.split("-")[1]) + 1;
    events.push(`11:15 · ${n} 号竿换饵 · 演示记录`);
    render();
    toast(`已记录 ${n} 号竿换饵，其他竿不受影响`);
  } else if (action === "catch") {
    if (ended) return;
    dialog(
      "记一笔渔获",
      '<label>对应竿<select name="rod">' +
        options(
          rods.map((_, i) => `${i + 1} 号竿`),
          "1 号竿",
        ) +
        '</select></label><label>鱼种<input name="fish" maxlength="30" required placeholder="例如：鲫鱼"></label><label>尾数<input type="number" name="count" required min="1" max="999" value="1"></label><p class="hint">演示不采集重量；未称重不记为零。</p>',
      (d) => {
        events.push(
          `11:15 · ${d.get("rod")}记录渔获 · ${d.get("fish")} ${d.get("count")} 尾`,
        );
        render();
        toast("渔获已加入演示时间线");
      },
    );
  } else if (action === "observe") {
    if (ended) return;
    dialog(
      "补充现场观察",
      '<label>当前走水<select name="flow">' +
        options(["未观察", "静水", "缓流", "急流"], plan.flow) +
        '</select></label><label>实测水温 · °C（选填）<input type="number" step="0.1" name="water" placeholder="尚未测量"></label>',
      (d) => {
        events.push(
          `11:15 · 环境观察 · ${d.get("flow")} · ${d.get("water") ? d.get("water") + "°C" : "水温未记录"}`,
        );
        render();
        toast("已追加观察，未覆盖起点环境");
      },
    );
  } else if (action.startsWith("filter-")) {
    historyFilter = action.slice(7);
    render();
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "rod-form") {
    e.preventDefault();
    const d = new FormData(e.target);
    rods[Number(e.target.dataset.index)] = {
      bait: d.get("bait"),
      rig: d.get("rig"),
      interval: d.get("interval"),
    };
    location.hash = "prepare";
    toast("已保存单竿配置");
  } else if (e.target.id === "plan-form") e.preventDefault();
});
document.addEventListener("change", (e) => {
  if (e.target.closest("#plan-form")) savePlan();
});
$("#reset").addEventListener("click", () => location.reload());
window.addEventListener("hashchange", render);
render();
