/** Browser-independent, immutable fishing-session model. All timestamps are epoch milliseconds. */
export const HOURS = Object.freeze(["1", "1.5", "2", "3", "4"]);
export const RIGS = Object.freeze([
  "三叉钩＋浮球",
  "翻板钩·钢丝可定型款",
  "翻板钩·普通尼龙线款",
  "反底钓浮钓组（名称待核对）",
]);
export const FLOWS = Object.freeze(["未记录", "基本不走", "缓", "中", "急"]);
/** Starter examples, not authoritative bait replacement recommendations. */
export const BAITS = Object.freeze(
  [
    { name: "玉米粒", interval: "2" },
    { name: "发酵麦粒", interval: "1.5" },
    { name: "自配糠饼", interval: "3" },
  ].map(Object.freeze),
);
export const rigs = RIGS;
export const baits = BAITS;

const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const text = (value) => typeof value === "string";
const denseArray = (value) =>
  Array.isArray(value) &&
  Array.from(value.keys()).every((index) => Object.hasOwn(value, index));
const filled = (value) => text(value) && value.trim().length > 0;
const interval = (value) => HOURS.includes(value);
const waterValue = (value) =>
  value === "" ||
  (text(value) && value.trim() !== "" && Number.isFinite(Number(value)));
const waterNumber = (value) => (value === "" ? null : Number(value));
const blankRod = () => ({ bait: "", rig: "", interval: "" });
const copyRod = (rod) => ({
  bait: rod.bait,
  rig: rod.rig,
  interval: rod.interval,
});
const copyDraft = (draft) => ({
  spot: draft.spot,
  flow: draft.flow,
  water: draft.water,
  rods: draft.rods.map(copyRod),
  batch: copyRod(draft.batch),
});
const validDraftRod = (rod) =>
  object(rod) &&
  text(rod.bait) &&
  text(rod.rig) &&
  (rod.interval === "" || interval(rod.interval));
const validDraft = (draft) =>
  object(draft) &&
  text(draft.spot) &&
  FLOWS.includes(draft.flow) &&
  waterValue(draft.water) &&
  denseArray(draft.rods) &&
  draft.rods.length > 0 &&
  draft.rods.every(validDraftRod) &&
  validDraftRod(draft.batch);
const completeRod = (rod) =>
  validDraftRod(rod) &&
  filled(rod.bait) &&
  filled(rod.rig) &&
  interval(rod.interval);
const validIndex = (index, length) =>
  Number.isInteger(index) && index >= 0 && index < length;

export function createState() {
  return {
    version: 1,
    draft: {
      spot: "",
      flow: "未记录",
      water: "",
      rods: [blankRod()],
      batch: blankRod(),
    },
    sessions: [],
  };
}

function validEvent(event, session) {
  if (
    !object(event) ||
    !finite(event.at) ||
    event.at < session.startedAt ||
    (session.endedAt !== null && event.at > session.endedAt)
  )
    return false;
  switch (event.type) {
    case "start":
      return event.at === session.startedAt;
    case "end":
      return session.endedAt !== null && event.at === session.endedAt;
    case "rebait":
      return validIndex(event.rodIndex, session.rods.length);
    case "adjust":
      return (
        validIndex(event.rodIndex, session.rods.length) &&
        interval(event.oldInterval) &&
        interval(event.newInterval)
      );
    case "catch":
      return (
        validIndex(event.rodIndex, session.rods.length) &&
        filled(event.fish) &&
        Number.isSafeInteger(event.count) &&
        event.count > 0
      );
    case "observe":
      return (
        FLOWS.includes(event.flow) &&
        (event.water === null || finite(event.water))
      );
    default:
      return false;
  }
}

function validSession(session) {
  if (
    !object(session) ||
    !filled(session.id) ||
    !finite(session.startedAt) ||
    !(
      session.endedAt === null ||
      (finite(session.endedAt) && session.endedAt >= session.startedAt)
    ) ||
    !validDraft(session.plan) ||
    !filled(session.plan.spot) ||
    !session.plan.rods.every(completeRod) ||
    !denseArray(session.rods) ||
    session.rods.length !== session.plan.rods.length ||
    !denseArray(session.events) ||
    session.events.length === 0
  )
    return false;
  if (
    !session.rods.every(
      (rod) =>
        completeRod(rod) &&
        dueAt(rod) !== null &&
        finite(rod.lastBaitAt) &&
        rod.lastBaitAt >= session.startedAt &&
        (session.endedAt === null || rod.lastBaitAt <= session.endedAt) &&
        (rod.remindedDueAt === null ||
          (finite(rod.remindedDueAt) && rod.remindedDueAt === dueAt(rod))),
    )
  )
    return false;
  if (!session.events.every((event) => validEvent(event, session)))
    return false;
  if (
    session.events[0].type !== "start" ||
    session.events.filter((event) => event.type === "start").length !== 1
  )
    return false;
  const endEvents = session.events.filter((event) => event.type === "end");
  if (
    session.endedAt === null
      ? endEvents.length !== 0
      : endEvents.length !== 1 || session.events.at(-1).type !== "end"
  )
    return false;
  return session.events.every(
    (event, index) => index === 0 || event.at >= session.events[index - 1].at,
  );
}

/** Returns false for malformed/untrusted JSON, without modifying it. */
export function validateState(value) {
  try {
    if (
      !object(value) ||
      value.version !== 1 ||
      !validDraft(value.draft) ||
      !Array.isArray(value.sessions)
    )
      return false;
    const ids = new Set();
    let activeCount = 0;
    for (const session of value.sessions) {
      if (!validSession(session) || ids.has(session.id)) return false;
      ids.add(session.id);
      if (session.endedAt === null) activeCount += 1;
    }
    return activeCount <= 1;
  } catch {
    return false;
  }
}

function assertState(state) {
  if (!validateState(state)) throw new TypeError("Invalid fishing state");
}
function assertTime(now, session) {
  if (!finite(now)) throw new TypeError("Timestamp must be finite");
  if (session && now < session.events.at(-1).at)
    throw new RangeError("Timestamp precedes the last event");
}
function requireActive(state) {
  assertState(state);
  const session = active(state);
  if (!session) throw new Error("No active session");
  return session;
}
function requireRod(session, index) {
  if (!validIndex(index, session.rods.length))
    throw new RangeError("Invalid rod index");
  return session.rods[index];
}
function replaceSession(state, session, changes, event) {
  const next = {
    ...session,
    ...changes,
    events: event ? [...session.events, event] : session.events,
  };
  return {
    ...state,
    sessions: state.sessions.map((item) => (item === session ? next : item)),
  };
}
function replaceRod(state, session, index, rod, event) {
  return replaceSession(
    state,
    session,
    {
      rods: session.rods.map((item, rodIndex) =>
        rodIndex === index ? rod : item,
      ),
    },
    event,
  );
}

export function active(state) {
  return state.sessions.find((session) => session.endedAt === null) ?? null;
}

export function updateDraft(state, draft) {
  assertState(state);
  if (!validDraft(draft)) throw new TypeError("Invalid draft");
  return { ...state, draft: copyDraft(draft) };
}

export function start(state, now, id) {
  assertState(state);
  if (active(state)) return state;
  assertTime(now);
  if (!filled(id) || state.sessions.some((session) => session.id === id))
    throw new TypeError("Session ID must be nonempty and unique");
  if (!filled(state.draft.spot)) throw new TypeError("请填写钓点");
  for (const [index, rod] of state.draft.rods.entries()) {
    if (!filled(rod.bait))
      throw new TypeError(`请填写第 ${index + 1} 竿的饵料`);
    if (!filled(rod.rig)) throw new TypeError(`请选择第 ${index + 1} 竿的钓组`);
    if (!interval(rod.interval))
      throw new TypeError(`请选择第 ${index + 1} 竿的换饵间隔`);
  }
  if (
    !state.draft.rods.every((rod) =>
      finite(now + Number(rod.interval) * 3_600_000),
    )
  )
    throw new RangeError("Due time is outside the supported range");
  const session = {
    id,
    startedAt: now,
    endedAt: null,
    plan: copyDraft(state.draft),
    rods: state.draft.rods.map((rod) => ({
      ...copyRod(rod),
      lastBaitAt: now,
      remindedDueAt: null,
    })),
    events: [{ type: "start", at: now }],
  };
  return { ...state, sessions: [...state.sessions, session] };
}

export function dueAt(rod) {
  if (!object(rod) || !interval(rod.interval) || !finite(rod.lastBaitAt))
    return null;
  const due = rod.lastBaitAt + Number(rod.interval) * 3_600_000;
  return finite(due) ? due : null;
}

export function rebait(state, index, now) {
  const session = requireActive(state);
  const rod = requireRod(session, index);
  assertTime(now, session);
  if (dueAt({ ...rod, lastBaitAt: now }) === null)
    throw new RangeError("Due time is outside the supported range");
  return replaceRod(
    state,
    session,
    index,
    { ...rod, lastBaitAt: now, remindedDueAt: null },
    { type: "rebait", at: now, rodIndex: index },
  );
}

export function adjust(state, index, nextInterval, now) {
  const session = requireActive(state);
  const rod = requireRod(session, index);
  assertTime(now, session);
  if (!interval(nextInterval)) throw new TypeError("Invalid interval");
  if (rod.interval === nextInterval) return state;
  if (dueAt({ ...rod, interval: nextInterval }) === null)
    throw new RangeError("Due time is outside the supported range");
  return replaceRod(
    state,
    session,
    index,
    { ...rod, interval: nextInterval, remindedDueAt: null },
    {
      type: "adjust",
      at: now,
      rodIndex: index,
      oldInterval: rod.interval,
      newInterval: nextInterval,
    },
  );
}

export function recordCatch(state, index, fish, count, now) {
  const session = requireActive(state);
  requireRod(session, index);
  assertTime(now, session);
  if (!filled(fish) || !Number.isSafeInteger(count) || count <= 0)
    throw new TypeError("Catch needs a fish name and positive integer count");
  return replaceSession(
    state,
    session,
    {},
    { type: "catch", at: now, rodIndex: index, fish, count },
  );
}

export function observe(state, flow, water, now) {
  const session = requireActive(state);
  assertTime(now, session);
  if (
    !FLOWS.includes(flow) ||
    !(water === null || finite(water) || waterValue(water))
  )
    throw new TypeError("Invalid observation");
  return replaceSession(
    state,
    session,
    {},
    {
      type: "observe",
      at: now,
      flow,
      water: water === null || finite(water) ? water : waterNumber(water),
    },
  );
}

export function end(state, now) {
  assertState(state);
  const session = active(state);
  if (!session) return state;
  assertTime(now, session);
  return replaceSession(
    state,
    session,
    { endedAt: now },
    { type: "end", at: now },
  );
}

/** Ignore stale/duplicate reminder deliveries; interval changes and rebaiting reset the marker. */
export function markReminded(state, index, expectedDueAt) {
  assertState(state);
  const session = active(state);
  if (!session) return state;
  const rod = requireRod(session, index);
  if (!finite(expectedDueAt))
    throw new TypeError("Due timestamp must be finite");
  if (expectedDueAt !== dueAt(rod) || rod.remindedDueAt === expectedDueAt)
    return state;
  return replaceRod(state, session, index, {
    ...rod,
    remindedDueAt: expectedDueAt,
  });
}

export function summarize(sessions) {
  if (!denseArray(sessions) || !sessions.every(validSession))
    throw new TypeError("Invalid sessions");
  return sessions.reduce(
    (total, session) => {
      if (session.endedAt === null) return total;
      total.count += 1;
      total.durationMs += session.endedAt - session.startedAt;
      for (const event of session.events)
        if (event.type === "catch") total.catches += event.count;
      return total;
    },
    { count: 0, catches: 0, durationMs: 0 },
  );
}
