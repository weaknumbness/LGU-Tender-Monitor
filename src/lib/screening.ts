import type { Profile, Tender } from "./procurement";
export type ScreeningStatus = "matched" | "review" | "none";
export const screeningNames = {
  matched: "Есть совпадения",
  review: "Нужно проверить",
  none: "Совпадений нет",
};
const normalize = (s: string) => s.toLowerCase().replace(/ё/g, "е");
const tokens = (s: string) => normalize(s).match(/[а-яa-z0-9]+/g) ?? [];
// Conservative inflection normalization. No substring matching inside unrelated words.
function stem(s: string) {
  const irregular: Record<string, string> = {
    рынок: "рынк",
    рынки: "рынк",
    рынков: "рынк",
    рынкам: "рынк",
    рынками: "рынк",
    рынках: "рынк",
    дети: "дет",
    детей: "дет",
    детям: "дет",
    детьми: "дет",
    детях: "дет",
  };
  if (irregular[s]) return irregular[s];
  if (!/^[а-я]+$/.test(s) || s.length < 5) return s;
  const endings =
    /(иями|ями|ами|иях|ах|ого|его|ому|ему|ыми|ими|ий|ый|ой|ая|яя|ое|ее|ые|ие|ую|юю|ым|им|ом|ем|ов|ев|ей|ия|ию|ии|ий|ие|я|а|ы|и|у|ю|е|о)$/;
  const out = s.replace(endings, "").replace(/ь$/, "");
  return out.length >= 3 ? out : s;
}
function equal(a: string, b: string) {
  return a === b || stem(a) === stem(b) || (b.length >= 5 && a.startsWith(b));
}
function phrase(source: string[], key: string) {
  const words = tokens(key);
  return (
    words.length > 0 &&
    source.some((_, i) =>
      words.every(
        (w, j) => source[i + j] !== undefined && equal(source[i + j], w),
      ),
    )
  );
}
const supply =
  /(?:^|\s)(?:поставк[а-я]*|закупк[а-я]*|приобретени[а-я]*)\s+(?!услуг|работ)/;
const services =
  /обучени|повышени[а-я]*\s+квалификац|переподготов|исследовани|разработк|консультирован|экспертиз|перевод[а-я]*\s+(?:текст|материал|документ)|сопровождени/;
const generalEducation =
  /обучени|повышени[а-я]*\s+квалификац|переподготов|образовательн[а-я]*\s+услуг/;
const serviceLead =
  /^(?:(?:оказание|выполнение)\s+(?:услуг|работ)\s+(?:по\s+)?)?(?:обучени|повышени|переподготов|исследовани|разработк|перевод|консультирован|экспертиз)/;
export function screen(
  t: Pick<Tender, "title" | "text">,
  ps: Profile[],
  blacklist: string[] = [],
) {
  const titleWords = tokens(t.title);
  const blocked = blacklist.find((term) => {
    const words = tokens(term);
    return (
      words.length > 0 &&
      titleWords.some((_, i) => words.every((w, j) => titleWords[i + j] === w))
    );
  });
  if (blocked)
    return {
      status: "none" as const,
      reason: "Не подходит: в названии найдено исключение «" + blocked + "».",
      matches: [],
      candidates: [],
      score: 0,
      blocked: true,
    };
  // RSS metadata describes the customer, not the subject of the contract.
  const clean = t.text
    .split(/\n/)
    .filter(
      (line) =>
        !/^\s*(?:наименование заказчика|заказчик|организация|параметры поиска|искомое слово)\s*:/i.test(
          line,
        ),
    )
    .join("\n");
  const title = normalize(t.title),
    body = normalize(clean),
    tt = tokens(title),
    bt = tokens(body);
  const candidates = ps
    .map((profile) => {
      const keys = [
        ...new Set(
          profile.keywords
            .split(";")
            .map((k) => k.trim())
            .filter((k) => k.length > 1),
        ),
      ];
      const titleHits = keys.filter((k) => phrase(tt, k));
      const hits = keys.filter((k) => titleHits.includes(k) || phrase(bt, k));
      const score = titleHits.length * 3 + (hits.length - titleHits.length);
      return { profile, hits, titleHits, score };
    })
    .filter((m) => m.hits.length)
    .sort((a, b) => b.score - a.score);
  const product = supply.test(title) && !serviceLead.test(title);
  // A separate service in a mixed contract requires review; mere product purpose does not.
  const mixed =
    product &&
    /(?:оказани[а-я]*\s+услуг|проведени[а-я]*\s+обучени|разработк[а-я]*\s+(?:программ|методик)|исследовательск[а-я]*\s+работ)/.test(
      title + " " + body,
    );
  let status: ScreeningStatus = "none",
    reason = "В названии и описании не найдены ключевые слова подразделений.";
  if (product) {
    status = mixed ? "review" : "none";
    reason = mixed
      ? "Смешанная закупка: поставка товара и услуги. Проверьте, можно ли выполнить весь объём."
      : "Предмет закупки — поставка или приобретение товара. Тематические слова сами по себе не подтверждают соответствие компетенциям.";
  } else if (candidates.length) {
    status = candidates.some((m) => m.titleHits.length || m.hits.length >= 2)
      ? "matched"
      : "review";
    reason =
      status === "matched"
        ? "Найдены тематические фразы из профилей подразделений."
        : "Найдено только отдельное совпадение в описании; предмет закупки нужно уточнить.";
    const generic = candidates.every((m) =>
      m.hits.every((h) =>
        [
          "перевод",
          "нормативных",
          "онлайн-курс",
          "реабилитац",
          "профессиональное образование",
        ].includes(normalize(h)),
      ),
    );
    if (generic) {
      status = "review";
      reason =
        "Совпали широкие или неоднозначные слова. Уточните направление работ.";
    }
    if (
      candidates.every((m) => m.profile.id === "garden") &&
      !/исследован|анализ|рекомендац|апробац/.test(title + " " + body)
    ) {
      status = "review";
      reason =
        "Совпала тематика растений или озеленения, но исследовательский характер работ не подтверждён.";
    }
  } else if (
    generalEducation.test(title + " " + body) ||
    services.test(title) ||
    !body.trim()
  ) {
    status = "review";
    reason = generalEducation.test(title + " " + body)
      ? "Есть обучение или образовательные услуги, но направление не удалось связать с профилями."
      : "Недостаточно тематических данных для уверенного отбора.";
  }
  return {
    status,
    reason,
    matches: product && !mixed ? [] : candidates,
    candidates,
    score: candidates.reduce((sum, m) => sum + m.score, 0),
  };
}
