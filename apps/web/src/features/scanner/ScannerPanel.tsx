import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import samples from '../../data/sampleScans.json';
import { DietChips } from '../../components/DietChips';
import { useAppStore } from '../../store/useAppStore';
import { CustomRestrictions } from './CustomRestrictions';
import { matchIngredients } from './matchIngredients';
import { LOW_CONFIDENCE, OcrAbortedError, loadOcrProvider, type OcrProgress } from './ocr';
import { ACCEPTED_IMAGES, MAX_IMAGE_BYTES, prepareImage } from './ocr/image';
import { explainBody, explainWithAi } from './scanApi';
import { ScanResultCard, type AiState } from './ScanResultCard';
import { StaffCard } from './StaffCard';

type Source = 'sample' | 'photo' | 'typed';

type OcrState =
  | { status: 'idle' }
  | { status: 'working'; progress: OcrProgress | null }
  | { status: 'done'; confidence: number }
  | { status: 'error'; message: string };

const FIELD =
  'mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40';

/**
 * Veg-Safe scanner: photo → on-device OCR → editable text → rule-based
 * result (three states). Sample scans work without a camera or OCR.
 */
export default function ScannerPanel() {
  const { t } = useTranslation();
  const id = useId();
  const diet = useAppStore((s) => s.diet);
  const language = useAppStore((s) => s.language);
  const custom = useAppStore((s) => s.customRestrictions);
  const [text, setText] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [ocr, setOcr] = useState<OcrState>({ status: 'idle' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [staffOpen, setStaffOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );

  const result = useMemo(
    () => (text.trim() ? matchIngredients(text, diet, custom) : null),
    [text, diet, custom],
  );
  // An AI explanation belongs to one exact result; any change makes it stale.
  useEffect(() => setAi({ status: 'idle' }), [text, diet, custom]);

  // Low-confidence OCR is never judged until the traveller has checked the text.
  const lowConfidence =
    source === 'photo' && ocr.status === 'done' && ocr.confidence < LOW_CONFIDENCE && !edited;
  const verdict = lowConfidence ? 'unverified' : (result?.verdict ?? 'unverified');

  const pickSample = (sid: string) => {
    const s = samples.scans.find((x) => x.id === sid);
    if (!s) return;
    abortRef.current?.abort();
    setOcr({ status: 'idle' });
    setPhoto(null);
    setSource('sample');
    setSampleId(sid);
    setText(s.menuText);
    setEdited(false);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setOcr({ status: 'error', message: t('scanner.ocr.notImage') });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setOcr({ status: 'error', message: t('scanner.ocr.tooBig') });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhoto(URL.createObjectURL(file));
    setSource('photo');
    setSampleId(null);
    setText('');
    setEdited(false);
    setOcr({ status: 'working', progress: null });
    try {
      const [provider, image] = await Promise.all([loadOcrProvider(), prepareImage(file)]);
      const out = await provider.recognize(image, {
        signal: controller.signal,
        onProgress: (progress) => setOcr({ status: 'working', progress }),
      });
      if (controller.signal.aborted) return;
      setText(out.text);
      setOcr({ status: 'done', confidence: out.confidence });
    } catch (err) {
      if (err instanceof OcrAbortedError || controller.signal.aborted) {
        setOcr({ status: 'idle' });
        return;
      }
      setOcr({ status: 'error', message: t('scanner.ocr.failed') });
    }
  };

  const cancelOcr = () => {
    abortRef.current?.abort();
    setOcr({ status: 'idle' });
  };

  const explain = async () => {
    if (!result) return;
    setAi({ status: 'loading' });
    const res = await explainWithAi(explainBody(text, result, diet, language, custom));
    setAi(
      'error' in res
        ? { status: 'error', code: res.error.code }
        : { status: 'done', explanation: res.explanation },
    );
  };

  const percent =
    ocr.status === 'working' && ocr.progress ? Math.round(ocr.progress.progress * 100) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <section aria-labelledby={`${id}-diet`}>
          <h3 id={`${id}-diet`} className="text-sm font-semibold text-plum">
            {t('scanner.dietTitle')}
          </h3>
          <div className="mt-2">
            <DietChips />
          </div>
        </section>

        <section aria-labelledby={`${id}-input`} className="flex flex-col gap-3">
          <h3 id={`${id}-input`} className="text-sm font-semibold text-plum">
            {t('scanner.inputTitle')}
          </h3>
          <label className="btn-primary cursor-pointer self-start !px-5 !py-2.5 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rose">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 100-8 4 4 0 000 8z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            {t('scanner.photo')}
            <input
              type="file"
              accept={ACCEPTED_IMAGES}
              capture="environment"
              onChange={onFile}
              className="sr-only"
            />
          </label>
          <p className="text-xs text-mist">{t('scanner.ocr.privacy')}</p>

          {ocr.status === 'working' ? (
            <div role="status" className="rounded-xl bg-blush/70 p-3 text-sm text-plum">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {ocr.progress?.stage === 'recognizing'
                    ? t('scanner.ocr.reading')
                    : t('scanner.ocr.loading')}
                  {percent !== null ? ` ${percent}%` : ''}
                </span>
                <button
                  type="button"
                  onClick={cancelOcr}
                  className="text-xs font-semibold text-rose underline-offset-4 hover:underline"
                >
                  {t('trip.cancel')}
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-rose transition-[width] duration-300"
                  style={{ width: `${percent ?? 5}%` }}
                />
              </div>
            </div>
          ) : null}
          {ocr.status === 'error' ? (
            <p role="alert" className="rounded-xl bg-torii/10 p-3 text-sm font-semibold text-torii">
              {ocr.message}
            </p>
          ) : null}
          {photo ? (
            <img
              src={photo}
              alt={t('scanner.photoAlt')}
              className="max-h-48 w-auto self-start rounded-xl border border-blush object-contain"
            />
          ) : null}

          <div>
            <p className="text-xs font-semibold text-plum">
              {t('scanner.samplesTitle')}{' '}
              <span className="ml-1 rounded-full bg-mist/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mist">
                {t('scanner.demoLabel')}
              </span>
            </p>
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="group"
              aria-label={t('scanner.samplesTitle')}
            >
              {samples.scans.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sampleId === s.id}
                  onClick={() => pickSample(s.id)}
                  title={s.en}
                  className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                    sampleId === s.id ? 'bg-plum text-paper' : 'bg-blush text-plum hover:bg-petal'
                  }`}
                >
                  <span lang="ja">{s.ja}</span>
                  <span className="sr-only"> ({s.en})</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-text`} className="text-xs font-semibold text-plum">
              {t('scanner.textLabel')}
            </label>
            <textarea
              id={`${id}-text`}
              lang="ja"
              value={text}
              rows={4}
              maxLength={2000}
              onChange={(e) => {
                setText(e.target.value);
                setEdited(true);
                if (source !== 'photo') {
                  setSource('typed');
                  setSampleId(null);
                }
              }}
              placeholder={t('scanner.textPlaceholder')}
              aria-describedby={`${id}-text-hint`}
              className={`${FIELD} resize-y`}
            />
            <p id={`${id}-text-hint`} className="mt-1 text-xs text-mist">
              {source === 'photo' ? t('scanner.textHintPhoto') : t('scanner.textHint')}
            </p>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4">
        {result ? (
          <ScanResultCard
            result={result}
            verdict={verdict}
            lowConfidence={lowConfidence}
            sample={source === 'sample'}
            ai={ai}
            onExplain={explain}
            onStaffCard={() => setStaffOpen(true)}
          />
        ) : (
          <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-petal p-6 text-center text-sm text-mist">
            <p>{t('scanner.empty')}</p>
          </div>
        )}
        <CustomRestrictions />
        {result ? null : (
          <button
            type="button"
            onClick={() => setStaffOpen(true)}
            className="self-start text-sm font-semibold text-rose underline-offset-4 hover:underline"
          >
            {t('scanner.staff.openPlain')}
          </button>
        )}
      </div>

      <StaffCard
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        result={result}
        ai={ai.status === 'done' ? ai.explanation : null}
      />
    </div>
  );
}
