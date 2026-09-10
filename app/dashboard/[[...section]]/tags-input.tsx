"use client";

import { useId, useState } from "react";
import styles from "./dashboard.module.css";

export type TagValue = { value: string; label: string };

export default function TagsInput({ initialTags, options = [], ariaLabel = "Add tag" }: { initialTags: TagValue[] | string[]; options?: TagValue[]; ariaLabel?: string }) {
  const [tags, setTags] = useState<TagValue[]>(initialTags.map((tag) => typeof tag === "string" ? { value: tag, label: tag } : tag));
  const [draft, setDraft] = useState("");
  const suggestionsId = useId();

  function addTags(value: string) {
    const additions = value.split(",").map((tag) => tag.trim()).filter(Boolean).map((label) => {
      const match = options.find((option) => option.label.toLocaleLowerCase() === label.toLocaleLowerCase());
      return match ?? { value: label, label };
    });
    if (!additions.length) return;
    setTags((current) => [...current, ...additions.filter((addition) => !current.some((tag) => tag.value === addition.value))]);
    setDraft("");
  }

  return <div className={styles.tagsInput}>
    <input type="hidden" name="tags" value={tags.map((tag) => tag.value).join(",")}/>
    <div className={styles.tagField}>
      {tags.map((tag) => <span className={styles.tagChip} key={tag.value}>{tag.label}<button type="button" aria-label={`Remove ${tag.label}`} onClick={() => setTags((current) => current.filter((value) => value.value !== tag.value))}>×</button></span>)}
      <input list={options.length ? suggestionsId : undefined} value={draft} aria-label={ariaLabel} placeholder={tags.length ? "Add tag" : "Add tags"} onChange={(event) => setDraft(event.target.value)} onBlur={() => addTags(draft)} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTags(draft); }
        if (event.key === "Backspace" && !draft && tags.length) setTags((current) => current.slice(0, -1));
      }}/>
      {options.length ? <datalist id={suggestionsId}>{options.filter((option) => !tags.some((tag) => tag.value === option.value)).map((option) => <option value={option.label} key={option.value}/>)}</datalist> : null}
      <button className={styles.addTag} type="button" aria-label="Add tag" onClick={() => addTags(draft)}>+</button>
    </div>
    <small>Press Enter or comma to add a tag.</small>
  </div>;
}
