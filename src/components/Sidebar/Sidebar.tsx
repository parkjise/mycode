import { useState, useRef } from 'react';
import { Category, Note, Snippet } from '../../types';
import { LANGUAGE_OPTIONS } from '../../constants';
import styles from './Sidebar.module.css';

const CAT_COLORS = [
  '#8888a8','#f7df1e','#3178c6','#61dafb','#ff7262',
  '#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899',
  '#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6',
];
const randomColor = () => CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)];

interface CategoryNode extends Category {
  children: CategoryNode[];
}

function buildTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CategoryNode[] = [];
  categories.forEach((c) => {
    if (c.parentId) {
      const parent = map.get(c.parentId);
      if (parent) parent.children.push(map.get(c.id)!);
      else roots.push(map.get(c.id)!);
    } else {
      roots.push(map.get(c.id)!);
    }
  });
  const sort = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

interface SidebarProps {
  // Code tab
  categories: Category[];
  snippets: Snippet[];
  onAddCategory: (name: string, color: string, parentId?: string) => void;
  onDeleteCategory: (id: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onChangeCategoryColor: (id: string, color: string) => void;
  onMoveCategoryUp: (id: string) => void;
  onMoveCategoryDown: (id: string) => void;
  onSelect: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  // Notes tab
  noteCategories: Category[];
  notes: Note[];
  onAddNoteCategory: (name: string, color: string, parentId?: string) => void;
  onDeleteNoteCategory: (id: string) => void;
  onRenameNoteCategory: (id: string, name: string) => void;
  onChangeNoteCategoryColor: (id: string, color: string) => void;
  onMoveNoteCategoryUp: (id: string) => void;
  onMoveNoteCategoryDown: (id: string) => void;
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onNewNote: (categoryId: string) => void;
  // Shared
  activeId: string | null;
  activeNoteId: string | null;
  sidebarTab: 'code' | 'notes';
  onSidebarTabChange: (tab: 'code' | 'notes') => void;
  isCollapsed: boolean;
  onExport: () => void;
  onImport: (file: File, mode: 'replace' | 'merge') => void;
}

export default function Sidebar({
  categories,
  snippets,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
  onChangeCategoryColor,
  onMoveCategoryUp,
  onMoveCategoryDown,
  onSelect,
  onDelete,
  onRename,
  noteCategories,
  notes,
  onAddNoteCategory,
  onDeleteNoteCategory,
  onRenameNoteCategory,
  onChangeNoteCategoryColor,
  onMoveNoteCategoryUp,
  onMoveNoteCategoryDown,
  onSelectNote,
  onDeleteNote,
  onNewNote,
  activeId,
  activeNoteId,
  sidebarTab,
  onSidebarTabChange,
  isCollapsed,
  onExport,
  onImport,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set([...categories.map((c) => c.id), ...noteCategories.map((c) => c.id)])
  );
  const [searchQuery, setSearchQuery] = useState('');

  const [renamingSnippet, setRenamingSnippet] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameCatValue, setRenameCatValue] = useState('');
  const [addingSubcat, setAddingSubcat] = useState<string | null>(null);
  const [subcatName, setSubcatName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(randomColor());
  const [colorPickerCatId, setColorPickerCatId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    type: 'snippet' | 'category' | 'note';
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // Active set based on current tab
  const activeCategories = sidebarTab === 'code' ? categories : noteCategories;

  const handleAddCategory = (name: string, color: string, parentId?: string) => {
    if (sidebarTab === 'code') onAddCategory(name, color, parentId);
    else onAddNoteCategory(name, color, parentId);
  };
  const handleDeleteCategory = (id: string) => {
    if (sidebarTab === 'code') onDeleteCategory(id);
    else onDeleteNoteCategory(id);
  };
  const handleRenameCategory = (id: string, name: string) => {
    if (sidebarTab === 'code') onRenameCategory(id, name);
    else onRenameNoteCategory(id, name);
  };
  const handleChangeCategoryColor = (id: string, color: string) => {
    if (sidebarTab === 'code') onChangeCategoryColor(id, color);
    else onChangeNoteCategoryColor(id, color);
  };
  const handleMoveCategoryUp = (id: string) => {
    if (sidebarTab === 'code') onMoveCategoryUp(id);
    else onMoveNoteCategoryUp(id);
  };
  const handleMoveCategoryDown = (id: string) => {
    if (sidebarTab === 'code') onMoveCategoryDown(id);
    else onMoveNoteCategoryDown(id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowImportConfirm(true);
    e.target.value = '';
  };

  const confirmImport = (mode: 'replace' | 'merge') => {
    if (pendingFile) onImport(pendingFile, mode);
    setShowImportConfirm(false);
    setPendingFile(null);
  };

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredSnippets = searchQuery
    ? snippets.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.language.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const filteredNotes = searchQuery
    ? notes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const handleContextMenu = (e: React.MouseEvent, type: 'snippet' | 'category' | 'note', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setColorPickerCatId(null);
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  };

  const closeContext = () => {
    setContextMenu(null);
    setColorPickerCatId(null);
  };

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
    if (renameCatValue.trim()) handleRenameCategory(id, renameCatValue.trim());
    setRenamingCat(null);
  };

  const startAddSubcat = (parentId: string) => {
    setAddingSubcat(parentId);
    setSubcatName('');
    closeContext();
    setExpandedCats((prev) => new Set([...prev, parentId]));
  };

  const submitAddSubcat = () => {
    if (subcatName.trim() && addingSubcat) {
      handleAddCategory(subcatName.trim(), randomColor(), addingSubcat);
    }
    setAddingSubcat(null);
    setSubcatName('');
  };

  const submitAddCat = () => {
    if (newCatName.trim()) {
      handleAddCategory(newCatName.trim(), newCatColor);
    }
    setShowAddCat(false);
    setNewCatName('');
    setNewCatColor(randomColor());
  };

  const getLangLabel = (key: string) =>
    LANGUAGE_OPTIONS.find((o) => o.key === key)?.label ?? key;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('ko', { month: 'short', day: 'numeric' });
  };

  const tree = buildTree(activeCategories);

  const ColorSwatches = ({ onPick }: { onPick: (c: string) => void }) => (
    <div className={styles.colorSwatches}>
      {CAT_COLORS.map((c) => (
        <button
          key={c}
          className={styles.colorSwatch}
          style={{ background: c }}
          onClick={() => onPick(c)}
          title={c}
        />
      ))}
    </div>
  );

  const renderCategoryNode = (node: CategoryNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedCats.has(node.id);
    const indent = depth * 14;

    const catSnippets = (filteredSnippets ?? snippets).filter((s) => s.categoryId === node.id);
    const catNotes = (filteredNotes ?? notes).filter((n) => n.categoryId === node.id);
    const itemCount = sidebarTab === 'code' ? catSnippets.length : catNotes.length;
    const totalCount = itemCount + node.children.reduce((acc, ch) => {
      const chItems = sidebarTab === 'code'
        ? snippets.filter((s) => s.categoryId === ch.id).length
        : notes.filter((n) => n.categoryId === ch.id).length;
      return acc + chItems;
    }, 0);

    return (
      <div key={node.id} className={styles.catSection}>
        <div
          className={styles.catHeader}
          style={{ paddingLeft: 12 + indent }}
          onClick={() => toggleCat(node.id)}
          onContextMenu={(e) => handleContextMenu(e, 'category', node.id)}
        >
          <svg
            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>

          {renamingCat === node.id ? (
            <input
              className={styles.inlineInput}
              value={renameCatValue}
              onChange={(e) => setRenameCatValue(e.target.value)}
              onBlur={() => submitRenameCat(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRenameCat(node.id);
                if (e.key === 'Escape') setRenamingCat(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <>
              <span
                className={styles.catDot}
                style={{ background: node.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  setColorPickerCatId(colorPickerCatId === node.id ? null : node.id);
                }}
                title="색상 변경"
              />
              <span className={styles.catName}>{node.name}</span>
              <span className={styles.catCount}>{totalCount}</span>
            </>
          )}
        </div>

        {colorPickerCatId === node.id && (
          <div className={styles.inlineColorPicker} style={{ paddingLeft: 12 + indent }}>
            <ColorSwatches onPick={(c) => { handleChangeCategoryColor(node.id, c); setColorPickerCatId(null); }} />
          </div>
        )}

        {isExpanded && (
          <>
            {node.children.map((child) => renderCategoryNode(child, depth + 1))}

            {addingSubcat === node.id && (
              <div className={styles.addSubcatRow} style={{ paddingLeft: 12 + indent + 14 }}>
                <input
                  className={styles.inlineInput}
                  placeholder="하위 카테고리 이름"
                  value={subcatName}
                  onChange={(e) => setSubcatName(e.target.value)}
                  onBlur={submitAddSubcat}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAddSubcat();
                    if (e.key === 'Escape') setAddingSubcat(null);
                  }}
                  autoFocus
                />
              </div>
            )}

            <div className={styles.snippetList}>
              {sidebarTab === 'code' ? (
                catSnippets.length === 0 ? (
                  <div className={styles.emptyHint}>No snippets yet</div>
                ) : (
                  catSnippets.map((snippet) => (
                    <div
                      key={snippet.id}
                      className={`${styles.snippetItem} ${activeId === snippet.id ? styles.snippetActive : ''}`}
                      style={{ paddingLeft: 24 + indent }}
                      onClick={() => onSelect(snippet)}
                      onContextMenu={(e) => handleContextMenu(e, 'snippet', snippet.id)}
                    >
                      {renamingSnippet === snippet.id ? (
                        <input
                          className={styles.inlineInput}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => submitRenameSnippet(snippet.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRenameSnippet(snippet.id);
                            if (e.key === 'Escape') setRenamingSnippet(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className={styles.snippetTop}>
                            <div className={styles.snippetName}>{snippet.name}</div>
                            <button
                              className={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`"${snippet.name}" 을 삭제할까요?`)) onDelete(snippet.id);
                              }}
                              title="삭제"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                          <div className={styles.snippetMeta}>
                            <span className={styles.langBadge}>{getLangLabel(snippet.language)}</span>
                            <span className={styles.snippetDate}>{formatDate(snippet.updatedAt)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )
              ) : (
                <>
                  {catNotes.length === 0 ? (
                    <div className={styles.emptyHint}>노트 없음</div>
                  ) : (
                    catNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`${styles.snippetItem} ${activeNoteId === note.id ? styles.snippetActive : ''}`}
                        style={{ paddingLeft: 24 + indent }}
                        onClick={() => onSelectNote(note)}
                        onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                      >
                        <div className={styles.snippetTop}>
                          <span className={styles.noteEmoji}>{note.emoji}</span>
                          <div className={styles.snippetName}>{note.title || '제목 없음'}</div>
                          <button
                            className={styles.deleteBtn}
                            onClick={(e) => { e.stopPropagation(); if (confirm('이 노트를 삭제할까요?')) onDeleteNote(note.id); }}
                            title="삭제"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                        <div className={styles.snippetMeta}>
                          <span className={styles.snippetDate}>{formatDate(note.updatedAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    className={styles.newNoteBtn}
                    style={{ marginLeft: 24 + indent }}
                    onClick={() => onNewNote(node.id)}
                  >
                    + 새 노트
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  if (isCollapsed) return null;

  return (
    <>
      <aside className={styles.sidebar} onClick={closeContext}>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${sidebarTab === 'code' ? styles.tabActive : ''}`}
            onClick={() => { onSidebarTabChange('code'); setShowAddCat(false); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            Code
          </button>
          <button
            className={`${styles.tab} ${sidebarTab === 'notes' ? styles.tabActive : ''}`}
            onClick={() => { onSidebarTabChange('notes'); setShowAddCat(false); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Notes
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={sidebarTab === 'code' ? 'Search snippets...' : '노트 검색...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {/* Meta + Add category button */}
        <div className={styles.sidebarMeta}>
          <span>
            {sidebarTab === 'code'
              ? `${snippets.length} snippet${snippets.length !== 1 ? 's' : ''}`
              : `${notes.length} 노트`}
          </span>
          <button
            className={styles.addCatBtn}
            onClick={(e) => { e.stopPropagation(); setShowAddCat((v) => !v); setNewCatColor(randomColor()); setNewCatName(''); }}
            title="새 카테고리 추가"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            카테고리
          </button>
        </div>

        {/* Add category inline form */}
        {showAddCat && (
          <div className={styles.addCatForm} onClick={(e) => e.stopPropagation()}>
            <div className={styles.addCatRow}>
              <span
                className={styles.addCatDot}
                style={{ background: newCatColor }}
                title="색상"
              />
              <input
                className={styles.addCatInput}
                placeholder="카테고리 이름"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAddCat();
                  if (e.key === 'Escape') setShowAddCat(false);
                }}
                autoFocus
              />
              <button className={styles.addCatConfirm} onClick={submitAddCat} title="추가">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button className={styles.addCatCancel} onClick={() => setShowAddCat(false)} title="취소">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <ColorSwatches onPick={setNewCatColor} />
          </div>
        )}

        {/* Category tree */}
        <div className={styles.catList}>
          {tree.map((node) => renderCategoryNode(node, 0))}
        </div>

        {/* Footer */}
        {sidebarTab === 'code' && (
          <div className={styles.sidebarFooter}>
            <button className={styles.footerBtn} onClick={onExport} title="Export library as JSON">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
            <button className={styles.footerBtn} onClick={() => fileInputRef.current?.click()} title="Import library from JSON">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
        )}

        {/* Import confirm */}
        {showImportConfirm && (
          <div className={styles.importConfirm}>
            <p className={styles.importTitle}>Import snippets</p>
            <p className={styles.importDesc}><strong>{pendingFile?.name}</strong></p>
            <div className={styles.importActions}>
              <button className={styles.importMergeBtn} onClick={() => confirmImport('merge')}>
                Merge<span>기존 유지 + 추가</span>
              </button>
              <button className={styles.importReplaceBtn} onClick={() => confirmImport('replace')}>
                Replace<span>전체 교체</span>
              </button>
            </div>
            <button className={styles.importCancelBtn} onClick={() => setShowImportConfirm(false)}>Cancel</button>
          </div>
        )}
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
                <button className={styles.ctxItem} onClick={() => {
                  const s = snippets.find((x) => x.id === contextMenu.id);
                  if (s) startRenameSnippet(s.id, s.name);
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Rename
                </button>
                <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => { onDelete(contextMenu.id); closeContext(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Delete
                </button>
              </>
            ) : contextMenu.type === 'note' ? (
              <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => { onDeleteNote(contextMenu.id); closeContext(); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete Note
              </button>
            ) : (
              <>
                <button className={styles.ctxItem} onClick={() => {
                  const c = activeCategories.find((x) => x.id === contextMenu.id);
                  if (c) startRenameCat(c.id, c.name);
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Rename
                </button>

                <div className={styles.ctxColorRow}>
                  <span className={styles.ctxColorLabel}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    색상 변경
                  </span>
                  <div className={styles.ctxColorSwatches}>
                    {CAT_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`${styles.ctxColorSwatch} ${
                          activeCategories.find((cat) => cat.id === contextMenu.id)?.color === c ? styles.ctxColorSwatchActive : ''
                        }`}
                        style={{ background: c }}
                        onClick={() => { handleChangeCategoryColor(contextMenu.id, c); closeContext(); }}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.ctxSep} />
                <button className={styles.ctxItem} onClick={() => startAddSubcat(contextMenu.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Subcategory
                </button>
                <div className={styles.ctxSep} />
                <button className={styles.ctxItem} onClick={() => { handleMoveCategoryUp(contextMenu.id); closeContext(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                  Move Up
                </button>
                <button className={styles.ctxItem} onClick={() => { handleMoveCategoryDown(contextMenu.id); closeContext(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                  Move Down
                </button>
                <div className={styles.ctxSep} />
                <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => { handleDeleteCategory(contextMenu.id); closeContext(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
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
