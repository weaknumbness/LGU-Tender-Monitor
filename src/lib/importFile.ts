import { parseFeed, mergeImported, fingerprint } from "./integration-core";
import { parseResultsHtml } from "./importHtml";
import type { Tender } from "./procurement";

export async function importFile(file: File, previous: Tender[]) {
  if (file.size > 16_000_000) throw Error("Размер файла превышает 16 МБ.");
  const bytes = await file.arrayBuffer();
  const head = new TextDecoder().decode(bytes.slice(0, 4096));
  const encoding = head.match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1]
    ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  const content = new TextDecoder(encoding).decode(bytes);
  // EIS can save an RSS feed with an .html extension.
  const rss = /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<rss\b/i.test(content);
  if (rss && new DOMParser().parseFromString(content, "application/xml").querySelector("parsererror"))
    throw Error("Файл XML повреждён. Скачайте RSS ещё раз.");
  const parsed = rss ? parseFeed(content) : parseResultsHtml(content);
  const records = new Map(previous.map((t) => [t.id, t]));
  let added = 0;
  for (const item of parsed.items) {
    const id = "eis-" + (await fingerprint(item.externalId));
    if (!records.has(id)) added++;
    // A search card has less detail than RSS. Keep any richer existing description.
    const old = records.get(id);
    if (!rss && old) item.text = old.text || item.text;
    records.set(
      id,
      mergeImported(records.get(id), {
        id,
        title: item.title,
        text: item.text,
        buyer: item.buyer,
        price: item.price,
        url: item.url,
        deadline: "deadline" in item ? String(item.deadline) : "",
        status: "new",
        note: "",
        demo: false,
        source: "eis-file",
        importedAt: new Date().toISOString(),
      }),
    );
  }
  return {
    tenders: [...records.values()],
    added,
    skipped: parsed.skipped,
    total: parsed.items.length,
  };
}
