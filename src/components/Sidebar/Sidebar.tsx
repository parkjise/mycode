import { useState } from 'react';
import { Category, Snippet } from '../../types';
import { LANGUAGE_OPTIONS } from '../../constants';
import styles from './Sidebar.module.css';

interface SidebarProps {
  categories: Category[];
  snippets: Snippet[];
  activeId: string | null;
  onSelect: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  isCollapsed: boolean;
}

export default function Sidebar({
  categories,
  snippets,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onDeleteCategory,
  onRenameCategory,
  isCollapsed,
}: SidebarProps) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingSnippet, setRenamingSnippet] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameCatValue, setRenameCatValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    type: 'snippet' | 'category';
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = searchQuery
    ? snippets.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.language.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const getSnippetsForCat = (catId: string) =>
    (filtered ?? snippets).filter((s) => s.categoryId === catId);

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'snippet' | 'category',
    id: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  };

  const closeContext = () => setContextMenu(null);

  const startRenameSnippet = (id: string, name: string) => {
    setRenamingSnippet(id);
    setRenameValue(name);
    closeContext();
  };

  const submitRenameSnippet = (id: string) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingSnippet(null);
  };

  const startRenameCat = (id: string, name: string) => {
    setRenamingCat(id);
    setRenameCatValue(name);
    closeContext();
  };

  const submitRenameCat = (id: string) => {
    if (renameCatValue.trim()) onRenameCategory(id, renameCatValue.trim());
    setRenamingCat(null);
  };

  const getLangLabel = (key: string) =>
    LANGUAGE_OPTIONS.find((o) => o.key === key)?.label ?? key;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  if (isCollapsed) return null;

  return (
    <>
      <aside className={styles.sidebar} onClick={closeContext}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        {/* Total count */}
        <div className={styles.sidebarMeta}>
          <span>{snippets.length} snippet{snippets.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Categories */}
        <div className={styles.catList}>
          {categories.map((cat) => {
            const catSnippets = getSnippetsForCat(cat.id);
            const isExpanded = expandedCats.has(cat.id);

            return (
              <div key={cat.id} className={styles.catSection}>
                {/* Category header */}
                <div
                  className={styles.catHeader}
                  onClick={() => toggleCat(cat.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'category', cat.id)}
                >
                  <svg
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>

                  {renamingCat === cat.id ? (
                    <input
                      className={styles.inlineInput}
                      value={renameCatValue}
                      onChange={(e) => setRenameCatValue(e.target.value)}
                      onBlur={() => submitRenameCat(cat.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRenameCat(cat.id);
                        if (e.key === 'Escape') setRenamingCat(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span
                        className={styles.catDot}
                        style={{ background: cat.color }}
                      />
                      <span className={styles.catName}>{cat.name}</span>
                      <span className={styles.catCount}>{catSnippets.length}</span>
                    </>
                  )}
                </div>

                {/* Snippet items */}
                {isExpanded && (
                  <div className={styles.snippetList}>
                    {catSnippets.length === 0 ? (
                      <div className={styles.emptyHint}>No snippets yet</div>
                    ) : (
                      catSnippets.map((snippet) => (
                        <div
                          key={snippet.id}
                          className={`${styles.snippetItem} ${
                            activeId === snippet.id ? styles.snippetActive : ''
                          }`}
                          onClick={() => onSelect(snippet)}
                          onContextMenu={(e) =>
                            handleContextMenu(e, 'snippet', snippet.id)
                          }
                        >
                          {renamingSnippet === snippet.id ? (
                            <input
                              className={styles.inlineInput}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => submitRenameSnippet(snippet.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  submitRenameSnippet(snippet.id);
                                if (e.key === 'Escape') setRenamingSnippet(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <>
                              <div className={styles.snippetName}>
                                {snippet.name}
                              </div>
                              <div className={styles.snippetMeta}>
                                <span className={styles.langBadge}>
                                  {getLangLabel(snippet.language)}
                                </span>
                                <span className={styles.snippetDate}>
                                  {formatDate(snippet.updatedAt)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Context menu */}
      {contextMenu && (
        <div
          className={styles.ctxBackdrop}
          onClick={closeContext}
          onContextMenu={(e) => { e.preventDefault(); closeContext(); }}
        >
          <div
            className={styles.ctxMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'snippet' ? (
              <>
                <button
                  className={styles.ctxItem}
                  onClick={() => {
                    const s = snippets.find((x) => x.id === contextMenu.id);
                    if (s) startRenameSnippet(s.id, s.name);
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Rename
                </button>
                <button
                  className={`${styles.ctxItem} ${styles.ctxDanger}`}
                  onClick={() => {
                    onDelete(contextMenu.id);
                    closeContext();
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.ctxItem}
                  onClick={() => {
                    const c = categories.find((x) => x.id === contextMenu.id);
                    if (c) startRenameCat(c.id, c.name);
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Rename Category
                </button>
                <button
                  className={`${styles.ctxItem} ${styles.ctxDanger}`}
                  onClick={() => {
                    onDeleteCategory(contextMenu.id);
                    closeContext();
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                  Delete Category
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
