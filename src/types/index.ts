export type AppTheme = 'dark' | 'light';

export type BackgroundStyle = 'solid' | 'gradient' | 'pattern';

export type LanguageKey =
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'styled-components'
  | 'mixins'
  | 'css-variables'
  | 'theme'
  | 'json'
  | 'bash';

export interface LanguageOption {
  key: LanguageKey;
  label: string;
  syntaxLang: string;
}

export interface AppState {
  code: string;
  language: LanguageKey;
  fileName: string;
  theme: AppTheme;
  fontSize: number;
  padding: number;
  backgroundStyle: BackgroundStyle;
  cardWidth: number;
}

// ─── Snippet Library Types ─────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Snippet {
  id: string;
  name: string;
  categoryId: string;
  code: string;
  language: LanguageKey;
  fileName: string;
  theme: AppTheme;
  fontSize: number;
  padding: number;
  backgroundStyle: BackgroundStyle;
  cardWidth: number;
  createdAt: number;
  updatedAt: number;
}
