import { useRef, useState } from 'react';
import { Note } from '../../types';
import { readLlmRequest } from '../../../shared/codex-relay.mjs';
import { checkCodexBridge, requestVueAnswer, useCodexBridge } from '../../lib/vueAnswer';
import type { VueAnswerCreateResponse } from '../../lib/codexRelay';
import styles from './VueAnswerPasteView.module.css';

type VueAnswerPasteViewProps = { note: Note; localOnly?: false } | { note?: never; localOnly: true };

type RequestStatus = 'idle' | 'processing' | 'completed' | 'failed';

export default function VueAnswerPasteView({ note, localOnly = false }: VueAnswerPasteViewProps) {
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

  const submit = async (readText: () => string | Promise<string>) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('processing');
    setErrorMessage(null);

    try {
      const plainText = await readText();
      if (!plainText.trim()) throw new Error('붙여넣은 일반 텍스트가 비어 있습니다.');
      const text = localOnly && readLlmRequest(plainText) === null ? `llm\n${plainText}` : plainText;
      const result = await requestVueAnswer(text, localOnly);
      setStatus('completed');
      setCompletion(result);
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : '답변 생성 요청에 실패했습니다.');
    } finally {
      inFlightRef.current = false;
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    void submit(() => event.clipboardData.getData('text/plain'));
  };

  const pasteFromClipboard = () => submit(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      throw new Error('클립보드를 읽지 못했어요. 입력칸을 길게 누른 뒤 붙여넣기를 선택해 주세요.');
    }
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {note && <span className={styles.emoji}>{note.emoji}</span>}
        <div className={styles.title}>{localOnly ? 'LLM 작업' : note?.title || '제목 없음'}</div>
        <span className={styles.badge}>붙여넣기 전용</span>
      </div>

      <div className={styles.body}>
        <div className={styles.card}>
          {localOnly && useCodexBridge && (
            <p className={styles.description}>
              기존 파일을 수정하려면 첫 줄에 <code>파일: src/App.vue</code>를 적고 다음 줄에 수정 내용을 적어 주세요.
              {' '}생성하거나 수정한 파일은 공개 GitHub 저장소에 커밋되고 GitHub Pages에 배포돼요.
            </p>
          )}
          {!useCodexBridge && <p>{localOnly
            ? 'LLM 작업은 Mac Codex 연결이 필요해요.'
            : '모의 답변 테스트에는 공개 코드나 가짜 예제만 사용해 주세요.'}</p>}
          {useCodexBridge && (
            <div className={styles.statusRow}>
              {localOnly && <button className={styles.pasteButton} type="button" disabled={checking || status === 'processing'} onClick={pasteFromClipboard}>붙여넣고 요청</button>}
              <button className={styles.connectionButton} type="button" disabled={checking || status === 'processing'} onClick={checkConnection}>Mac 연결 확인</button>
              <span role="status">{connection}</span>
            </div>
          )}
          <textarea
            className={styles.pasteArea}
            value=""
            readOnly={!localOnly}
            onChange={localOnly ? (event) => { event.currentTarget.value = ''; } : undefined}
            onPaste={handlePaste}
            placeholder={localOnly
              ? '여기에 작업 지시를 붙여넣으세요.'
              : 'Vue 코드와 질문을 붙여넣으세요 (Ctrl/Cmd + V)'}
            aria-label={localOnly ? 'LLM 작업 지시 붙여넣기 영역' : 'Vue 답변 생성용 붙여넣기 영역'}
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
          {status === 'completed' && completion?.publication?.status === 'pushed' && (
            <div className={styles.statusRow}>
              <span>커밋 완료 · 배포 요청됨</span>
              <a href={completion.publication.commitUrl} target="_blank" rel="noreferrer">커밋 보기</a>
              <a href={completion.publication.actionsUrl} target="_blank" rel="noreferrer">배포 상태</a>
            </div>
          )}
          {status === 'completed' && completion?.publication?.status === 'failed' && (
            <p className={styles.statusFailed} role="status">자동 커밋에 실패했어요. 저장한 파일은 Mac의 llm 폴더에 있어요.</p>
          )}
        </div>
      </div>
    </div>
  );
}

