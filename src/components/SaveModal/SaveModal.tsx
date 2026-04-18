import { useState, useEffect, useRef } from 'react';
import { Category } from '../../types';
import styles from './SaveModal.module.css';

interface SaveModalProps {
  isOpen: boolean;
  categories: Category[];
  defaultName: string;
  defaultCategoryId: string;
  isUpdate: boolean;
  onConfirm: (name: string, categoryId: string) => void;
  onCancel: () => void;
  onAddCategory: (name: string, color: string) => string;
}

const CATEGORY_COLORS = [
  '#8888a8', '#f7df1e', '#3178c6', '#61dafb',
  '#ff7262', '#4ade80', '#fb923c', '#c084fc',
];

export default function SaveModal({
  isOpen,
  categories,
  defaultName,
  defaultCategoryId,
  isUpdate,
  onConfirm,
  onCancel,
  onAddCategory,
}: SaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [categoryId, setCategoryId] = useState(defaultCategoryId || 'general');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setCategoryId(defaultCategoryId || 'general');
      setShowNewCat(false);
      setNewCatName('');
      setTimeout(() => nameRef.current?.select(), 50);
    }
  }, [isOpen, defaultName, defaultCategoryId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim(), categoryId);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const id = onAddCategory(newCatName.trim(), newCatColor);
    setCategoryId(id);
    setShowNewCat(false);
    setNewCatName('');
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>{isUpdate ? 'Update Snippet' : 'Save Snippet'}</h3>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Snippet Name</label>
            <input
              ref={nameRef}
              className={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auth Hook"
              required
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Category</label>
              <button
                type="button"
                className={styles.addCatBtn}
                onClick={() => setShowNewCat((v) => !v)}
              >
                + New
              </button>
            </div>

            {showNewCat ? (
              <div className={styles.newCatForm}>
                <input
                  className={styles.input}
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  autoFocus
                />
                <div className={styles.colorRow}>
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.colorDot} ${newCatColor === c ? styles.colorDotActive : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewCatColor(c)}
                    />
                  ))}
                </div>
                <div className={styles.newCatActions}>
                  <button
                    type="button"
                    className={styles.confirmCatBtn}
                    onClick={handleAddCategory}
                    disabled={!newCatName.trim()}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    className={styles.cancelCatBtn}
                    onClick={() => setShowNewCat(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.catGrid}>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.catChip} ${categoryId === cat.id ? styles.catChipActive : ''}`}
                    onClick={() => setCategoryId(cat.id)}
                    style={
                      categoryId === cat.id
                        ? {
                            borderColor: cat.color,
                            color: cat.color,
                            background: `${cat.color}18`,
                          }
                        : {}
                    }
                  >
                    <span
                      className={styles.catDot}
                      style={{ background: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.saveBtn} disabled={!name.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {isUpdate ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
