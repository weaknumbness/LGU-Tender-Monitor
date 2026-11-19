import { useState } from "react";
import { screeningNames, statusNames, type Tender } from "../lib/procurement";
import type { screen } from "../lib/screening";
export function TenderCard({
  t,
  result,
  update,
}: {
  t: Tender;
  result: ReturnType<typeof screen>;
  update: (value: Tender) => void;
}) {
  const [note, setNote] = useState(t.note);
  return (
    <article>
      <small>{screeningNames[result.status]}</small>
      <h3>
        <a href={t.url} target="_blank" rel="noreferrer">
          {t.title}
        </a>
      </h3>
      <p>
        {[
          t.buyer,
          t.price !== null ? t.price.toLocaleString("ru-RU") + " ₽" : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p>{result.reason}</p>
      {result.matches.map((m) => (
        <div key={m.profile.id}>
          <b>{m.profile.short}</b> · {m.hits.join(", ")}
        </div>
      ))}
      <details>
        <summary>Карточка и решение</summary>
        <p className="description">{t.text}</p>
        <label>
          Рабочий статус{" "}
          <select
            value={t.status}
            onChange={(e) => update({ ...t, status: e.target.value })}
          >
            {Object.entries(statusNames).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Заметка
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          disabled={note === t.note}
          onClick={() => update({ ...t, note })}
        >
          Сохранить заметку
        </button>
      </details>
    </article>
  );
}
