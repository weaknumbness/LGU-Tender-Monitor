import { profiles, type Profile, type Tender } from "./procurement";
export interface Workspace {
  blacklist: string[];
  tenders: Tender[];
  profiles: Profile[];
}
const key =
  location.pathname.replace(/index\.html$/, "").replace(/\/$/, "") || "/";
const connection = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("lgu-monitor:" + key, 1);
  request.onupgradeneeded = () => request.result.createObjectStore("workspace");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function load(): Promise<Workspace> {
  const db = await connection;
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("workspace")
      .objectStore("workspace")
      .get("current");
    request.onsuccess = () =>
      resolve({ blacklist: [], tenders: [], profiles, ...request.result });
    request.onerror = () => reject(request.error);
  });
}
export async function save(state: Workspace): Promise<void> {
  const db = await connection;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(state, "current");
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}
