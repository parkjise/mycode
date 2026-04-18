import { AppState } from '../types';

/** URL 해시에 현재 스니펫 상태를 인코딩 */
export function encodeSnippetToUrl(state: AppState): string {
  const payload = JSON.stringify({
    c: state.code,
    l: state.language,
    f: state.fileName,
    t: state.theme,
    fs: state.fontSize,
    p: state.padding,
    bg: state.backgroundStyle,
    w: state.cardWidth,
  });
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

/** URL 해시에서 스니펫 상태 복원 */
export function decodeSnippetFromUrl(): Partial<AppState> | null {
  try {
    const hash = window.location.hash;
    const match = hash.match(/^#s=(.+)$/);
    if (!match) return null;
    const json = decodeURIComponent(escape(atob(match[1])));
    const d = JSON.parse(json);
    return {
      code:            d.c  ?? '',
      language:        d.l  ?? 'typescript',
      fileName:        d.f  ?? 'snippet',
      theme:           d.t  ?? 'dark',
      fontSize:        d.fs ?? 14,
      padding:         d.p  ?? 32,
      backgroundStyle: d.bg ?? 'gradient',
      cardWidth:       d.w  ?? 720,
    };
  } catch {
    return null;
  }
}

/** URL 해시 제거 */
export function clearUrlHash(): void {
  history.replaceState(null, '', window.location.pathname);
}
