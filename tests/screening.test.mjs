import test from "node:test";
import assert from "node:assert/strict";
import { screen } from "../src/lib/screening.ts";
const profile = (id, keywords) => ({
  id,
  keywords,
  name: id,
  short: id,
  competencies: "",
  restrictions: "",
  source: "",
});
const ps = [
  profile("lang", "английский язык; перевод"),
  profile("eco", "финансовая грамотность; рынок труда"),
  profile("special", "ОВЗ; специальное образование"),
  profile("garden", "озеленен; субстрат"),
];
const check = (title, text = "", profiles = ps) =>
  screen({ title, text }, profiles);
test("Russian inflections match multiword phrases", () => {
  const r = check("Обучение финансовой грамотности", "Курс для работников");
  assert.equal(r.status, "matched");
  assert.equal(r.matches[0].profile.id, "eco");
  assert.equal(
    check(
      "Повышение квалификации по специальному образованию",
      "Учебная программа",
    ).status,
    "matched",
  );
});
test("Goods for educational use do not qualify merely by subject words", () => {
  const r = check(
    "Поставка мебели для обучения детей с ОВЗ",
    "Мебель для кабинета специального образования",
  );
  assert.equal(r.status, "none");
  assert.equal(r.matches.length, 0);
  assert.ok(r.candidates.length);
});
test("Mixed goods and services are reviewed", () => {
  assert.equal(
    check(
      "Поставка оборудования и оказание услуг по обучению английскому языку",
      "Учебный комплект",
    ).status,
    "review",
  );
});
test("Unspecified training is retained for review", () =>
  assert.equal(
    check("Повышение квалификации сотрудников", "Тема не указана").status,
    "review",
  ));
test("Unrelated words and customer metadata do not create faculty matches", () => {
  assert.equal(
    check("Услуги курьерской доставки", "Скорость доставки", [
      profile("special", "ОВЗ"),
    ]).status,
    "none",
  );
  assert.equal(
    check(
      "Уборка помещений",
      "Заказчик: Центр финансовой грамотности\nУборка полов",
    ).matches.length,
    0,
  );
});
test("Ambiguous translation and landscaping require review", () => {
  assert.equal(
    check("Перевод денежных средств", "Банковские операции").status,
    "review",
  );
  assert.equal(
    check("Работы по озеленению", "Посадка деревьев").status,
    "review",
  );
  assert.equal(
    check("Разработка рекомендаций по озеленению", "Исследование субстратов")
      .status,
    "matched",
  );
});
test("Profile updates immediately affect classification", () => {
  const t = { title: "Исследование рынка труда", text: "Региональный анализ" };
  assert.equal(screen(t, ps).status, "matched");
  assert.equal(screen(t, [profile("eco", "бизнес-план")]).status, "review");
});

test('Исключение в названии имеет приоритет даже над новым профилем', () => {
  const custom = [profile('custom', 'логотип')];
  const t = {title:'Логотип: РЕМОНТ здания', text:'разработка'};
  assert.equal(screen(t, custom).status, 'matched');
  const excluded = screen(t, custom, ['ремонт']);
  assert.equal(excluded.status, 'none');
  assert.equal(excluded.blocked, true);
  assert.equal(excluded.matches.length, 0);
  assert.match(excluded.reason, /ремонт/);
  assert.equal(screen(t, custom, []).status, 'matched');
});

test('Чёрный список: целая фраза, регистр, ё, только название', () => {
  const custom = [profile('custom', 'логотип')];
  const classify = title => screen({title:'Логотип: '+title, text:'образец колёс'}, custom, ['образец колёс']);
  assert.equal(classify('ОБРАЗЕЦ-КОЛЕС').status, 'none');
  for(const title of ['образец новых колес','образец колесниц','эскиз'])
    assert.equal(classify(title).status, 'matched');
});
