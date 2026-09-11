"use client";

import { useState } from "react";

/** A styled file control: a button-shaped label around the real input, and the chosen name beside it. */
export function FilePick({ name, accept, multiple, required, label = "Choose a file" }: { name: string; accept?: string; multiple?: boolean; required?: boolean; label?: string }) {
  const [names, setNames] = useState<string[]>([]);
  return (
    <label className="filepick">
      <input
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        onChange={(e) => setNames(Array.from(e.currentTarget.files ?? []).map((f) => f.name))}
      />
      <span className="fp-btn">{label}</span>
      <span className="fp-name">{names.length === 0 ? "Nothing chosen yet" : names.join(", ")}</span>
    </label>
  );
}
