import { forwardRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  vscDarkPlus,
  vs,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AppTheme, BackgroundStyle, LanguageKey } from '../../types';
import { LANGUAGE_OPTIONS } from '../../constants';
import styles from './CodePreview.module.css';

interface CodePreviewProps {
  code: string;
  language: LanguageKey;
  fileName: string;
  theme: AppTheme;
  fontSize: number;
  padding: number;
  backgroundStyle: BackgroundStyle;
  cardWidth: number;
}

const PLACEHOLDER_CODE = `// Paste your code on the left
// and it will appear here instantly`;

const CodePreview = forwardRef<HTMLDivElement, CodePreviewProps>(
  (
    {
      code,
      language,
      fileName,
      theme,
      fontSize,
      padding,
      backgroundStyle,
      cardWidth,
    },
    ref
  ) => {
    const isDark = theme === 'dark';
    const displayCode = code.trim() || PLACEHOLDER_CODE;

    const langOption = LANGUAGE_OPTIONS.find((o) => o.key === language);
    const syntaxLang = langOption?.syntaxLang ?? 'typescript';

    const highlighterTheme = isDark ? vscDarkPlus : vs;

    const bgClass = `bg-${backgroundStyle}-${isDark ? 'dark' : 'light'}`;

    return (
      <div
        ref={ref}
        className={`${styles.stage} ${styles[bgClass]}`}
        style={{ padding: `${padding}px` }}
      >
        <div
          className={`${styles.card} ${isDark ? styles.cardDark : styles.cardLight}`}
          style={{ width: `${cardWidth}px`, maxWidth: '100%' }}
        >
          {/* Window chrome */}
          <div className={`${styles.titleBar} ${isDark ? styles.titleBarDark : styles.titleBarLight}`}>
            <div className={styles.dots}>
              <span className={`${styles.dot} ${styles.dotRed}`} />
              <span className={`${styles.dot} ${styles.dotYellow}`} />
              <span className={`${styles.dot} ${styles.dotGreen}`} />
            </div>
            <div className={styles.tabWrap}>
              <div className={`${styles.tab} ${isDark ? styles.tabDark : styles.tabLight}`}>
                <span className={styles.tabIcon}>{getFileIcon(fileName)}</span>
                <span className={styles.tabName}>{fileName || 'untitled'}</span>
              </div>
            </div>
            <div className={styles.windowActions}>
              <span className={styles.langLabel}>{langOption?.label ?? language}</span>
            </div>
          </div>

          {/* Code body */}
          <div className={styles.codeBody}>
            {!code.trim() && (
              <div className={styles.placeholderOverlay}>
                <div className={styles.placeholderContent}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <p>Your code snippet will appear here</p>
                  <span>Paste code in the editor on the left</span>
                </div>
              </div>
            )}
            <SyntaxHighlighter
              language={syntaxLang}
              style={highlighterTheme}
              showLineNumbers
              wrapLines
              wrapLongLines={false}
              customStyle={{
                margin: 0,
                padding: '20px 0',
                background: 'transparent',
                backgroundColor: 'transparent',
                fontSize: `${fontSize}px`,
                lineHeight: '1.65',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                overflow: 'auto',
              }}
              lineNumberStyle={{
                minWidth: '3em',
                paddingRight: '1.5em',
                color: isDark ? '#495162' : '#aaaacc',
                userSelect: 'none',
                fontSize: `${fontSize - 1}px`,
                textAlign: 'right',
              }}
              codeTagProps={{
                style: {
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                },
              }}
            >
              {displayCode}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    );
  }
);

CodePreview.displayName = 'CodePreview';

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    tsx: '⚛',
    jsx: '⚛',
    ts: '📘',
    js: '📜',
    json: '{}',
    css: '🎨',
    scss: '🎨',
    sh: '💲',
    bash: '💲',
    md: '📝',
  };
  return map[ext ?? ''] ?? '📄';
}

export default CodePreview;
