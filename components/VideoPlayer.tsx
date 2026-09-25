"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, CirclePlay, CircleX, ClipboardCheck, ListVideo, Lock, PlayCircle, RefreshCw, RotateCcw, Send } from "lucide-react";
import Hls from "hls.js";

type Lesson = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
  quiz: null | {
    passingScore: number;
    questions: Array<{ id: string; prompt: string; options: string[] }>;
    lastAttempt: QuizResult | null;
  };
};

type VideoPlayerProps = {
  videos: Lesson[];
  initialCompletedVideoIds: string[];
  initialWatchedVideoIds: string[];
  isAdmin: boolean;
  watermark: string;
};

type QuizResult = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  passingScore: number;
  attemptedAt?: string | null;
  answers: Array<{
    questionId: string;
    optionIndex: number;
    isCorrect: boolean;
  }>;
};

export default function VideoPlayer({ videos, initialCompletedVideoIds, initialWatchedVideoIds, isAdmin, watermark }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completedIds, setCompletedIds] = useState(initialCompletedVideoIds);
  const [watchedIds, setWatchedIds] = useState(initialWatchedVideoIds);
  const firstAvailable = useMemo(() => {
    if (isAdmin) return videos[0]?.id || "";
    return videos.find((video, index) => !completedIds.includes(video.id) && videos.slice(0, index).every((previous) => completedIds.includes(previous.id)))?.id
      || videos.at(-1)?.id
      || "";
  }, [completedIds, isAdmin, videos]);
  const [selectedId, setSelectedId] = useState(firstAvailable);
  const [src, setSrc] = useState("");
  const [playbackType, setPlaybackType] = useState<"file" | "hls">("file");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [quizVisible, setQuizVisible] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizError, setQuizError] = useState("");
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const selectedIndex = videos.findIndex((video) => video.id === selectedId);
  const selected = videos[selectedIndex] || videos[0];
  const selectedQuizReady = Boolean(selected?.quiz && (
    isAdmin
    || watchedIds.includes(selected.id)
    || selected.quiz.lastAttempt
  ));

  function isUnlocked(index: number) {
    return isAdmin || videos.slice(0, index).every((video) => completedIds.includes(video.id));
  }

  useEffect(() => {
    setQuizVisible(selectedQuizReady);
    setQuizAnswers({});
    setQuizResult(selected?.quiz?.lastAttempt || null);
    setQuizError("");
  }, [selectedId, selectedQuizReady, selected?.quiz?.lastAttempt]);

  useEffect(() => {
    if (!selected?.id) return;
    const controller = new AbortController();

    async function loadVideo() {
      setLoading(true);
      setBuffering(false);
      setError("");
      setSrc("");
      setPlaybackType("file");
      const response = await fetch(`/api/video/play?videoId=${encodeURIComponent(selected.id)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      setLoading(false);

      if (!response.ok) {
        setError(payload?.error || "No se pudo cargar la lección.");
        return;
      }

      setPlaybackType(payload.type === "hls" ? "hls" : "file");
      setSrc(payload.url);
      setBuffering(true);
    }

    loadVideo().catch((loadError) => {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setLoading(false);
      setError("No se pudo conectar con el video.");
    });
    return () => controller.abort();
  }, [selected?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || playbackType !== "hls") return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setBuffering(false);
      setError("Este navegador no permite reproducción HLS.");
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      capLevelToPlayerSize: true,
      startLevel: 0,
      maxBufferLength: 300,
      maxMaxBufferLength: 600,
      maxBufferSize: 220 * 1024 * 1024,
      backBufferLength: 60,
      abrEwmaDefaultEstimate: 1_200_000,
      abrBandWidthFactor: 0.8,
      abrBandWidthUpFactor: 0.65,
      manifestLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 6,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }
      setBuffering(false);
      setError("No se pudo continuar la reproducción adaptativa.");
      hls.destroy();
    });

    return () => hls.destroy();
  }, [playbackType, src]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) videoRef.current?.pause();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function completeLesson() {
    if (!selected || completing || completedIds.includes(selected.id)) {
      if (selectedIndex < videos.length - 1 && isUnlocked(selectedIndex + 1)) setSelectedId(videos[selectedIndex + 1].id);
      return;
    }

    setCompleting(true);
    const response = await fetch("/api/video/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: selected.id }),
    });
    const payload = await response.json().catch(() => null);
    setCompleting(false);

    if (!response.ok) {
      setError(payload?.error || "No se pudo guardar el progreso.");
      return;
    }

    const updated = payload.completedVideoIds as string[];
    setWatchedIds((current) => current.includes(selected.id) ? current : [...current, selected.id]);
    setCompletedIds(updated);
    if (payload.requiresQuiz) {
      setQuizVisible(true);
      setQuizError("");
      return;
    }
    if (selectedIndex < videos.length - 1) setSelectedId(videos[selectedIndex + 1].id);
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.quiz || submittingQuiz) return;
    if (Object.keys(quizAnswers).length !== selected.quiz.questions.length) {
      setQuizError("Responde todas las preguntas antes de calificar.");
      return;
    }

    setSubmittingQuiz(true);
    setQuizError("");
    const response = await fetch("/api/video/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: selected.id,
        answers: selected.quiz.questions.map((question) => ({
          questionId: question.id,
          optionIndex: quizAnswers[question.id],
        })),
      }),
    });
    const payload = await response.json().catch(() => null);
    setSubmittingQuiz(false);

    if (!response.ok) {
      setQuizError(payload?.error || "No se pudo calificar la evaluación.");
      return;
    }

    setQuizResult(payload as QuizResult);
    setCompletedIds(payload.completedVideoIds || completedIds);
  }

  function retryQuiz() {
    setQuizAnswers({});
    setQuizResult(null);
    setQuizError("");
  }

  function chooseLesson(index: number) {
    if (!isUnlocked(index)) return;
    setSelectedId(videos[index].id);
  }

  const completionPercent = videos.length ? Math.round((completedIds.filter((id) => videos.some((video) => video.id === id)).length / videos.length) * 100) : 0;

  return (
    <div className="course-player">
      <div className="player-column">
        <div className="current-lesson-heading">
          <div>
            <span>Lección {selectedIndex + 1} de {videos.length}</span>
            <h2>{selected?.title}</h2>
          </div>
          {selected?.durationLabel ? <span className="lesson-duration">{selected.durationLabel}</span> : null}
        </div>

        <div className="video-frame" onContextMenu={(event) => event.preventDefault()}>
          {src ? (
            <>
              <video
                key={selected.id}
                ref={videoRef}
                src={playbackType === "file" ? src : undefined}
                title={selected.title}
                controls
                controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
                disablePictureInPicture
                preload="auto"
                playsInline
                onCanPlay={() => setBuffering(false)}
                onEnded={completeLesson}
                onError={() => {
                  setBuffering(false);
                  setError("El formato del video no es compatible con este navegador. Usa MP4 con video H.264 y audio AAC.");
                }}
                onPlaying={() => setBuffering(false)}
                onStalled={() => setBuffering(true)}
                onWaiting={() => setBuffering(true)}
              />
              {buffering ? (
                <div className="video-buffering" role="status">
                  <RefreshCw className="spin" size={24} />
                  <span>Cargando video</span>
                </div>
              ) : null}
              <div className="watermark-layer" aria-hidden="true">
                <span>{watermark}</span>
              </div>
            </>
          ) : (
            <div className="video-placeholder">
              {loading ? <RefreshCw className="spin" size={34} /> : <PlayCircle size={42} />}
            </div>
          )}
        </div>

        {selected?.description ? <p className="lesson-description">{selected.description}</p> : null}
        {error ? <p className="notice danger">{error}</p> : null}

        {selected?.quiz ? (
          quizVisible ? (
            <form className="lesson-quiz" onSubmit={submitQuiz}>
              <div className="lesson-quiz-header">
                <div>
                  <span className="eyebrow"><ClipboardCheck size={15} /> Evaluación de la lección</span>
                  <h3>Demuestra lo aprendido</h3>
                  <p>Necesitas al menos {selected.quiz.passingScore}% para habilitar la siguiente lección.</p>
                </div>
                <strong>{selected.quiz.questions.length} preguntas</strong>
              </div>

              {quizResult ? (
                <>
                  <div className={`quiz-result ${quizResult.passed ? "is-passed" : "is-failed"}`} role="status">
                    {quizResult.passed ? <CheckCircle2 size={26} /> : <RotateCcw size={26} />}
                    <div>
                      <strong>{quizResult.passed ? "Evaluación aprobada" : "Aún no alcanzas la nota"}</strong>
                      <span>{quizResult.score}% · {quizResult.correct} de {quizResult.total || selected.quiz.questions.length} respuestas correctas</span>
                    </div>
                    <button className="button ghost" type="button" onClick={retryQuiz}>
                      <RotateCcw size={16} /> {quizResult.passed ? "Responder nuevamente" : "Intentar de nuevo"}
                    </button>
                  </div>

                  {quizResult.answers.length ? (
                    <div className="quiz-answer-review" aria-label="Revisión de respuestas">
                      {selected.quiz.questions.map((question, questionIndex) => {
                        const answer = quizResult.answers.find((item) => item.questionId === question.id);
                        const answerText = answer === undefined ? "Sin respuesta registrada" : question.options[answer.optionIndex];
                        return (
                          <article className="quiz-review-item" key={question.id}>
                            <div className="quiz-review-question">
                              <span>{questionIndex + 1}</span>
                              <strong>{question.prompt}</strong>
                            </div>
                            <div className={`quiz-review-answer ${answer?.isCorrect ? "is-correct" : "is-incorrect"}`}>
                              {answer?.isCorrect ? <CheckCircle2 size={19} /> : <CircleX size={19} />}
                              <div>
                                <small>Tu respuesta</small>
                                <strong>{answerText}</strong>
                              </div>
                              <span>{answer?.isCorrect ? "Correcta" : "Incorrecta"}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="notice compact">Este resultado es anterior a la revisión detallada. Puedes responder nuevamente para ver tus respuestas.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="student-question-list">
                    {selected.quiz.questions.map((question, questionIndex) => (
                      <fieldset className="student-question" key={question.id}>
                        <legend><span>{questionIndex + 1}</span>{question.prompt}</legend>
                        <div className="student-options">
                          {question.options.map((option, optionIndex) => (
                            <label
                              className={`student-option ${quizAnswers[question.id] === optionIndex ? "is-selected" : ""}`}
                              key={`${question.id}-${optionIndex}`}
                            >
                              <input
                                type="radio"
                                name={`answer-${question.id}`}
                                checked={quizAnswers[question.id] === optionIndex}
                                onChange={() => setQuizAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                              />
                              <span>{String.fromCharCode(65 + optionIndex)}</span>
                              <strong>{option}</strong>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  {quizError ? <p className="notice danger" role="alert">{quizError}</p> : null}
                  <button className="button quiz-submit" type="submit" disabled={submittingQuiz}>
                    <Send size={17} /> {submittingQuiz ? "Calificando..." : "Calificar evaluación"}
                  </button>
                </>
              )}
            </form>
          ) : (
            <p className="notice compact quiz-locked-note">
              <Lock size={16} /> Finaliza el video para habilitar la evaluación de esta lección.
            </p>
          )
        ) : null}

        <div className="lesson-navigation">
          <button className="button ghost" type="button" disabled={selectedIndex <= 0} onClick={() => chooseLesson(selectedIndex - 1)}>
            <ChevronLeft size={17} /> Anterior
          </button>
          <button className="button" type="button" disabled={selectedIndex >= videos.length - 1 || !isUnlocked(selectedIndex + 1)} onClick={() => chooseLesson(selectedIndex + 1)}>
            Siguiente <ChevronRight size={17} />
          </button>
        </div>

        <p className="notice compact protected-note">
          <Lock size={16} /> Cada reproducción se valida y las lecciones se habilitan en orden.
        </p>
      </div>

      <aside className="lesson-sidebar" aria-label="Lecciones del curso">
        <div className="lesson-sidebar__header">
          <div>
            <ListVideo size={18} />
            <strong>Contenido</strong>
          </div>
          <span>{completionPercent}%</span>
        </div>
        <div className="progress-track" aria-label={`${completionPercent}% completado`}>
          <span style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="lesson-list">
          {videos.map((video, index) => {
            const complete = completedIds.includes(video.id);
            const unlocked = isUnlocked(index);
            const active = video.id === selected?.id;
            return (
              <button
                className={`lesson-item ${active ? "is-current" : ""} ${complete ? "is-complete" : ""}`}
                key={video.id}
                type="button"
                disabled={!unlocked}
                onClick={() => chooseLesson(index)}
              >
                <span className="lesson-state" aria-hidden="true">
                  {complete ? <Check size={15} /> : unlocked ? <CirclePlay size={16} /> : <Lock size={14} />}
                </span>
                <span className="lesson-item__copy">
                  <small>Lección {index + 1}</small>
                  <strong>{video.title}</strong>
                  {video.durationLabel ? <em>{video.durationLabel}</em> : null}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
