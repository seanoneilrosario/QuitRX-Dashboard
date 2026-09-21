"use client";

import { useRef } from "react";
import styles from "./rich-text-editor.module.css";

type Props = { name: string; initialValue?: string; ariaLabel: string; compact?: boolean };

export default function RichTextEditor({ name, initialValue = "", ariaLabel, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const sync = () => {
    if (inputRef.current && editorRef.current) inputRef.current.value = editorRef.current.innerHTML;
  };
  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    sync();
  };
  const addLink = () => {
    const url = window.prompt("Enter the link URL");
    if (url) command("createLink", /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`);
  };

  return <div className={styles.editor}>
    <input ref={inputRef} type="hidden" name={name} defaultValue={initialValue}/>
    <div className={styles.toolbar} role="toolbar" aria-label={`${ariaLabel} formatting`}>
      <button type="button" onClick={() => command("bold")} aria-label="Bold"><strong>B</strong></button>
      <button type="button" onClick={() => command("italic")} aria-label="Italic"><em>I</em></button>
      <button type="button" onClick={() => command("insertUnorderedList")} aria-label="Bulleted list">• List</button>
      <button type="button" onClick={() => command("insertOrderedList")} aria-label="Numbered list">1. List</button>
      <button type="button" onClick={addLink}>Link</button>
      <button type="button" onClick={() => command("removeFormat")}>Clear</button>
    </div>
    <div ref={editorRef} className={`${styles.content} ${compact ? styles.compact : ""}`} contentEditable suppressContentEditableWarning role="textbox" aria-label={ariaLabel} aria-multiline="true" dangerouslySetInnerHTML={{ __html: initialValue }} onInput={sync} onBlur={sync}/>
  </div>;
}
