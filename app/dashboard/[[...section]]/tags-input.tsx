"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

export default function TagsInput({ initialTags }: { initialTags: string[] }) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");

  function addTags(value: string) {
    const additions = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!additions.length) return;
    setTags((current) => [...new Set([...current, ...additions])]);
    setDraft("");
  }

  return <div className={styles.tagsInput}>
    <input type="hidden" name="tags" value={tags.join(",")}/>
    <div className={styles.tagField}>
      {tags.map((tag) => <span className={styles.tagChip} key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => setTags((current) => current.filter((value) => value !== tag))}>×</button></span>)}
      <input value={draft} aria-label="Add customer tag" placeholder={tags.length ? "Add tag" : "Add tags"} onChange={(event) => setDraft(event.target.value)} onBlur={() => addTags(draft)} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTags(draft); }
        if (event.key === "Backspace" && !draft && tags.length) setTags((current) => current.slice(0, -1));
      }}/>
      <button className={styles.addTag} type="button" aria-label="Add tag" onClick={() => addTags(draft)}>+</button>
    </div>
    <small>Press Enter or comma to add a tag.</small>
  </div>;
}
