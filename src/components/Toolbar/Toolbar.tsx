import { RefObject, useState } from 'react';
import { toPng } from 'html-to-image';
import { AppState, BackgroundStyle, LanguageKey } from '../../types';
import { encodeSnippetToUrl } from '../../utils/urlShare';
import {
  LANGUAGE_OPTIONS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  PADDING_MIN,
  PADDING_MAX,
  CARD_WIDTH_MIN,
  CARD_WIDTH_MAX,
} from '../../constants';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  language: LanguageKey;
  fileName: string;
  fontSize: AppState['fontSize'];
  padding: AppState['padding'];
  backgroundStyle: BackgroundStyle;
  cardWidth: AppState['cardWidth'];
  onLanguageChange: (v: LanguageKey) => void;
  onFileNameChange: (v: string) => void;
  onFontSizeChange: (v: number) => void;
  onPaddingChange: (v: number) => void;
  onBackgroundStyleChange: (v: BackgroundStyle) => void;
  onCardWidthChange: (v: number) => void;
  previewRef: RefObject<HTMLDivElement | null>;
  code: string;
  isSaved: boolean;
  onSave: () => void;
  onNew: () => void;
  appState: AppState;
}

export default function Toolbar({
  language,
  fileName,
  fontSize,
  padding,
  backgroundStyle,
  cardWidth,
  onLanguageChange,
  onFileNameChange,
  onFontSizeChange,
  onPaddingChange,
  onBackgroundStyleChange,
  onCardWidthChange,
  previewRef,
  code,
  isSaved,
  onSave,
  onNew,
  appState,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleShareUrl = async () => {
    const url = encodeSnippetToUrl(appState);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt('Copy this URL to share:', url);
    }
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!previewRef.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `${fileName || 'snippet'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.toolbar}>
      {/* Row 1 */}
      <div className={styles.row}>
        <div className={styles.group}>
          <label className={styles.label}>Language</label>
          <select
            className={styles.select}
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as LanguageKey)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.group}>
          <label className={styles.label}>File Name</label>
          <input
            className={styles.input}
            type="text"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            placeholder="filename.tsx"
            spellCheck={false}
          />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>Background</label>
          <div className={styles.segmented}>
            {(['solid', 'gradient', 'pattern'] as BackgroundStyle[]).map((bg) => (
              <button
                key={bg}
                className={`${styles.segBtn} ${backgroundStyle === bg ? styles.segBtnActive : ''}`}
                onClick={() => onBackgroundStyleChange(bg)}
              >
                {bg.charAt(0).toUpperCase() + bg.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          {/* New */}
          <button className={styles.btn} onClick={onNew} title="New snippet">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New</span>
          </button>

          {/* Save */}
          <button
            className={`${styles.btn} ${styles.btnSave} ${isSaved ? styles.btnSaved : ''}`}
            onClick={onSave}
            title="Save snippet (Ctrl+S)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{isSaved ? 'Saved ✓' : 'Save'}</span>
          </button>

          {/* Share URL */}
          <button
            className={`${styles.btn} ${urlCopied ? styles.btnSuccess : ''}`}
            onClick={handleShareUrl}
            title="Copy share URL (works on any device)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {urlCopied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </>
              )}
            </svg>
            <span>{urlCopied ? 'Copied!' : 'Share'}</span>
          </button>

          {/* Divider */}
          <div className={styles.divider} />

          {/* Copy */}
          <button
            className={`${styles.btn} ${copied ? styles.btnSuccess : ''}`}
            onClick={handleCopy}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Download PNG */}
          <button
            className={`${styles.btn} ${styles.btnPrimary} ${downloading ? styles.btnLoading : ''}`}
            onClick={handleDownload}
            disabled={downloading}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{downloading ? 'Saving…' : 'PNG'}</span>
          </button>
        </div>
      </div>

      {/* Row 2: Sliders */}
      <div className={styles.row}>
        <div className={styles.sliderGroup}>
          <label className={styles.label}>
            Font <span className={styles.val}>{fontSize}px</span>
          </label>
          <input
            type="range"
            className={styles.range}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
          />
        </div>

        <div className={styles.sliderGroup}>
          <label className={styles.label}>
            Padding <span className={styles.val}>{padding}px</span>
          </label>
          <input
            type="range"
            className={styles.range}
            min={PADDING_MIN}
            max={PADDING_MAX}
            value={padding}
            onChange={(e) => onPaddingChange(Number(e.target.value))}
          />
        </div>

        <div className={styles.sliderGroup}>
          <label className={styles.label}>
            Width <span className={styles.val}>{cardWidth}px</span>
          </label>
          <input
            type="range"
            className={styles.range}
            min={CARD_WIDTH_MIN}
            max={CARD_WIDTH_MAX}
            value={cardWidth}
            onChange={(e) => onCardWidthChange(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
