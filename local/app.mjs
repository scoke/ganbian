import * as core from "./core.mjs";
import { load, save } from "./store.mjs";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const opts = (xs, v) =>
  '<option value="">请选择</option>' +
  (v !== "" &&
  v !== null &&
  v !== undefined &&
  !xs.map(String).includes(String(v))
    ? [v, ...xs]
    : xs
  )
    .map(
      (x) =>
        `<option ${String(x) === String(v) ? "selected" : ""}>${esc(x)}</option>`,
    )
    .join("");
const button = (text, action, kind = "") =>
  `<button type="button" class="button ${kind}" data-action="${action}">${text}</button>`;
const panel = (title, body) =>
  `<section class="panel"><h2>${title}</h2>${body}</section>`;
const time = (t) => new Date(t).toLocaleString();
const duration = (ms) => {
  const n = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(n / 3600)).padStart(2, "0")}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
const flows = ["未记录", "基本不走", "缓", "中", "急"];
let state,
  busy = false,
  reminders = "",
  draftDirty = false,
  acceptedHash = location.hash,
  restoringHash = false,
  reminderFailed = false,
  statsFlow = "全部";
const fail = (e) => {
  $("#error").hidden = false;
  $("#error").textContent =
    `${e.message || e} 未显示保存成功，原有记录不会主动清空。`;
};
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
async function commit(next) {
  $("#main").inert = true;
  try {
    await save(next);
    state = next;
    $("#error").hidden = true;
  } finally {
    $("#main").inert = false;
  }
}
function fields(r, prefix) {
  return `<div class="form-grid"><label>饵料 · 必填<select name="${prefix}bait" data-bait="${prefix}">${opts(
    core.BAITS.map((b) => b.name),
    r.bait,
  )}</select></label><label>钓组 · 必填<select name="${prefix}rig">${opts(core.RIGS, r.rig)}</select></label></div><fieldset><legend>换饵提醒间隔（小时）· 必填</legend><div class="intervals">${core.HOURS.map((x) => `<label><input type="radio" name="${prefix}interval" value="${x}" ${String(r.interval) === x ? "checked" : ""}><span>${x}</span></label>`).join("")}</div></fieldset>`;
}
function readConfig(form, prefix) {
  const d = new FormData(form);
  return {
    bait: d.get(prefix + "bait") || "",
    rig: d.get(prefix + "rig") || "",
    interval: d.get(prefix + "interval") || "",
  };
}
function readDraft() {
  const f = $("#draft");
  if (!f) return state.draft;
  const d = new FormData(f);
  return {
    spot: d.get("spot"),
    flow: d.get("flow"),
    water: d.get("water"),
    batch: readConfig(f, "batch-"),
    rods: state.draft.rods.map((_, i) => readConfig(f, `r${i}-`)),
  };
}
function sessionView(s) {
  return panel(
    esc(s.plan.spot),
    `<p>${time(s.startedAt)} → ${s.endedAt === null ? "进行中" : time(s.endedAt)}</p><p>起点走水：${esc(s.plan.flow)} · 实测水温：${s.plan.water === null || s.plan.water === "" ? "未记录" : esc(s.plan.water) + " ℃"}</p><div class="grid">${s.rods.map((r, i) => panel(`${i + 1} 号竿 · ${esc(r.bait)}`, `<p>${esc(r.rig)} · ${esc(r.interval)} 小时</p><p>上次投饵：${time(r.lastBaitAt)}</p>${s.endedAt === null ? `<p>下次到期：${time(core.dueAt(r))}</p><div class="timer" data-due="${core.dueAt(r)}"></div><div class="actions">${button("已换饵", `rebait-${i}`, "primary")}${button("调整间隔", `adjust-${i}`)}</div>` : ""}`)).join("")}</div><div class="timeline">${s.events.map((e) => `<p><time>${time(e.at)}</time>${esc(eventText(e))}</p>`).join("")}</div>`,
  );
}
function eventText(e) {
  const n = Number(e.rodIndex) + 1;
  switch (e.type) {
    case "start":
      return "开始垂钓 · 各竿初始投饵";
    case "end":
      return "手动结束场次";
    case "rebait":
      return `${n}号竿 · 已换饵`;
    case "adjust":
      return `${n}号竿：间隔 ${e.oldInterval} → ${e.newInterval} 小时（上次投饵基准不变）`;
    case "catch":
      return `${n}号竿 · ${e.fish} ${e.count} 尾 · 未称重`;
    case "observe":
      return `环境观察 · ${e.flow} · ${e.water === null ? "水温未记录" : e.water + " ℃"}`;
    default:
      return "记录";
  }
}
function render() {
  const route = location.hash.slice(1) || "home",
    s = core.active(state);
  reminders = s
    ? s.rods
        .map((r, i) =>
          core.dueAt(r) <= Date.now() ? `${i + 1}号竿已到检查时间` : "",
        )
        .filter(Boolean)
        .join("；")
    : "";
  $("#nav").innerHTML = [
    ["home", "首页"],
    ["prepare", "出钓配置"],
    ["fishing", "垂钓中"],
    ["history", "历史"],
    ["stats", "统计"],
    ["settings", "数据与能力"],
  ]
    .map(
      ([id, n]) =>
        `<a href="#${id}" ${route === id ? 'class="active" aria-current="page"' : ""}>${n}</a>`,
    )
    .join("");
  let html = "";
  if (route === "prepare")
    html = s
      ? panel(
          "已有进行中场次",
          '<a class="button" href="#fishing">继续本场</a>',
        )
      : `<form id="draft">${panel("钓点与到点观察", `<div class="form-grid"><label>钓点名称<input name="spot" value="${esc(state.draft.spot)}" required></label><label>走水<select name="flow">${opts(flows, state.draft.flow)}</select></label><label>实测水温 ℃（选填）<input type="number" step="any" name="water" value="${esc(state.draft.water)}"></label></div>`)}${panel("统一配置", fields(state.draft.batch, "batch-") + '<p class="hint">选饵带入常用间隔，之后手动选择优先；点击应用前不会改变各竿。</p>' + button("应用到全部竿", "batch"))}<p class="hint" id="dirty">草稿修改后请保存；离开前会提示。准备时间不计入垂钓时长。</p><div class="actions">${button("增加一支竿", "add")}${button("移除最后一支竿", "remove")}</div>${state.draft.rods.map((r, i) => panel(`${i + 1} 号竿`, fields(r, `r${i}-`))).join("")}<div class="actions"><button class="button" type="submit">保存草稿</button>${button("开始垂钓", "start", "primary")}</div></form>`;
  else if (route === "fishing")
    html = s
      ? `<div id="reminder" role="alert" ${reminders ? "" : "hidden"}>${esc(reminders)}</div><p>经过 <strong id="elapsed"></strong> · 页面内提醒，关闭页面后不提醒；浏览器后台可能延迟。</p>${sessionView(s)}<div class="actions">${button("记鱼获", "catch")}${button("追加环境观察", "observe")}${button("结束本场", "end", "danger")}</div>`
      : panel(
          "当前没有进行中场次",
          '<a class="button" href="#prepare">准备出钓</a>',
        );
  else if (route === "history")
    html =
      state.sessions
        .filter((s) => s.endedAt !== null)
        .slice()
        .reverse()
        .map(sessionView)
        .join("") || panel("还没有已结束场次", "不会填入示例成绩。");
  else if (route === "stats") {
    const summary = core.summarize(
      state.sessions.filter(
        (s) => statsFlow === "全部" || s.plan.flow === statsFlow,
      ),
    );
    html = panel(
      "已结束场次汇总",
      `<label>起点走水<select id="stats-flow">${opts(["全部", ...flows], statsFlow)}</select></label><p>${summary.count} 场 · ${summary.catches} 尾 · ${duration(summary.durationMs)}</p><p>仅汇总本机实际记录，按起点走水筛选，未记录与基本不走分开；不作效果排名或精确推荐。</p>`,
    );
  } else if (route === "settings")
    html = panel(
      "数据与能力",
      `<p>记录保存在此浏览器 IndexedDB，不上传。无账号、云同步、原生通知、照片或真实天气潮汐。其他浏览器无法访问这些记录；清理网站数据会丢失记录。</p><p>刷新后可恢复已保存场次；离线记录要求页面仍已打开，尚未提供离线启动缓存。页面后台/休眠时不保证准点提醒，唤醒后检查到期；提醒不等于已换饵。</p><p>导出是 JSON 备份，本版尚无导入恢复界面。请妥善保管，不公开个人记录。</p>${button("导出本机记录", "export")}`,
    );
  else {
    const summary = core.summarize(state.sessions);
    html = panel(
      "把时间，留给水边。",
      `<p>本机已完成 ${summary.count} 场垂钓。</p><a class="button primary" href="#${s ? "fishing" : "prepare"}">${s ? "继续本场" : "准备出钓"}</a><p>不包含模拟场次；请定期导出备份。</p>`,
    );
  }
  $("#main").innerHTML =
    `<h1>${esc({ prepare: "出钓配置", fishing: "垂钓中", history: "历史记录", stats: "统计分析", settings: "数据与能力" }[route] || "竿边 · 本机记录")}</h1>${html}`;
  tickDisplay();
}
function tickDisplay() {
  const s = state && core.active(state);
  if ($("#elapsed") && s)
    $("#elapsed").textContent = duration(Date.now() - s.startedAt);
  document
    .querySelectorAll("[data-due]")
    .forEach(
      (el) =>
        (el.textContent =
          Date.now() >= Number(el.dataset.due)
            ? "已到检查时间"
            : duration(Number(el.dataset.due) - Date.now())),
    );
}
function modal(title, body, submit) {
  const d = document.createElement("dialog");
  d.innerHTML = `<form><h2>${title}</h2>${body}<div class="actions"><button class="button" type="button" id="cancel-dialog">取消</button><button class="button primary">确认</button></div><p role="alert" id="dialog-error"></p></form>`;
  document.body.append(d);
  d.querySelector("#cancel-dialog").onclick = () => {
    d.close();
    d.remove();
  };
  d.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      await submit(new FormData(e.target));
      d.close();
      d.remove();
      render();
      toast("已保存到本机");
    } catch (err) {
      d.querySelector("#dialog-error").textContent = err.message;
      fail(err);
    } finally {
      busy = false;
    }
  };
  d.addEventListener("close", () => d.remove());
  d.showModal();
}
document.addEventListener("change", (e) => {
  if (e.target.id === "stats-flow") {
    statsFlow = e.target.value || "全部";
    render();
    return;
  }
  if (!e.target.closest("#draft")) return;
  draftDirty = true;
  if (e.target.dataset.bait) {
    const prefix = e.target.dataset.bait,
      b = core.BAITS.find((b) => b.name === e.target.value);
    if (b) {
      const radio = $(`[name="${prefix}interval"][value="${b.interval}"]`);
      if (radio) radio.checked = true;
      toast(`已按饵料填入 ${b.interval} 小时，可手动修改`);
    }
  }
  $("#dirty").textContent = "尚未保存/应用：请保存草稿或应用统一配置。";
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "draft") return;
  e.preventDefault();
  if (busy) return;
  busy = true;
  try {
    await commit(core.updateDraft(state, readDraft()));
    draftDirty = false;
    toast("草稿已保存");
  } catch (err) {
    fail(err);
  } finally {
    busy = false;
  }
});
document.addEventListener("click", async (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action || busy || !state) return;
  busy = true;
  try {
    const now = Date.now();
    if (action === "export") {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "ganbian-records.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (["batch", "add", "remove", "start"].includes(action)) {
      const draft = readDraft();
      if (action === "batch") {
        if (
          !confirm(
            `将覆盖 ${draft.rods.length} 支竿的已选字段，包括单竿调整，继续？`,
          )
        )
          return;
        draft.rods = draft.rods.map((r) => ({
          ...r,
          ...Object.fromEntries(
            Object.entries(draft.batch).filter(([, v]) => v !== ""),
          ),
        }));
      }
      if (action === "add")
        draft.rods.push({ bait: "", rig: "", interval: "" });
      if (action === "remove") {
        if (draft.rods.length === 1) throw Error("至少保留一支竿");
        if (!confirm("移除最后一支竿的草稿设置？")) return;
        draft.rods.pop();
      }
      let next = core.updateDraft(state, draft);
      if (action === "start") next = core.start(next, now, crypto.randomUUID());
      await commit(next);
      draftDirty = false;
      if (action === "start") location.hash = "fishing";
      render();
      toast(action === "start" ? "已保存并开始垂钓" : "已保存草稿");
    } else if (action.startsWith("rebait-")) {
      await commit(core.rebait(state, Number(action.slice(7)), now));
      render();
      toast("本竿换饵已保存，其他竿不变");
    } else if (action.startsWith("adjust-")) {
      const index = Number(action.slice(7)),
        rod = core.active(state)?.rods[index];
      if (!rod) return;
      modal(
        "调整间隔 · 保持上次投饵基准",
        `<label>换饵间隔（小时）<select name="interval">${opts(core.HOURS, rod.interval)}</select></label>`,
        (d) => commit(core.adjust(state, index, d.get("interval"), Date.now())),
      );
    } else if (action === "catch") {
      const s = core.active(state);
      modal(
        "记录鱼获",
        `<label>对应竿<select name="rod">${s.rods.map((_, i) => `<option value="${i}">${i + 1} 号竿</option>`).join("")}</select></label><label>鱼种（选填）<input name="fish"></label><label>尾数<input name="count" type="number" min="1" step="1" required value="1"></label><p>本版不记录重量，未称重不算零。</p>`,
        (d) =>
          commit(
            core.recordCatch(
              state,
              Number(d.get("rod")),
              d.get("fish") || "未识别",
              Number(d.get("count")),
              Date.now(),
            ),
          ),
      );
    } else if (action === "observe")
      modal(
        "追加环境观察",
        `<label>走水<select name="flow">${opts(flows, "未记录")}</select></label><label>实测水温（选填）<input name="water" type="number" step="any"></label>`,
        (d) =>
          commit(
            core.observe(state, d.get("flow"), d.get("water"), Date.now()),
          ),
      );
    else if (action === "end") {
      if (
        !confirm("结束本场？结束后不再提醒或接受现场操作，记录保留在本机历史。")
      )
        return;
      await commit(core.end(state, now));
      reminders = "";
      location.hash = "history";
      render();
      toast("本场已结束并保存");
    }
  } catch (err) {
    fail(err);
  } finally {
    busy = false;
  }
});
window.addEventListener("beforeunload", (e) => {
  if (draftDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("input", (e) => {
  if (e.target.closest("#draft")) draftDirty = true;
});
window.addEventListener("hashchange", () => {
  if (restoringHash) {
    restoringHash = false;
    return;
  }
  if (draftDirty) {
    if (!confirm("尚有未保存草稿，离开将放弃本次输入，继续？")) {
      restoringHash = true;
      location.replace(acceptedHash || "#home");
      return;
    }
    draftDirty = false;
  }
  acceptedHash = location.hash;
  if (state) render();
});
async function checkDue() {
  if (!state || busy || reminderFailed) return;
  const s = core.active(state);
  if (!s) return;
  const overdue = s.rods
    .map((r, i) => ({ r, i, due: core.dueAt(r) }))
    .filter((x) => x.due <= Date.now() && x.r.remindedDueAt !== x.due);
  if (!overdue.length) return;
  busy = true;
  try {
    let next = state;
    for (const x of overdue) next = core.markReminded(next, x.i, x.due);
    await commit(next);
    reminders = overdue.map((x) => `${x.i + 1}号竿已到检查时间`).join("；");
    toast(reminders);
    if (location.hash === "#fishing") render();
  } catch (e) {
    reminderFailed = true;
    fail(e);
  } finally {
    busy = false;
  }
}
try {
  state = await load();
  render();
  await checkDue();
  setInterval(() => {
    tickDisplay();
    void checkDue();
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void checkDue();
  });
} catch (e) {
  fail(e);
  $("#main").innerHTML =
    "<h1>本机记录暂不可用</h1><p>未创建空白数据覆盖原记录。请保留浏览器数据，检查存储权限后重试。</p>";
}
