import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFeed,
  eisUrl,
  mergeImported,
  fingerprint,
} from "../src/lib/integration-core.ts";
const rss =
  '<rss version="2.0"><channel><item><title><![CDATA[Исследование &amp; анализ]]></title><link>https://zakupki.gov.ru/epz/order/notice/ea20/view/common-info.html?regNumber=0123456789012345678&amp;foo=1</link><description><![CDATA[<p>Рынок труда</p><script>bad()</script>]]></description></item></channel></rss>';
test("RSS: extract CDATA, entities and stable source identity", () => {
  const r = parseFeed(rss);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].title, "Исследование & анализ");
  assert.equal(r.items[0].text, "Рынок труда");
  assert.equal(r.items[0].externalId, "reg:0123456789012345678");
});
test("HTML errors and entity declarations never appear as successful empty feeds", () => {
  for (const x of [
    "<html>502</html>",
    "<!DOCTYPE rss><rss></rss>",
    "<rss><channel>",
  ])
    assert.throws(() => parseFeed(x));
  assert.equal(parseFeed("<rss><channel></channel></rss>").items.length, 0);
});
test("Reject external, credentialed and unsafe feed links", () => {
  for (const x of [
    "http://zakupki.gov.ru/epz/a",
    "https://zakupki.gov.ru.evil.com/epz/a",
    "https://user:secret@zakupki.gov.ru/epz/a",
    "https://127.0.0.1/epz/a",
    "https://zakupki.gov.ru:8080/epz/a",
  ])
    assert.throws(() => eisUrl(x));
});
test("Unrecognized notices do not silently import or mark feed healthy", () => {
  assert.throws(() => parseFeed(rss.replace("regNumber", "unknown")));
});
test("Updating a notice preserves user workflow and supplied metadata", () => {
  const old = {
    id: "saved",
    status: "work",
    note: "Комментарий",
    price: 200,
    buyer: "Заказчик",
    deadline: "2026-10-01",
  };
  const next = {
    id: "new",
    status: "new",
    note: "",
    title: "Обновление",
    price: null,
    buyer: "",
    deadline: "",
  };
  const r = mergeImported(old, next);
  assert.equal(r.id, "saved");
  assert.equal(r.note, "Комментарий");
  assert.equal(r.status, "work");
  assert.equal(r.title, "Обновление");
  assert.equal(r.price, 200);
});
test("Analysis cache changes when text or profiles change", async () => {
  assert.notEqual(
    await fingerprint({ text: "a" }),
    await fingerprint({ text: "b" }),
  );
  assert.equal(await fingerprint("reg:123"), await fingerprint("reg:123"));
});
test("EIS 223-FZ descriptions: use object title, rejoin highlights, remove search metadata", () => {
  const xml =
    "<rss><channel><item><title>Иной способ №12345678</title><link>https://zakupki.gov.ru/223/purchase/public/purchase/info/common-info.html?regNumber=12345678</link><description>&lt;b&gt;Параметры поиска:&lt;/b&gt; ложный термин&lt;br/&gt;&lt;strong&gt;Найденный результат:&lt;/strong&gt;&lt;br/&gt;&lt;strong&gt;Наименование объекта закупки: &lt;/strong&gt;Обучение и &lt;span&gt;повышен&lt;/span&gt;ие квалификации&lt;br/&gt;&lt;strong&gt;Наименование Заказчика: &lt;/strong&gt;Университет&lt;br/&gt;&lt;strong&gt;Начальная цена контракта: &lt;/strong&gt;190000.00&lt;strong&gt; Валюта: &lt;/strong&gt;Российский рубль</description></item></channel></rss>";
  const r = parseFeed(xml);
  assert.equal(r.skipped, 0);
  assert.equal(r.items[0].title, "Обучение и повышение квалификации");
  assert.equal(r.items[0].price, 190000);
  assert.equal(r.items[0].buyer, "Университет");
  assert.ok(!r.items[0].text.includes("ложный термин"));
});
