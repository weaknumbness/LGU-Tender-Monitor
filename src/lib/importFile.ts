import { parseFeed, mergeImported, fingerprint } from "./integration-core";
import type { Tender } from "./procurement";

export async function importFile(file: File, previous: Tender[]) {
  if (file.size > 2_000_000) throw Error("Размер файла превышает 2 МБ.");
  const bytes = await file.arrayBuffer();
  const encoding =
    new TextDecoder()
      .decode(bytes.slice(0, 220))
      .match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1] ?? "utf-8";
  const xml = new TextDecoder(encoding).decode(bytes);
  const parsed = parseFeed(xml);
  if (
    new DOMParser()
      .parseFromString(xml, "application/xml")
      .querySelector("parsererror")
  )
    throw Error("Файл XML повреждён. Скачайте RSS ещё раз.");
  const records = new Map(previous.map((t) => [t.id, t]));
  let added = 0;
  for (const item of parsed.items) {
    const id = "eis-" + (await fingerprint(item.externalId));
    if (!records.has(id)) added++;
    records.set(
      id,
      mergeImported(records.get(id), {
        id,
        title: item.title,
        text: item.text,
        buyer: item.buyer,
        price: item.price,
        url: item.url,
        deadline: "",
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
