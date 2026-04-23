import { LanguageOption } from '../types';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { key: 'javascript', label: 'JavaScript', syntaxLang: 'javascript' },
  { key: 'typescript', label: 'TypeScript', syntaxLang: 'typescript' },
  { key: 'jsx', label: 'JSX', syntaxLang: 'jsx' },
  { key: 'tsx', label: 'TSX', syntaxLang: 'tsx' },
  { key: 'styled-components', label: 'Styled Components', syntaxLang: 'css' },
  { key: 'mixins', label: 'SCSS Mixins', syntaxLang: 'scss' },
  { key: 'css-variables', label: 'CSS Variables', syntaxLang: 'css' },
  { key: 'theme', label: 'Theme Config', syntaxLang: 'typescript' },
  { key: 'json', label: 'JSON', syntaxLang: 'json' },
  { key: 'bash', label: 'Bash / Shell', syntaxLang: 'bash' },
];

export const DEFAULT_CODE = '';

export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 20;
export const FONT_SIZE_DEFAULT = 14;

export const PADDING_MIN = 16;
export const PADDING_MAX = 64;
export const PADDING_DEFAULT = 32;

export const CARD_WIDTH_MIN = 400;
export const CARD_WIDTH_MAX = 960;
export const CARD_WIDTH_DEFAULT = 720;
