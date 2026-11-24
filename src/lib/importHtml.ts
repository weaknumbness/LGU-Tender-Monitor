import { eisUrl } from "./integration-core";

// A detached template keeps scripts and external resources inactive.
export function parseResultsHtml(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const cards = Array.from(template.content.querySelectorAll(".search-registry-entry-block"));
  if (!cards.length) throw Error("Карточки закупок не найдены. Сохраните страницу результатов поиска ЕИС после загрузки списка.");
  const clean = (node?: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
  let skipped = 0;
  const items = cards.flatMap(card => {
    try {
      const href = card.querySelector(".registry-entry__header-mid__number a")?.getAttribute("href");
      if (!href) throw Error();
      const url = eisUrl(new URL(href, "https://zakupki.gov.ru").href);
      const key = url.searchParams.has("regNumber") ? "regNumber" : "noticeInfoId";
      const number = url.searchParams.get(key) ?? "";
      const field = (selector: string, pattern: RegExp) => clean(Array.from(card.querySelectorAll(selector)).find(el => pattern.test(clean(el)))?.nextElementSibling);
      const title = field(".registry-entry__body-title", /объект закупки|наименование закупки|предмет договора/i);
      if (!/^\d{5,30}$/.test(number) || !title) throw Error();
      const price = clean(card.querySelector(".price-block__value")).replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)(?:₽|руб\.?|RUB)?$/i);
      const date = field(".data-block__title", /окончани.*подачи/i).match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const buyer = field(".registry-entry__body-title", /заказчик/i);
      const organizer = field(".registry-entry__body-title", /организация.*размещение/i);
      return [{ externalId: (key === "regNumber" ? "reg:" : "notice:") + number,
        title, text: organizer ? title + "\nОрганизация, осуществляющая размещение: " + organizer : title,
        buyer, price: price ? Number(price[1].replace(",", ".")) : null, url: url.href,
        deadline: date ? [date[3], date[2], date[1]].join("-") : "" }];
    } catch { skipped++; return []; }
  });
  if (!items.length) throw Error("В карточках не удалось распознать названия и номера извещений.");
  return { items, skipped };
}
