import { createState, validateState } from "./core.mjs";
const database = new Promise((resolve, reject) => {
  const request = indexedDB.open("ganbian-local-v1", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("records");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error("请关闭其他竿边页面后重新打开。"));
});
let revision = 0;
export async function load() {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readonly");
    const request = tx.objectStore("records").get("state");
    let result;
    request.onsuccess = () => {
      const record = request.result;
      if (
        record &&
        (!Number.isSafeInteger(record.revision) ||
          record.revision < 1 ||
          !validateState(record.state))
      ) {
        reject(
          new Error(
            "本机数据格式无法读取。原记录未覆盖，请保留浏览器数据并寻求恢复。",
          ),
        );
        return;
      }
      revision = record?.revision || 0;
      result = record?.state || createState();
    };
    tx.oncomplete = () => {
      if (result) resolve(result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("读取中断"));
  });
}
export async function save(state) {
  if (!validateState(state)) throw new Error("记录校验失败，未保存。");
  const db = await database;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    const store = tx.objectStore("records");
    let conflict = false;
    const request = store.get("state");
    request.onsuccess = () => {
      if (
        (request.result &&
          (!Number.isSafeInteger(request.result.revision) ||
            request.result.revision < 1 ||
            !validateState(request.result.state))) ||
        (request.result?.revision || 0) !== revision
      ) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put({ revision: revision + 1, state }, "state");
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        conflict
          ? new Error(
              "另一页面已修改记录。本页输入仍保留；请先导出或复制输入，再重新载入核对，避免覆盖。",
            )
          : tx.error || new Error("保存中断"),
      );
  });
  revision++;
}
