import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, BackgroundStyle, LanguageKey, Snippet } from './types';
import {
  DEFAULT_CODE,
  FONT_SIZE_DEFAULT,
  PADDING_DEFAULT,
  CARD_WIDTH_DEFAULT,
} from './constants';
import { useSnippets } from './hooks/useSnippets';
import { useNotes } from './hooks/useNotes';
import { useAuth } from './hooks/useAuth';
import { decodeSnippetFromUrl, clearUrlHash } from './utils/urlShare';
import Toolbar from './components/Toolbar/Toolbar';
import CodeInput from './components/CodeInput/CodeInput';
import CodePreview from './components/CodePreview/CodePreview';
import Sidebar from './components/Sidebar/Sidebar';
import SaveModal from './components/SaveModal/SaveModal';
import AuthButton from './components/AuthButton/AuthButton';
import NoteEditor from './components/NoteEditor/NoteEditor';
import styles from './App.module.css';

const freshState = (): AppState => {
  const fromUrl = decodeSnippetFromUrl();
  if (fromUrl) {
    clearUrlHash();
    return fromUrl as AppState;
  }
  return {
    code: DEFAULT_CODE,
    language: 'tsx',
    fileName: '',
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
  const [editorOpen, setEditorOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('preview');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'code' | 'notes'>('code');
  const [lastCodeCategoryId, setLastCodeCategoryId] = useState('general');
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
    changeCategoryColor,
    deleteCategory,
    moveCategoryUp,
    moveCategoryDown,
    exportLibrary,
    importLibrary,
  } = useSnippets(user?.id ?? null, !authLoading);

  const {
    notes,
    noteCategories,
    activeNoteId,
    setActiveNoteId,
    saveNote,
    deleteNote,
    createNote,
    addNoteCategory,
    renameNoteCategory,
    deleteNoteCategory,
    changeNoteCategoryColor,
    moveNoteCategoryUp,
    moveNoteCategoryDown,
  } = useNotes(user?.id ?? null, !authLoading);

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

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
      setActiveNoteId(null);
    },
    [setActiveId, setActiveNoteId]
  );

  const handleSelectNote = useCallback((note: typeof notes[0]) => {
    setActiveNoteId(note.id);
    setActiveId(null);
  }, [setActiveNoteId, setActiveId]);

  const handleNewNote = useCallback((categoryId: string) => {
    const note = createNote(categoryId);
    saveNote(note);
    setActiveNoteId(note.id);
    setActiveId(null);
    setSidebarTab('notes');
  }, [createNote, saveNote, setActiveNoteId, setActiveId]);

  const handleSave = useCallback(() => {
    if (activeId) {
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
    setSaveModalOpen(true);
  }, [activeId, snippets, saveSnippet, state]);

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
      setLastCodeCategoryId(categoryId);
      setSaveModalOpen(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    },
    [activeId, snippets, saveSnippet, state]
  );

  const handleNew = useCallback(() => {
    setState(freshState());
    setActiveId(null);
  }, [setActiveId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!activeNoteId) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, activeNoteId]);

  const activeSnippet = snippets.find((s) => s.id === activeId);
  const activeNote = notes.find((n) => n.id === activeNoteId);
  const isNoteMode = Boolean(activeNoteId);

  return (
    <div className={styles.app} data-theme={state.theme}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          {!isNoteMode && (
            <button
              className={`${styles.sidebarToggle} ${styles.editorToggle}`}
              onClick={() => setEditorOpen((v) => !v)}
              aria-label="Toggle editor"
              title={editorOpen ? '에디터 닫기' : '에디터 열기'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </button>
          )}
          <div className={styles.brand}>
            <span className={styles.brandIcon}>&#x276F;</span>
            <span className={styles.brandName}>SnipShot</span>
            <span className={styles.brandTag}>Code + Notes</span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {activeSnippet && !isNoteMode && (
            <div className={styles.activeSnippetBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              </svg>
              <span>{activeSnippet.name}</span>
              {savedFeedback && <span className={styles.savedDot} />}
            </div>
          )}
          {activeNote && isNoteMode && (
            <div className={styles.activeSnippetBadge}>
              <span>{activeNote.emoji}</span>
              <span>{activeNote.title || '제목 없음'}</span>
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
            onClick={() => update('theme', state.theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {state.theme === 'dark' ? '☀️' : '🌙'}
            <span>{state.theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className={styles.body}>
        <Sidebar
          categories={categories}
          snippets={snippets}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
          onChangeCategoryColor={changeCategoryColor}
          onMoveCategoryUp={moveCategoryUp}
          onMoveCategoryDown={moveCategoryDown}
          onSelect={loadSnippet}
          onDelete={deleteSnippet}
          onRename={renameSnippet}
          noteCategories={noteCategories}
          notes={notes}
          onAddNoteCategory={addNoteCategory}
          onDeleteNoteCategory={deleteNoteCategory}
          onRenameNoteCategory={renameNoteCategory}
          onChangeNoteCategoryColor={changeNoteCategoryColor}
          onMoveNoteCategoryUp={moveNoteCategoryUp}
          onMoveNoteCategoryDown={moveNoteCategoryDown}
          onSelectNote={handleSelectNote}
          onDeleteNote={deleteNote}
          onNewNote={handleNewNote}
          activeId={activeId}
          activeNoteId={activeNoteId}
          sidebarTab={sidebarTab}
          onSidebarTabChange={setSidebarTab}
          isCollapsed={!sidebarOpen}
          onExport={exportLibrary}
          onImport={importLibrary}
        />

        <div className={styles.workspace}>
          {isNoteMode && activeNote ? (
            <NoteEditor
              note={activeNote}
              categories={noteCategories}
              onSave={saveNote}
              onDelete={(id) => { deleteNote(id); }}
              onAddCategory={addNoteCategory}
              theme={state.theme}
            />
          ) : (
            <>
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
                onBackgroundStyleChange={(v: BackgroundStyle) => update('backgroundStyle', v)}
                onCardWidthChange={(v: number) => update('cardWidth', v)}
                previewRef={previewRef}
                code={state.code}
                isSaved={savedFeedback}
                onSave={handleSave}
                onNew={handleNew}
                appState={state}
              />

              <div className={styles.mobileTabs}>
                <button
                  className={`${styles.mobileTab} ${mobileTab === 'editor' ? styles.mobileTabActive : ''}`}
                  onClick={() => setMobileTab('editor')}
                >Editor</button>
                <button
                  className={`${styles.mobileTab} ${mobileTab === 'preview' ? styles.mobileTabActive : ''}`}
                  onClick={() => setMobileTab('preview')}
                >Preview</button>
              </div>

              <main className={`${styles.main} ${!editorOpen ? styles.editorClosed : ''}`}>
                <section className={`${styles.inputPanel} ${mobileTab !== 'editor' ? styles.mobileHidden : ''}`}>
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

                <section className={`${styles.previewPanel} ${mobileTab !== 'preview' ? styles.mobileHidden : ''}`}>
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
            </>
          )}
        </div>
      </div>

      <SaveModal
        isOpen={saveModalOpen}
        categories={categories}
        defaultName={state.fileName.replace(/\.[^.]+$/, '') || 'My Snippet'}
        defaultCategoryId={lastCodeCategoryId}
        isUpdate={false}
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveModalOpen(false)}
        onAddCategory={addCategory}
      />
    </div>
  );
}
