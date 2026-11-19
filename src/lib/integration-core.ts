import type { Tender } from "./procurement";
export function eisUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    !["zakupki.gov.ru", "www.zakupki.gov.ru"].includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    !(u.pathname.startsWith("/epz/") || u.pathname.startsWith("/223/purchase/"))
  )
    throw Error("Нужна HTTPS-ссылка ЕИС из раздела закупок.");
  u.hash = "";
  return u;
}
function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const x =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return x <= 0x10ffff ? String.fromCodePoint(x) : "";
    })
    .replace(/&amp;/g, "&");
}
function tag(s: string, n: string) {
  const raw =
    s.match(
      new RegExp("<" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + n + ">", "i"),
    )?.[1] ?? "";
  return decode(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}
export function plain(s: string) {
  return decode(
    s
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/?span\b[^>]*>/gi, "")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}
export function parseFeed(xml: string) {
  if (
    xml.length > 2000000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    !/<rss\b/i.test(xml) ||
    !/<\/rss\s*>/i.test(xml)
  )
    throw Error(
      "Источник вернул не поддерживаемый RSS 2.0. Возможно, это страница ошибки или защиты.",
    );
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
  ].map((m) => m[1]);
  if (blocks.length > 200)
    throw Error("Слишком много записей: сузьте RSS-поиск до 200 результатов.");
  let skipped = 0;
  const items = blocks.flatMap((block) => {
    try {
      const url = eisUrl(tag(block, "link"));
      const number =
        url.searchParams.get("regNumber") ||
        url.searchParams.get("noticeInfoId");
      if (!number || !/^\d{5,30}$/.test(number)) throw Error();
      const html = tag(block, "description");
      const body = html.includes("Найденный результат:")
        ? html.slice(
            html.indexOf("Найденный результат:") +
              "Найденный результат:".length,
          )
        : html;
      const field = (label: string) => {
        const start = body.indexOf(label);
        if (start < 0) return "";
        return plain(
          body.slice(start + label.length).split(/<br\s*\/?\s*>|<strong/iu)[0],
        );
      };
      const title =
        field("Наименование объекта закупки:") || plain(tag(block, "title"));
      const buyer =
        field("Наименование Заказчика:") || plain(tag(block, "author"));
      const rawPrice = field("Начальная цена контракта:")
        .replace(/\s/g, "")
        .replace(",", ".");
      const price =
        rawPrice && Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : null;
      if (!title) throw Error();
      return [
        {
          externalId:
            (url.searchParams.has("regNumber") ? "reg:" : "notice:") + number,
          title: title.slice(0, 1500),
          text: plain(body).slice(0, 60000),
          buyer,
          price,
          url: url.toString(),
          publishedAt: tag(block, "pubDate"),
        },
      ];
    } catch {
      skipped++;
      return [];
    }
  });
  if (blocks.length && !items.length)
    throw Error(
      "RSS получен, но ссылки на извещения не распознаны. Нужна проверка формата ЕИС.",
    );
  return { items, skipped };
}
export function mergeImported(
  old: Tender | null | undefined,
  next: Tender,
): Tender {
  return {
    ...next,
    id: old?.id ?? next.id,
    status: old?.status ?? "new",
    note: old?.note ?? "",
    buyer: old?.buyer || next.buyer,
    price: old?.price ?? next.price,
    deadline: old?.deadline || next.deadline,
  };
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw Error("Недопустимый источник запроса");
}
export async function fingerprint(value: unknown) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
