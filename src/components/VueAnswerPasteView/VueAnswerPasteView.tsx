import { useRef, useState } from 'react';
import { Note } from '../../types';
import { requestVueAnswer } from '../../lib/vueAnswer';
import styles from './VueAnswerPasteView.module.css';

interface VueAnswerPasteViewProps {
  note: Note;
}

type RequestStatus = 'idle' | 'processing' | 'completed' | 'failed';

export default function VueAnswerPasteView({ note }: VueAnswerPasteViewProps) {
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Prevent raw text from entering DOM, note content, localStorage, or Supabase
    e.preventDefault();

    if (inFlightRef.current) return;

    const plainText = e.clipboardData?.getData('text/plain') ?? '';
    if (!plainText.trim()) {
      setStatus('failed');
      setErrorMessage('붙여넣은 일반 텍스트가 비어 있습니다.');
      return;
    }

    inFlightRef.current = true;
    setStatus('processing');
    setErrorMessage(null);

    try {
      const result = await requestVueAnswer(plainText);
      setStatus('completed');
      setLastCompletedAt(result.createdAt);
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : '답변 생성 요청에 실패했습니다.');
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.emoji}>{note.emoji}</span>
        <div className={styles.title}>{note.title || '제목 없음'}</div>
        <span className={styles.badge}>붙여넣기 전용</span>
      </div>

      <div className={styles.body}>
        <div className={styles.card}>
          <textarea
            className={styles.pasteArea}
            value=""
            readOnly
            onPaste={handlePaste}
            placeholder="여기에 완성된 Vue 코드와 질문을 붙여넣으세요 (Ctrl/Cmd + V)&#10;붙여넣는 즉시 일반 텍스트만 읽어 1회 자동 요청되며, 원문은 저장되지 않습니다."
            aria-label="Vue 답변 생성용 붙여넣기 영역"
          />

          <div className={styles.statusRow} aria-live="polite">
            {status === 'idle' && (
              <span className={styles.statusIdle}>대기 중 · 붙여넣기 시 자동으로 요청됩니다</span>
            )}
            {status === 'processing' && (
              <span className={styles.statusProcessing}>처리 중...</span>
            )}
            {status === 'completed' && (
              <span className={styles.statusCompleted}>
                완료 · Vue Guide에서 답변을 확인할 수 있습니다
                {lastCompletedAt ? ` (${new Date(lastCompletedAt).toLocaleTimeString('ko-KR')})` : ''}
              </span>
            )}
            {status === 'failed' && (
              <span className={styles.statusFailed}>
                실패 · {errorMessage || '요청 중 오류가 발생했습니다.'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

