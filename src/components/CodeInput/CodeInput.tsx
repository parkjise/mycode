import { useRef, useCallback } from 'react';
import { LanguageKey } from '../../types';
import styles from './CodeInput.module.css';

interface CodeInputProps {
  code: string;
  onChange: (value: string) => void;
  language: LanguageKey;
}

export default function CodeInput({ code, onChange, language }: CodeInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const spaces = '  ';
        const newVal = code.substring(0, start) + spaces + code.substring(end);
        onChange(newVal);
        requestAnimationFrame(() => {
          el.selectionStart = start + spaces.length;
          el.selectionEnd = start + spaces.length;
        });
      }
    },
    [code, onChange]
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.meta}>
        <span className={styles.langBadge}>{language}</span>
        <span className={styles.lineCount}>
          {code ? code.split('\n').length : 0} lines
        </span>
      </div>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder="Paste your code here..."
      />
    </div>
  );
}
