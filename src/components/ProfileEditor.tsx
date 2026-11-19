import { useState } from "react";
import type { Profile } from "../lib/procurement";
export function ProfileEditor({
  profile,
  update,
}: {
  profile: Profile;
  update: (p: Profile) => void;
}) {
  const [keywords, setKeywords] = useState(profile.keywords);
  return (
    <details className="profile">
      <summary>{profile.name}</summary>
      <p>{profile.competencies}</p>
      <p>{profile.restrictions}</p>
      <label>
        Ключевые слова через точку с запятой
        <textarea
          rows={4}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
      </label>
      <button
        disabled={keywords === profile.keywords}
        onClick={() => update({ ...profile, keywords })}
      >
        Сохранить профиль
      </button>
    </details>
  );
}
