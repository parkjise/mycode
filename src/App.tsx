import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, BackgroundStyle, LanguageKey, Snippet } from './types';
import {
  DEFAULT_CODE,
  FONT_SIZE_DEFAULT,
  PADDING_DEFAULT,
  CARD_WIDTH_DEFAULT,
} from './constants';
import { useSnippets } from './hooks/useSnippets';
import { useAuth } from './hooks/useAuth';
import { decodeSnippetFromUrl, clearUrlHash } from './utils/urlShare';
import Toolbar from './components/Toolbar/Toolbar';
import CodeInput from './components/CodeInput/CodeInput';
import CodePreview from './components/CodePreview/CodePreview';
import Sidebar from './components/Sidebar/Sidebar';
import SaveModal from './components/SaveModal/SaveModal';
import AuthButton from './components/AuthButton/AuthButton';
import styles from './App.module.css';

const freshState = (): AppState => {
  // URL 공유 링크로 접속한 경우 해당 스니펫을 복원
  const fromUrl = decodeSnippetFromUrl();
  if (fromUrl) {
    clearUrlHash();
    return fromUrl as AppState;
  }
  return {
    code: DEFAULT_CODE,
    language: 'tsx',
    fileName: 'UserCard.tsx',
    theme: 'dark',
    fontSize: FONT_SIZE_DEFAULT,
    padding: PADDING_DEFAULT,
    backgroundStyle: 'gradient',
    cardWidth: CARD_WIDTH_DEFAULT,
  };
};

export default function App() {
  const [state, setState] = useState<AppState>(freshState);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  const {
    categories,
    snippets,
    activeId,
    syncing,
    setActiveId,
    saveSnippet,
    deleteSnippet,
    renameSnippet,
    addCategory,
    renameCategory,
    deleteCategory,
    exportLibrary,
    importLibrary,
  } = useSnippets(user?.id ?? null);

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  // Load snippet into editor
  const loadSnippet = useCallback(
    (snippet: Snippet) => {
      setState({
        code: snippet.code,
        language: snippet.language,
        fileName: snippet.fileName,
        theme: snippet.theme,
        fontSize: snippet.fontSize,
        padding: snippet.padding,
        backgroundStyle: snippet.backgroundStyle,
        cardWidth: snippet.cardWidth,
      });
      setActiveId(snippet.id);
    },
    [setActiveId]
  );

  // Save: update existing or open modal for new
  const handleSave = useCallback(() => {
    if (activeId) {
      // Update existing snippet silently
      const existing = snippets.find((s) => s.id === activeId);
      if (existing) {
        saveSnippet({
          ...existing,
          code: state.code,
          language: state.language,
          fileName: state.fileName,
          theme: state.theme,
          fontSize: state.fontSize,
          padding: state.padding,
          backgroundStyle: state.backgroundStyle,
          cardWidth: state.cardWidth,
          updatedAt: Date.now(),
        });
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
        return;
      }
    }
    // New snippet → open modal
    setSaveModalOpen(true);
  }, [activeId, snippets, saveSnippet, state]);

  // Confirm save from modal
  const handleSaveConfirm = useCallback(
    (name: string, categoryId: string) => {
      const id = activeId && !snippets.find((s) => s.id === activeId)
        ? activeId
        : `snip-${Date.now()}`;
      saveSnippet({
        id,
        name,
        categoryId,
        code: state.code,
        language: state.language,
        fileName: state.fileName,
        theme: state.theme,
        fontSize: state.fontSize,
        padding: state.padding,
        backgroundStyle: state.backgroundStyle,
        cardWidth: state.cardWidth,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setSaveModalOpen(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    },
    [activeId, snippets, saveSnippet, state]
  );

  // New snippet: reset editor
  const handleNew = useCallback(() => {
    setState(freshState());
    setActiveId(null);
  }, [setActiveId]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const activeSnippet = snippets.find((s) => s.id === activeId);

  return (
    <div className={styles.app} data-theme={state.theme}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
            title="Toggle snippet library"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>&#x276F;</span>
            <span className={styles.brandName}>SnipShot</span>
            <span className={styles.brandTag}>Code Snippet Generator</span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {activeSnippet && (
            <div className={styles.activeSnippetBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              </svg>
              <span>{activeSnippet.name}</span>
              {savedFeedback && <span className={styles.savedDot} />}
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          <AuthButton
            user={user}
            loading={authLoading}
            syncing={syncing}
            onSignIn={signInWithGoogle}
            onSignOut={signOut}
          />
          <button
            className={styles.themeBtn}
            onClick={() =>
              update('theme', state.theme === 'dark' ? 'light' : 'dark')
            }
            aria-label="Toggle theme"
          >
            {state.theme === 'dark' ? '☀️' : '🌙'}
            <span>{state.theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Body: sidebar + workspace */}
      <div className={styles.body}>
        {/* Sidebar */}
        <Sidebar
          categories={categories}
          snippets={snippets}
          activeId={activeId}
          onSelect={loadSnippet}
          onDelete={deleteSnippet}
          onRename={renameSnippet}
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
          isCollapsed={!sidebarOpen}
          onExport={exportLibrary}
          onImport={importLibrary}
        />

        {/* Right: toolbar + main */}
        <div className={styles.workspace}>
          <Toolbar
            language={state.language}
            fileName={state.fileName}
            fontSize={state.fontSize}
            padding={state.padding}
            backgroundStyle={state.backgroundStyle}
            cardWidth={state.cardWidth}
            onLanguageChange={(v: LanguageKey) => update('language', v)}
            onFileNameChange={(v: string) => update('fileName', v)}
            onFontSizeChange={(v: number) => update('fontSize', v)}
            onPaddingChange={(v: number) => update('padding', v)}
            onBackgroundStyleChange={(v: BackgroundStyle) =>
              update('backgroundStyle', v)
            }
            onCardWidthChange={(v: number) => update('cardWidth', v)}
            previewRef={previewRef}
            code={state.code}
            isSaved={savedFeedback}
            onSave={handleSave}
            onNew={handleNew}
            appState={state}
          />

          <main className={styles.main}>
            <section className={styles.inputPanel}>
              <div className={styles.panelLabel}>
                <span className={styles.dot} />
                Editor
              </div>
              <CodeInput
                code={state.code}
                onChange={(v: string) => update('code', v)}
                language={state.language}
              />
            </section>

            <section className={styles.previewPanel}>
              <div className={styles.panelLabel}>
                <span className={styles.dot} style={{ background: 'var(--accent)' }} />
                Preview
              </div>
              <div className={styles.previewScroll}>
                <CodePreview
                  ref={previewRef}
                  code={state.code}
                  language={state.language}
                  fileName={state.fileName}
                  theme={state.theme}
                  fontSize={state.fontSize}
                  padding={state.padding}
                  backgroundStyle={state.backgroundStyle}
                  cardWidth={state.cardWidth}
                />
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Save modal */}
      <SaveModal
        isOpen={saveModalOpen}
        categories={categories}
        defaultName={state.fileName.replace(/\.[^.]+$/, '') || 'My Snippet'}
        defaultCategoryId="general"
        isUpdate={false}
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveModalOpen(false)}
        onAddCategory={addCategory}
      />
    </div>
  );
}
