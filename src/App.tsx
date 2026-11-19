import { useEffect, useState, useMemo } from "react";
import { load as readWorkspace, save as persist } from "./lib/storage";
import { importFile } from "./lib/importFile";
import "./css/App.css";
import {
  Search,
  Plus,
  ArrowUpRight,
  SlidersHorizontal,
  BookOpen,
  FlaskConical,
  ScanText,
  Check,
  Building2,
  FileText,
  Loader2,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from "./components/Controls";
import { Toaster, toast } from "sonner";
import {
  profiles as defaults,
  demos,
  screen,
  screeningNames,
  statusNames,
  Profile,
  Tender,
} from "./lib/procurement";
const money = (x: number | null) =>
  x === null ? "Цена не указана" : (
    new Intl.NumberFormat("ru-RU").format(x) + " ₽"
  );
function Pick({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: [string, string][];
  label: string;
}) {
  return (
    <select
      className="filter-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {items.map(([v, n]) => (
        <option key={v} value={v}>
          {n}
        </option>
      ))}
    </select>
  );
}
export default function Home() {
  const [ps, setPs] = useState(defaults),
    [records, setRecords] = useState<Tender[]>([]),
    [demo, setDemo] = useState(true),
    [view, setView] = useState("feed"),
    [q, setQ] = useState(""),
    [faculty, setFaculty] = useState("all"),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("match"),
    [screening, setScreening] = useState("matched"),
    [selected, setSelected] = useState<Tender | null>(null),
    [edit, setEdit] = useState<Profile | null>(null),
    [add, setAdd] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    text: "",
    buyer: "",
    price: "",
    deadline: "",
    url: "",
  });
  const [blacklist, setBlacklist] = useState<string[]>([]),
    [draft, setDraft] = useState("");
  async function load() {
    try {
      const data = await readWorkspace();
      setPs(data.profiles);
      setRecords(data.tenders);
      setBlacklist(data.blacklist);
      setDraft(data.blacklist.join("\n"));
      setReady(true);
      setError("");
      if (data.tenders.length) setDemo(false);
    } catch {
      setError("Не удалось открыть данные браузера.");
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function commit(next: {
    profiles: Profile[];
    tenders: Tender[];
    blacklist: string[];
  }) {
    await persist(next);
    setPs(next.profiles);
    setRecords(next.tenders);
    setBlacklist(next.blacklist);
  }
  async function save(kind: string, value: Profile | Tender) {
    if (busy || !ready) return false;
    setBusy(true);
    try {
      let profiles = ps,
        tenders = records;
      if (kind === "profile") {
        const p = value as Profile;
        p.name = p.name.trim();
        p.short = p.short.trim() || p.name;
        p.keywords = p.keywords
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .join("; ");
        if (!p.name || !p.keywords)
          throw Error("Введите название и ключевые слова.");
        if (
          ps.some(
            (x) =>
              x.id !== p.id && x.name.toLowerCase() === p.name.toLowerCase(),
          )
        )
          throw Error("Профиль с таким названием уже существует.");
        profiles =
          ps.some((x) => x.id === p.id) ?
            ps.map((x) => (x.id === p.id ? p : x))
          : [...ps, p];
      } else {
        const t = value as Tender;
        if (t.url && !/^https?:\/\//i.test(t.url))
          throw Error("Введите ссылку http или https.");
        tenders = [t, ...records.filter((x) => x.id !== t.id)];
      }
      await commit({ profiles, tenders, blacklist });
      toast.success("Сохранено");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveList() {
    setBusy(true);
    try {
      const terms = [
        ...new Set(
          draft
            .split(/[;\n]/)
            .map((s) => s.trim().toLowerCase().replace(/ё/g, "е"))
            .filter(Boolean),
        ),
      ];
      await commit({ profiles: ps, tenders: records, blacklist: terms });
      setDraft(terms.join("\n"));
      toast.success("Чёрный список сохранён. Отбор пересчитан.");
    } catch {
      toast.error("Не удалось сохранить список.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setBusy(true);
    try {
      const r = await importFile(file, records);
      await commit({ profiles: ps, tenders: r.tenders, blacklist });
      setDemo(false);
      setScreening("matched");
      setFaculty("all");
      setStatus("all");
      setQ("");
      setView("feed");
      toast.success("Прочитано: " + r.total + ". Новых: " + r.added + ".");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Не удалось импортировать RSS.",
      );
    } finally {
      setBusy(false);
    }
  }
  const all = demo ? demos : records;
  const screened = useMemo(
    () => all.map((t) => ({ t, s: screen(t, ps, blacklist) })),
    [all, ps, blacklist],
  );
  const counts = {
    matched: screened.filter((x) => x.s.status === "matched").length,
    review: screened.filter((x) => x.s.status === "review").length,
    none: screened.filter((x) => x.s.status === "none").length,
  };
  const selectedScreen = selected ? screen(selected, ps, blacklist) : null;
  const results = screened
    .filter(
      ({ t, s }) =>
        (screening === "all" || s.status === screening) &&
        (!q ||
          (t.title + " " + t.text + " " + t.buyer)
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (faculty === "all" ||
          s.matches.some((x) => x.profile.id === faculty)) &&
        (status === "all" || t.status === status),
    )
    .sort((a, b) =>
      sort === "price" ? (b.t.price ?? 0) - (a.t.price ?? 0)
      : sort === "date" ?
        (a.t.deadline || "9999").localeCompare(b.t.deadline || "9999")
      : { matched: 2, review: 1, none: 0 }[b.s.status] -
          { matched: 2, review: 1, none: 0 }[a.s.status] ||
        b.s.score - a.s.score,
    );

  async function changeStatus(s: string) {
    if (!selected) return;
    if (selected.demo) {
      toast.info(
        "Для работы с реальными закупками добавьте текст через «Проверить закупку».",
      );
      return;
    }
    const value = { ...selected, status: s };
    if (await save("tender", value)) setSelected(value);
  }
  return (
    <div className="app">
      <Toaster position="bottom-right" />
      <header className="topbar">
        <a className="brand" href="./">
          <span>
            Монитор закупок<small>ЛГУ имени А. С. Пушкина</small>
          </span>
        </a>
        <span className="private-label">Рабочее пространство университета</span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">НАУКА И СОТРУДНИЧЕСТВО</div>
            <h1>
              {view === "profiles" ?
                "Компетенции университета"
              : "Подборка закупок"}
            </h1>
            <p>
              {view === "profiles" ?
                "Направления поиска из материалов подразделений"
              : "От находки до решения — в одном рабочем пространстве"}
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="secondary-action"
              onClick={() => {
                setView("source");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Импорт RSS-файла
            </button>
            <button className="primary" onClick={() => setAdd(true)}>
              <Plus size={18} /> Проверить закупку
            </button>
          </div>
        </div>
        <Tabs value={view} onValueChange={setView}>
          <TabsList variant="line" className="main-tabs">
            <TabsTrigger value="feed">
              <ScanText size={17} /> Закупки
            </TabsTrigger>
            <TabsTrigger value="profiles">
              <BookOpen size={17} /> Профили подразделений{" "}
              <span className="count">{ps.length}</span>
            </TabsTrigger>
            <TabsTrigger value="source">
              <SlidersHorizontal size={17} /> Источники и настройки
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {error && (
          <div className="notice error">
            {error} <button onClick={load}>Повторить</button>
          </div>
        )}
        {view === "feed" && (
          <>
            <div className="stats">
              <div>
                <span>В подборке{demo ? " · примеры" : ""}</span>
                <strong>{all.length.toString().padStart(2, "0")}</strong>
              </div>
              <div>
                <span>С совпадениями</span>
                <strong>{counts.matched.toString().padStart(2, "0")}</strong>
              </div>
              <div>
                <span>В работе</span>
                <strong>
                  {all
                    .filter((t) => t.status === "work")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </div>
              <div className="source-stat">
                <span>Источник</span>
                <strong className="source-status">RSS · файл</strong>
                <button onClick={() => setView("source")}>
                  Импорт файла <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            <div className="notice">
              <FlaskConical size={19} />
              <span>
                {demo ?
                  "Демонстрационная подборка. Названия, заказчики, цены и сроки вымышлены."
                : "Автоматический отбор работает при загрузке и изменении профилей. ИИ и API-ключи не нужны."
                }
              </span>
              <button
                onClick={() => {
                  setDemo(!demo);
                  setStatus("all");
                }}
              >
                {demo ? "Мои закупки" : "Показать примеры"}
              </button>
            </div>
            <Tabs value={screening} onValueChange={setScreening}>
              <TabsList variant="line" className="screening-tabs">
                <TabsTrigger value="matched">
                  Есть совпадения · {counts.matched}
                </TabsTrigger>
                <TabsTrigger value="review">
                  Нужно проверить · {counts.review}
                </TabsTrigger>
                <TabsTrigger value="none">
                  Совпадений нет · {counts.none}
                </TabsTrigger>
                <TabsTrigger value="all">Все · {all.length}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="filters">
              <label className="search">
                <Search size={19} />
                <input
                  placeholder="Название, заказчик или ключевое слово"
                  aria-label="Поиск закупок"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <Pick
                label="Подразделение"
                value={faculty}
                onChange={setFaculty}
                items={[
                  ["all", "Все подразделения"],
                  ...ps.map((p) => [p.id, p.short] as [string, string]),
                ]}
              />
              <Pick
                label="Статус"
                value={status}
                onChange={setStatus}
                items={[["all", "Все статусы"], ...Object.entries(statusNames)]}
              />
            </div>
            <div className="result-bar">
              <span>
                Найдено: <b>{results.length}</b>
              </span>
              <Pick
                label="Сортировка"
                value={sort}
                onChange={setSort}
                items={[
                  ["match", "По соответствию"],
                  ["date", "По сроку подачи"],
                  ["price", "По цене"],
                ]}
              />
            </div>
            <div className="feed">
              {results.map(({ t, s }, i) => (
                <article className="tender" key={t.id}>
                  <div className="tender-main">
                    <div className="tender-meta">
                      <span
                        className={
                          s.status === "matched" ? "badge green" : "badge"
                        }
                      >
                        {"blocked" in s ?
                          "Не подходит · чёрный список"
                        : screeningNames[s.status]}
                      </span>
                      <span>
                        {t.demo ?
                          "ДЕМО · " + String(i + 1).padStart(3, "0")
                        : statusNames[t.status]}
                      </span>
                    </div>
                    <button
                      className="tender-title"
                      onClick={() => setSelected(t)}
                    >
                      {t.title}
                    </button>
                    <div className="buyer">
                      <Building2 size={15} />
                      {t.buyer || "Заказчик не указан"}
                    </div>
                    <div className="tags">
                      {s.matches.slice(0, 3).map((x) => (
                        <span key={x.profile.id}>{x.profile.short}</span>
                      ))}
                    </div>
                    <div className="reason">
                      <ScanText size={16} />
                      <span>
                        {s.reason}
                        {s.matches.length ?
                          " Фразы: " +
                          [...new Set(s.matches.flatMap((x) => x.hits))]
                            .slice(0, 4)
                            .join(", ")
                        : ""}
                      </span>
                    </div>
                  </div>
                  <div className="tender-side">
                    <strong>{money(t.price)}</strong>
                    <span>
                      Подача до{" "}
                      {t.deadline ?
                        new Date(t.deadline + "T12:00:00").toLocaleDateString(
                          "ru-RU",
                        )
                      : "—"}
                    </span>
                    <button onClick={() => setSelected(t)}>
                      Рассмотреть <ArrowUpRight size={17} />
                    </button>
                  </div>
                </article>
              ))}
              {!results.length && (
                <div className="empty">
                  <FileText size={35} />
                  <h2>
                    {all.length ?
                      "Ничего не найдено"
                    : "Здесь будут ваши закупки"}
                  </h2>
                  <p>
                    {all.length ?
                      "Попробуйте изменить фильтры."
                    : "Вставьте название и описание закупки — приложение сопоставит их с профилями."
                    }
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      all.length ?
                        (setQ(""),
                        setFaculty("all"),
                        setStatus("all"),
                        setScreening("all"))
                      : setAdd(true)
                    }
                  >
                    {all.length ? "Сбросить фильтры" : "Проверить закупку"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {view === "profiles" && (
          <>
            <div className="notice">
              <BookOpen size={18} />
              <span>
                Основа — сканы «Ключевые слова для закупок», 21 страница. Фразы
                можно уточнять; часть материалов датирована 2024 годом.
              </span>
            </div>
            <p>
              <button
                className="primary"
                disabled={busy || !ready}
                onClick={() =>
                  setEdit({
                    id: crypto.randomUUID(),
                    name: "",
                    short: "",
                    keywords: "",
                    competencies: "",
                    restrictions: "",
                    source: "Пользовательский профиль",
                  })
                }
              >
                <Plus size={17} />
                Добавить профиль
              </button>
            </p>
            <div className="profile-grid">
              {ps.map((p, i) => (
                <article className="profile-card" key={p.id}>
                  <div className="profile-top">
                    <span className="profile-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <small>{p.source}</small>
                  </div>
                  <h2>{p.name}</h2>
                  <p>{p.competencies}</p>
                  <div className="tags">
                    {p.keywords
                      .split(";")
                      .slice(0, 3)
                      .map((k) => (
                        <span key={k}>{k}</span>
                      ))}
                    <span>
                      +{Math.max(0, p.keywords.split(";").length - 3)}
                    </span>
                  </div>
                  {p.restrictions && (
                    <p className="warning">{p.restrictions}</p>
                  )}
                  <button onClick={() => setEdit({ ...p })}>
                    Настроить профиль <ArrowUpRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {view === "source" && (
          <section className="integrations">
            <div className="import-box">
              <FileText className="import-icon" size={52} />
              <div className="import-copy">
                <h2>Импорт RSS-файла ЕИС</h2>
                <p>
                  Выберите сохранённый файл до 2 МБ. Заметки и статусы
                  сохраняются при повторном импорте.
                </p>
              </div>
              <label className="primary import-button">
                Выбрать файл
                <input
                  className="file-input"
                  type="file"
                  disabled={busy || !ready}
                  accept=".xml,.rss,.html,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(f);
                  }}
                />
              </label>
            </div>
            <div className="connection-box">
              <h2>Чёрный список</h2>
              <label htmlFor="excluded">
                Слова и фразы, исключающие закупку по названию
              </label>
              <p>
                По одному на строку или через точку с запятой. «Ремонт» исключит
                «Ремонт здания», но не «ремонтный комплект». Для других форм
                добавьте отдельные записи. Описание не проверяется.
              </p>
              <textarea
                id="excluded"
                rows={5}
                placeholder="ремонт; поставка мебели"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <p>
                <button
                  className="primary"
                  disabled={busy || !ready}
                  onClick={saveList}
                >
                  Сохранить чёрный список
                </button>
              </p>
              <small>
                Чтобы снять исключение, удалите запись и сохраните список.
                Изменения применяются ко всем закупкам.
              </small>
            </div>
          </section>
        )}
        <footer>
          <span>ЛГУ им. А. С. Пушкина · Монитор закупок</span>
          <span>Предварительный отбор · Решение принимает специалист</span>
        </footer>
      </main>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="detail-sheet">
          {selected && (
            <>
              <SheetTitle className="detail-title">{selected.title}</SheetTitle>
              <SheetDescription>
                {selected.demo ?
                  "Вымышленный пример. Не является извещением ЕИС."
                : selected.source === "eis-file" ?
                  "Импортировано из сохранённого RSS-файла. Актуальность и сроки проверьте в ЕИС."
                : selected.source === "eis-rss" ?
                  "Загружено из RSS ЕИС. Сверьте сведения и сроки с извещением."
                : "Добавлено вручную. Сверьте сведения с извещением."}
              </SheetDescription>
              <div className="detail-price">{money(selected.price)}</div>
              <p>{selected.text || "Описание не добавлено"}</p>
              <div className="marg-10-15">
                <h3>Автоматический отбор</h3>
                {selectedScreen && (
                  <>
                    <p
                      className={
                        selectedScreen.status === "matched" ?
                          "badge green"
                        : "badge"
                      }
                    >
                      {"blocked" in selectedScreen ?
                        "Не подходит · чёрный список"
                      : screeningNames[selectedScreen.status]}
                    </p>
                    <p>{selectedScreen.reason}</p>
                    {selectedScreen.matches.map((m) => (
                      <div className="match-block" key={m.profile.id}>
                        <b>{m.profile.name}</b>
                        <p>Фразы профиля: {m.hits.join(", ")}</p>
                        <p className="muted">
                          {m.titleHits.length ?
                            "В названии: " + m.titleHits.join(", ")
                          : "Совпадения найдены в описании."}
                        </p>
                        {m.profile.restrictions && (
                          <p className="warning">
                            Проверить вручную: {m.profile.restrictions}
                          </p>
                        )}
                      </div>
                    ))}
                    {!selectedScreen.matches.length &&
                      !("blocked" in selectedScreen) && (
                        <p>
                          Подразделение не определено. Это не окончательный
                          отказ: проверьте документацию и при необходимости
                          уточните профиль.
                        </p>
                      )}
                  </>
                )}
              </div>
              <p className="muted">
                Проанализированы только название и вставленный текст.
                Требования, вложения и возможность участия не проверены.
              </p>
              {selected.url && (
                <a target="_blank" rel="noreferrer" href={selected.url}>
                  Открыть исходное извещение <ArrowUpRight size={16} />
                </a>
              )}
              <div className="work-status">
                <label>
                  <b>Рабочий статус</b>
                </label>
                <Pick
                  label="Изменить статус"
                  value={selected.status}
                  onChange={changeStatus}
                  items={Object.entries(statusNames)}
                />
              </div>
              <label htmlFor="note">Комментарий / причина отклонения</label>
              <textarea
                id="note"
                value={selected.note}
                onChange={(e) =>
                  setSelected({ ...selected, note: e.target.value })
                }
              />
              <button
                disabled={busy || selected.demo || !ready}
                className="primary"
                onClick={() => save("tender", selected)}
              >
                Сохранить комментарий
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="form-dialog">
          <DialogTitle>
            {ps.some((x) => x.id === edit?.id) ?
              "Настроить профиль"
            : "Новый профиль"}
          </DialogTitle>
          <DialogDescription>
            Профиль сохраняется для следующих проверок закупок.
          </DialogDescription>
          {edit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await save("profile", edit)) setEdit(null);
              }}
            >
              <label>
                Название профиля
                <input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <label>
                Короткое название для карточек
                <input
                  value={edit.short}
                  onChange={(e) => setEdit({ ...edit, short: e.target.value })}
                />
              </label>
              <label>
                Компетенции
                <textarea
                  value={edit.competencies}
                  onChange={(e) =>
                    setEdit({ ...edit, competencies: e.target.value })
                  }
                />
              </label>
              <label>
                Ключевые слова и основы слов через точку с запятой
                <textarea
                  className="large"
                  value={edit.keywords}
                  onChange={(e) =>
                    setEdit({ ...edit, keywords: e.target.value })
                  }
                />
              </label>
              <label>
                Ограничения и замечания
                <textarea
                  value={edit.restrictions}
                  onChange={(e) =>
                    setEdit({ ...edit, restrictions: e.target.value })
                  }
                />
              </label>
              <button className="primary" disabled={busy || !ready}>
                Сохранить профиль
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent className="form-dialog">
          <DialogTitle>Проверить закупку</DialogTitle>
          <DialogDescription>
            Скопируйте текст из ЕИС. Ссылка сохраняется для перехода к
            оригиналу; загрузка по ссылке пока не выполняется.
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const value: Tender = {
                ...form,
                id: crypto.randomUUID(),
                price: form.price ? Number(form.price) : null,
                status: "new",
                note: "",
                demo: false,
              };
              if (await save("tender", value)) {
                setDemo(false);
                setView("feed");
                setAdd(false);
                setSelected(value);
                setForm({
                  title: "",
                  text: "",
                  buyer: "",
                  price: "",
                  deadline: "",
                  url: "",
                });
              }
            }}
          >
            <label>
              Название закупки
              <input
                required
                maxLength={1500}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Описание / текст технического задания
              <textarea
                className="large"
                maxLength={60000}
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </label>
            <label>
              Заказчик
              <input
                value={form.buyer}
                onChange={(e) => setForm({ ...form, buyer: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Цена, ₽
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
              <label>
                Срок подачи
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Ссылка на извещение
              <input
                type="url"
                placeholder="https://zakupki.gov.ru/…"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </label>
            <button disabled={busy || !ready} className="primary">
              {busy ? "Сохранение…" : "Проверить и сохранить"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
