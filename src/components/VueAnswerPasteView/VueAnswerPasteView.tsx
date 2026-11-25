import { useRef, useState } from 'react';
import { Note } from '../../types';
import { checkCodexBridge, requestVueAnswer, useCodexBridge } from '../../lib/vueAnswer';
import type { VueAnswerCreateResponse } from '../../lib/codexRelay';
import styles from './VueAnswerPasteView.module.css';

interface VueAnswerPasteViewProps {
  note: Note;
}

type RequestStatus = 'idle' | 'processing' | 'completed' | 'failed';

export default function VueAnswerPasteView({ note }: VueAnswerPasteViewProps) {
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completion, setCompletion] = useState<VueAnswerCreateResponse | null>(null);
  const [connection, setConnection] = useState('');
  const [checking, setChecking] = useState(false);
  const inFlightRef = useRef(false);

  const checkConnection = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setChecking(true);
    setConnection('Mac 연결 확인 중…');
    try {
      await checkCodexBridge();
      setConnection('Mac 연결됨');
    } catch (error) {
      setConnection(error instanceof Error ? error.message : '답변을 처리하는 Mac에 연결하지 못했어요.');
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  };

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
      setCompletion(result);
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
          {!useCodexBridge && (
            <p>모의 답변 테스트에는 공개 코드나 가짜 예제만 사용해 주세요.</p>
          )}
          {useCodexBridge && (
            <div className={styles.statusRow}>
              <button type="button" disabled={checking || status === 'processing'} onClick={checkConnection}>Mac 연결 확인</button>
              <span role="status">{connection}</span>
            </div>
          )}
          <textarea
            className={styles.pasteArea}
            value=""
            readOnly
            onPaste={handlePaste}
            placeholder="Vue 코드와 질문을 붙여넣으세요 (Ctrl/Cmd + V)&#10;Mac에 파일로 저장하려면 첫 줄에 llm만 적어 주세요."
            aria-label="Vue 답변 생성용 붙여넣기 영역"
          />

          <div className={styles.statusRow} aria-live="polite">
            {status === 'idle' && (
              <span className={styles.statusIdle}>대기 중 · 붙여넣기 시 자동으로 요청됩니다</span>
            )}
            {status === 'processing' && (
              <span className={styles.statusProcessing}>처리 중...</span>
            )}
            {status === 'completed' && completion && (
              <span className={styles.statusCompleted}>
                {completion.localFileCount
                  ? `완료 · Mac의 llm 폴더에 ${completion.localFileCount}개 파일을 저장했어요.`
                  : '완료 · Vue Guide에서 답변을 확인할 수 있습니다'}
                {' '}{`(${new Date(completion.createdAt).toLocaleTimeString('ko-KR')})`}
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

