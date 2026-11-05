import test from "node:test";
import assert from "node:assert/strict";
import {
  HOURS,
  BAITS,
  RIGS,
  createState,
  validateState,
  updateDraft,
  start,
  active,
  dueAt,
  rebait,
  adjust,
  recordCatch,
  observe,
  end,
  markReminded,
  summarize,
} from "./core.mjs";

function ready(rodCount = 2) {
  const state = createState();
  return updateDraft(state, {
    ...state.draft,
    spot: "河边",
    water: "2.5",
    rods: Array.from({ length: rodCount }, () => ({
      bait: "玉米",
      rig: "单钩通线",
      interval: "2",
    })),
  });
}
function running() {
  return start(ready(), 1000, "trip-1");
}
function frozen(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) frozen(child);
  }
  return value;
}
const clone = (value) => JSON.parse(JSON.stringify(value));

test("initial state and catalogs are valid and use UI string intervals", () => {
  assert.deepEqual(createState(), {
    version: 1,
    draft: {
      spot: "",
      flow: "未记录",
      water: "",
      rods: [{ bait: "", rig: "", interval: "" }],
      batch: { bait: "", rig: "", interval: "" },
    },
    sessions: [],
  });
  assert.equal(validateState(createState()), true);
  assert.deepEqual(HOURS, ["1", "1.5", "2", "3", "4"]);
  assert.ok(RIGS.length > 0);
  assert.deepEqual(BAITS, [
    { name: "玉米粒", interval: "2" },
    { name: "发酵麦粒", interval: "1.5" },
    { name: "自配糠饼", interval: "3" },
  ]);
  assert.deepEqual(RIGS, [
    "三叉钩＋浮球",
    "翻板钩·钢丝可定型款",
    "翻板钩·普通尼龙线款",
    "反底钓浮钓组（名称待核对）",
  ]);
  assert.ok(BAITS.every((item) => HOURS.includes(item.interval)));
});

test("draft copies input without changing selected/manual values or imposing name caps", () => {
  const source = frozen(createState());
  const draft = {
    ...source.draft,
    spot: "x".repeat(5000),
    rods: [{ bait: "<img onerror=evil()>", rig: "自定义", interval: "4" }],
  };
  const next = updateDraft(source, draft);
  draft.rods[0].interval = "1";
  assert.equal(next.draft.rods[0].interval, "4");
  assert.equal(source.draft.rods[0].interval, "");
  assert.equal(validateState(start(next, 0, "s")), true);
});

test("start validates each rod, snapshots plan and initializes first-bait baseline", () => {
  assert.throws(() => start(createState(), 0, "s"));
  for (const field of ["bait", "rig", "interval"]) {
    const state = ready();
    state.draft.rods[1][field] = "";
    assert.throws(() => start(state, 0, "s"), /第 2 竿/);
  }
  const missingSpot = ready();
  missingSpot.draft.spot = "   ";
  assert.throws(() => start(missingSpot, 0, "s"), /钓点/);
  const source = frozen(ready());
  const state = start(source, 1000, "s");
  assert.equal(active(source), null);
  assert.equal(active(state).startedAt, 1000);
  assert.equal(active(state).rods[0].lastBaitAt, 1000);
  assert.equal(active(state).rods[0].remindedDueAt, null);
  assert.equal(dueAt(active(state).rods[0]), 7_201_000);
  assert.notEqual(active(state).plan, source.draft);
  assert.notEqual(active(state).rods[0], source.draft.rods[0]);
  assert.equal(start(state, NaN, ""), state);
  assert.equal(validateState(state), true);
});

test("rebait affects only one rod and retains immutable snapshots", () => {
  const source = frozen(running());
  const state = rebait(source, 1, 2000);
  assert.equal(active(state).rods[0], active(source).rods[0]);
  assert.equal(active(state).rods[1].lastBaitAt, 2000);
  assert.equal(active(source).rods[1].lastBaitAt, 1000);
  assert.deepEqual(active(state).events.at(-1), {
    type: "rebait",
    at: 2000,
    rodIndex: 1,
  });
  assert.equal(validateState(state), true);
});

test("adjust keeps baseline and records old/new interval; overdue reminder is marked once", () => {
  let state = running();
  const oldDue = dueAt(active(state).rods[0]);
  state = markReminded(state, 0, oldDue);
  state = adjust(frozen(state), 0, "1", 9_000_000);
  const rod = active(state).rods[0];
  assert.equal(rod.lastBaitAt, 1000);
  assert.equal(rod.remindedDueAt, null);
  assert.equal(dueAt(rod), 3_601_000);
  assert.deepEqual(active(state).events.at(-1), {
    type: "adjust",
    at: 9_000_000,
    rodIndex: 0,
    oldInterval: "2",
    newInterval: "1",
  });
  assert.equal(markReminded(state, 0, oldDue), state);
  const reminded = markReminded(state, 0, dueAt(rod));
  assert.equal(markReminded(reminded, 0, dueAt(rod)), reminded);
  assert.equal(active(reminded).events.length, 2);
  assert.equal(adjust(reminded, 0, "1", 9_000_000), reminded);
  assert.equal(
    active(rebait(reminded, 0, 9_000_001)).rods[0].remindedDueAt,
    null,
  );
  assert.equal(validateState(reminded), true);
});

test("catch/observation events and ended-only summary; end is idempotent", () => {
  let state = running();
  state = recordCatch(state, 0, "鲫鱼", 3, 2000);
  state = observe(state, "缓", "", 3000);
  state = observe(state, "急", "1.2", 4000);
  state = observe(state, "未记录", 0, 5000);
  assert.deepEqual(
    active(state)
      .events.slice(2)
      .map((event) => event.water),
    [null, 1.2, 0],
  );
  assert.deepEqual(summarize(state.sessions), {
    count: 0,
    catches: 0,
    durationMs: 0,
  });
  state = end(frozen(state), 6000);
  assert.equal(active(state), null);
  assert.equal(end(state, NaN), state);
  assert.equal(markReminded(state, 0, 0), state);
  assert.deepEqual(summarize(state.sessions), {
    count: 1,
    catches: 3,
    durationMs: 5000,
  });
  for (const operation of [
    () => rebait(state, 0, 7000),
    () => adjust(state, 0, "1", 7000),
    () => recordCatch(state, 0, "鲤鱼", 1, 7000),
    () => observe(state, "缓", "", 7000),
  ])
    assert.throws(operation);
  assert.throws(() => start(state, 7000, "trip-1"));
  const second = start(state, 7000, "trip-2");
  assert.equal(second.sessions.length, 2);
  assert.equal(validateState(second), true);
});

test("invalid inputs never change state", () => {
  const state = frozen(running());
  for (const now of [NaN, Infinity, -Infinity, "1000", null, undefined]) {
    assert.throws(() => rebait(state, 0, now));
    assert.throws(() => start(ready(), now, "s"));
  }
  for (const index of [-1, 2, 0.5, "0", NaN])
    assert.throws(() => rebait(state, index, 2000));
  for (const value of ["0", "2.5", 2, "", NaN])
    assert.throws(() => adjust(state, 0, value, 2000));
  for (const count of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    "1",
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() => recordCatch(state, 0, "鲫鱼", count, 2000));
  }
  for (const fish of ["", "   ", null, 7])
    assert.throws(() => recordCatch(state, 0, fish, 1, 2000));
  for (const water of ["oops", " ", Infinity, NaN, {}, true])
    assert.throws(() => observe(state, "缓", water, 2000));
  assert.throws(() => observe(state, "", "", 2000));
  assert.throws(() => rebait(state, 0, 999));
  assert.throws(() => end(state, 999));
  assert.equal(dueAt({ interval: "bogus", lastBaitAt: 0 }), null);
  assert.equal(dueAt(null), null);
  assert.equal(validateState(state), true);
});

test("persisted validation rejects malformed payloads and duplicate/overlapping sessions", () => {
  const good = recordCatch(running(), 0, "鲫鱼", 2, 2000);
  assert.equal(validateState(clone(good)), true);
  const changes = [
    (state) => {
      state.version = 2;
    },
    (state) => {
      delete state.draft;
    },
    (state) => {
      state.draft.water = "NaN";
    },
    (state) => {
      state.draft.flow = "invalid";
    },
    (state) => {
      state.draft.rods = Array(1);
    },
    (state) => {
      state.sessions[0].rods = Array(2);
    },
    (state) => {
      state.sessions[0].events = Array(2);
    },
    (state) => {
      state.sessions[0].plan.spot = "";
    },
    (state) => {
      state.draft.rods = [];
    },
    (state) => {
      state.draft.rods[0].interval = 2;
    },
    (state) => {
      delete state.draft.batch;
    },
    (state) => {
      state.sessions[0].startedAt = Infinity;
    },
    (state) => {
      state.sessions[0].endedAt = 0;
    },
    (state) => {
      state.sessions[0].rods[0].lastBaitAt = NaN;
    },
    (state) => {
      state.sessions[0].rods[0].remindedDueAt = 12;
    },
    (state) => {
      state.sessions[0].rods.pop();
    },
    (state) => {
      state.sessions[0].events[1].count = 0;
    },
    (state) => {
      state.sessions[0].events[1].rodIndex = 99;
    },
    (state) => {
      state.sessions[0].events[1].type = "unknown";
    },
    (state) => {
      state.sessions[0].events[1].at = 0;
    },
    (state) => {
      state.sessions[0].events = [];
    },
    (state) => {
      state.sessions[0].events.push({ type: "end", at: 3000 });
    },
    (state) => {
      state.sessions.push(clone(state.sessions[0]));
    },
    (state) => {
      const second = clone(state.sessions[0]);
      second.id = "other";
      state.sessions.push(second);
    },
  ];
  for (const change of changes) {
    const bad = clone(good);
    change(bad);
    assert.equal(validateState(bad), false, change.toString());
  }
  for (const bad of [
    null,
    undefined,
    [],
    "bad",
    1,
    {},
    { version: 1 },
    Object.create(null),
  ]) {
    assert.equal(validateState(bad), false);
  }
  const ended = end(good, 3000);
  const afterEnd = clone(ended);
  afterEnd.sessions[0].events.push({
    type: "observe",
    at: 4000,
    flow: "缓",
    water: null,
  });
  assert.equal(validateState(afterEnd), false);
});
