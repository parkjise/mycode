import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Note, Category } from '../../types';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  note: Note;
  categories: Category[];
  onSave: (note: Note) => void;
  onDelete: (id: string) => void;
  onAddCategory: (name: string, color: string) => string | Promise<string>;
  theme: 'dark' | 'light';
}

const EMOJI_OPTIONS = ['📝', '📌', '💡', '🔥', '⭐', '✅', '📖', '🎯', '🚀', '💻', '🎨', '📊', '🔧', '📦', '🌐'];

const CAT_COLORS = ['#8888a8','#f7df1e','#3178c6','#61dafb','#ff7262','#10b981','#f59e0b','#ef4444'];

export default function NoteEditor({ note, categories, onSave, onDelete, onAddCategory, theme }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [emoji, setEmoji] = useState(note.emoji);
  // 카테고리가 목록에 없으면 첫 번째 카테고리로 자동 복구
  const resolveCategory = (id: string) =>
    categories.some((c) => c.id === id) ? id : (categories[0]?.id ?? id);
  const [categoryId, setCategoryId] = useState(() => resolveCategory(note.categoryId));
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[0]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef(note);
  noteRef.current = note;
  const titleRef = useRef(title);
  titleRef.current = title;
  const emojiRef = useRef(emoji);
  emojiRef.current = emoji;
  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '내용을 입력하세요...' }),
    ],
    content: note.content,
    editorProps: {
      attributes: { class: styles.proseMirror },
    },
  });

  // Reset editor when note changes
  useEffect(() => {
    if (!editor) return;
    setTitle(note.title);
    setEmoji(note.emoji);
    setCategoryId(resolveCategory(note.categoryId));
    if (editor.getHTML() !== note.content) {
      editor.commands.setContent(note.content || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!editor) return;
      const updated: Note = {
        ...noteRef.current,
        title: titleRef.current,
        emoji: emojiRef.current,
        categoryId: categoryIdRef.current,
        content: editor.getHTML(),
        updatedAt: Date.now(),
      };
      onSave(updated);
      setSavedAt(Date.now());
    }, 600);
  }, [editor, onSave]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => triggerSave();
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, triggerSave]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    triggerSave();
  };

  const handleEmojiSelect = (e: string) => {
    setEmoji(e);
    setShowEmojiPicker(false);
    triggerSave();
  };

  const handleCategoryChange = (v: string) => {
    setCategoryId(v);
    triggerSave();
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const id = await Promise.resolve(onAddCategory(newCatName.trim(), newCatColor));
    setCategoryId(id);
    setShowNewCat(false);
    setNewCatName('');
    triggerSave();
  };

  const wordCount = editor ? editor.getText().trim().split(/\s+/).filter(Boolean).length : 0;

  const ToolbarBtn = ({ onClick, active, title: t, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      className={`${styles.toolbarBtn} ${active ? styles.toolbarBtnActive : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={t}
    >
      {children}
    </button>
  );

  if (!editor) return null;

  return (
    <div className={styles.wrapper} data-theme={theme}>
      {/* Note meta header */}
      <div className={styles.noteHeader}>
        <div className={styles.noteMeta}>
          <div className={styles.emojiWrap}>
            <button className={styles.emojiBtn} onClick={() => setShowEmojiPicker((v) => !v)} title="이모지 변경">
              {emoji}
            </button>
            {showEmojiPicker && (
              <div className={styles.emojiPicker}>
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} className={styles.emojiOption} onClick={() => handleEmojiSelect(e)}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <input
            className={styles.titleInput}
            placeholder="제목 없음"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
        </div>
        <div className={styles.noteMeta2}>
          <div className={styles.categoryWrap}>
            <select
              className={styles.categorySelect}
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              className={styles.addCatBtn}
              onClick={() => { setShowNewCat((v) => !v); setNewCatName(''); }}
              title="새 카테고리 추가"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          {showNewCat && (
            <div className={styles.newCatForm}>
              <input
                className={styles.newCatInput}
                placeholder="카테고리 이름"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowNewCat(false); }}
                autoFocus
              />
              <div className={styles.newCatColors}>
                {CAT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`${styles.colorDot} ${newCatColor === c ? styles.colorDotActive : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewCatColor(c)}
                  />
                ))}
              </div>
              <div className={styles.newCatActions}>
                <button className={styles.newCatConfirm} onClick={handleAddCategory} disabled={!newCatName.trim()}>만들기</button>
                <button className={styles.newCatCancel} onClick={() => setShowNewCat(false)}>취소</button>
              </div>
            </div>
          )}
          <span className={styles.saveStatus}>
            {savedAt ? '저장됨' : ''}
          </span>
          <button
            className={styles.deleteNoteBtn}
            onClick={() => { if (confirm('이 노트를 삭제할까요?')) onDelete(note.id); }}
            title="노트 삭제"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1">H1</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2">H2</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3">H3</ToolbarBtn>
        </div>
        <div className={styles.toolbarSep} />
        <div className={styles.toolbarGroup}>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게 (⌘B)"><b>B</b></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임 (⌘I)"><i>I</i></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄 (⌘U)"><u>U</u></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선"><s>S</s></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="형광펜">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.232 5.232l3.536 3.536-9.192 9.192a1 1 0 0 1-.384.242l-4 1.333a.5.5 0 0 1-.63-.63l1.333-4a1 1 0 0 1 .242-.384l9.095-9.289zM19 2l3 3-1.768 1.768-3.536-3.536L19 2z"/></svg>
          </ToolbarBtn>
        </div>
        <div className={styles.toolbarSep} />
        <div className={styles.toolbarGroup}>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 목록">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor"/><path d="M4 10h2" stroke="currentColor"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor"/></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="체크리스트">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </ToolbarBtn>
        </div>
        <div className={styles.toolbarSep} />
        <div className={styles.toolbarGroup}>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="코드 블록">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용문">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">—</ToolbarBtn>
        </div>
        <div className={styles.toolbarSep} />
        <div className={styles.toolbarGroup}>
          <ToolbarBtn
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="표 삽입"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          </ToolbarBtn>
          {editor.isActive('table') && (
            <>
              <ToolbarBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="열 추가">+열</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="행 추가">+행</ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().deleteTable().run()} title="표 삭제">×표</ToolbarBtn>
            </>
          )}
        </div>
        <div className={styles.toolbarSep} />
        <div className={styles.toolbarGroup}>
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (⌘Z)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (⌘⇧Z)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
          </ToolbarBtn>
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.wordCount}>{wordCount} words</span>
        </div>
      </div>

      {/* Editor content */}
      <div className={styles.editorWrap} onClick={() => setShowEmojiPicker(false)}>
        <EditorContent editor={editor} className={styles.editorContent} />
      </div>
    </div>
  );
}
