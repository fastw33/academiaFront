"use client";

import { FormEvent, useState } from "react";
import { ArrowDown, ArrowUp, FileQuestion, Film, Gauge, RefreshCw, Save, Trash2, UploadCloud } from "lucide-react";
import QuizEditor, { type LessonQuiz } from "@/components/QuizEditor";

type CourseVideo = {
  id: string;
  title: string;
  description: string;
  s3Key: string;
  durationLabel: string;
  quiz: LessonQuiz | null;
};

type Course = {
  id: string;
  title: string;
  description: string;
  videos: CourseVideo[];
};

type AdminPanelProps = {
  course: Course | null;
};

type UploadProgress = {
  fileName: string;
  fileIndex: number;
  totalFiles: number;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  phase: "preparing" | "uploading" | "processing" | "optimizing";
};

type OptimizationJob = {
  status: "queued" | "downloading" | "processing" | "uploading" | "done" | "failed";
  progress: number;
  optimizedKey: string | null;
  optimizedBytes: number | null;
  error: string | null;
};

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function optimizeVideo(
  video: Pick<CourseVideo, "id" | "s3Key">,
  originalBytes: number | undefined,
  onProgress: (progress: number) => void
) {
  let response = await fetch("/api/admin/videos/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: video.id, key: video.s3Key, originalBytes }),
  });
  let payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudo iniciar la optimización.");
  let job = payload.job as OptimizationJob;

  while (job.status !== "done" && job.status !== "failed") {
    onProgress(job.progress);
    await wait(1500);
    response = await fetch(`/api/admin/videos/${encodeURIComponent(video.id)}/optimize`, { cache: "no-store" });
    payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "No se pudo consultar la optimización.");
    job = payload.job as OptimizationJob;
  }

  if (job.status === "failed" || !job.optimizedKey) {
    throw new Error(job.error || "No se pudo optimizar el video.");
  }
  onProgress(100);
  return job;
}

function uploadFile(
  url: string,
  token: string,
  file: File,
  onProgress: (loaded: number, phase: UploadProgress["phase"]) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("Content-Type", file.type || "video/mp4");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, "uploading");
    };
    request.upload.onload = () => onProgress(file.size, "processing");
    request.onerror = () => reject(new Error(`Se interrumpió la carga de ${file.name}.`));
    request.onabort = () => reject(new Error(`Se canceló la carga de ${file.name}.`));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      let detail = "";
      try {
        detail = JSON.parse(request.responseText)?.error || "";
      } catch {
        detail = "";
      }
      reject(new Error(detail || `No se pudo subir ${file.name}.`));
    };
    request.send(file);
  });
}

export default function AdminPanel({ course }: AdminPanelProps) {
  const [videos, setVideos] = useState<CourseVideo[]>(course?.videos || []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizingVideo, setOptimizingVideo] = useState<{ id: string; progress: number } | null>(null);
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);

  async function uploadVideos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = form.getAll("videos").filter((file): file is File => file instanceof File && file.size > 0);

    if (!files.length) {
      setError("Selecciona uno o más videos.");
      return;
    }

    setError("");
    setMessage("");
    setUploading(true);
    const uploaded: CourseVideo[] = [];
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    let completedBytes = 0;

    try {
      for (const [index, file] of files.entries()) {
        const updateProgress = (loaded: number, phase: UploadProgress["phase"], optimizationPercent = 0) => {
          const loadedBytes = Math.min(totalBytes, completedBytes + loaded);
          const percent = phase === "optimizing"
            ? Math.round(((index + optimizationPercent / 100) / files.length) * 100)
            : Math.round((loadedBytes / totalBytes) * 100);
          setUploadProgress({
            fileName: file.name,
            fileIndex: index + 1,
            totalFiles: files.length,
            loadedBytes,
            totalBytes,
            percent,
            phase,
          });
        };
        updateProgress(0, "preparing");

        const signed = await fetch("/api/admin/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "video/mp4",
            courseId: course?.id,
          }),
        });
        const signedPayload = await signed.json().catch(() => null);
        if (!signed.ok) throw new Error(signedPayload?.error || `No se pudo preparar ${file.name}.`);

        if (!signedPayload?.url || !signedPayload?.token) throw new Error(`No se pudo autorizar la subida de ${file.name}.`);
        await uploadFile(signedPayload.url, signedPayload.token, file, updateProgress);
        updateProgress(file.size, "optimizing", 0);
        const optimized = await optimizeVideo(
          { id: signedPayload.id, s3Key: signedPayload.key },
          file.size,
          (progress) => updateProgress(file.size, "optimizing", progress)
        );
        completedBytes += file.size;

        uploaded.push({
          id: signedPayload.id,
          title: titleFromFilename(file.name),
          description: "",
          durationLabel: "",
          s3Key: optimized.optimizedKey || signedPayload.key,
          quiz: null,
        });
      }

      setVideos((current) => [...current, ...uploaded]);
      setMessage(`${uploaded.length} ${uploaded.length === 1 ? "video subido" : "videos subidos"}. Guarda el curso para publicar el orden.`);
      formElement.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudieron subir los videos.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function optimizeExistingVideo(video: CourseVideo) {
    if (optimizingVideo || video.s3Key.endsWith("/master.m3u8")) return;
    setError("");
    setMessage("");
    setOptimizingVideo({ id: video.id, progress: 0 });
    try {
      const job = await optimizeVideo(video, undefined, (progress) => {
        setOptimizingVideo({ id: video.id, progress });
      });
      setVideos((current) => current.map((item) => (
        item.id === video.id ? { ...item, s3Key: job.optimizedKey || item.s3Key } : item
      )));
      const reduction = job.optimizedBytes ? ` El nuevo streaming ocupa ${formatBytes(job.optimizedBytes)}.` : "";
      setMessage(`Video convertido a streaming adaptativo.${reduction}`);
    } catch (optimizationError) {
      setError(optimizationError instanceof Error ? optimizationError.message : "No se pudo optimizar el video.");
    } finally {
      setOptimizingVideo(null);
    }
  }

  function updateVideo(id: string, field: keyof Pick<CourseVideo, "title" | "description" | "durationLabel">, value: string) {
    setVideos((current) => current.map((video) => (video.id === id ? { ...video, [field]: value } : video)));
  }

  function updateQuiz(id: string, quiz: LessonQuiz | null) {
    setVideos((current) => current.map((video) => (video.id === id ? { ...video, quiz } : video)));
  }

  function moveVideo(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;
    setVideos((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }

  function removeVideo(id: string) {
    setVideos((current) => current.filter((video) => video.id !== id));
    setMessage("Video retirado del curso. Guarda para aplicar el cambio.");
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!videos.length) {
      setError("El curso debe tener al menos un video.");
      return;
    }

    const invalidQuiz = videos.find((video) => video.quiz && (
      video.quiz.questions.length < 5
      || video.quiz.questions.length > 6
      || video.quiz.questions.some((question) => (
        question.prompt.trim().length < 3
        || question.options.length !== 4
        || question.options.some((option) => !option.trim())
      ))
    ));
    if (invalidQuiz) {
      setExpandedQuizId(invalidQuiz.id);
      setError(`Completa las preguntas y las cuatro opciones de la evaluación de "${invalidQuiz.title}".`);
      return;
    }

    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/course?courseId=${encodeURIComponent(course?.id || "")}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        videos,
      }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setError(payload?.error || "No se pudo guardar el curso.");
      return;
    }

    setMessage("Curso y orden de lecciones guardados.");
  }

  return (
    <section className="panel course-admin-panel">
      <div className="panel-header">
        <div>
          <h2>Contenido del curso</h2>
          <p>{videos.length} {videos.length === 1 ? "lección" : "lecciones"}</p>
        </div>
      </div>
      <div className="panel-body course-builder">
        <form className="multi-upload" onSubmit={uploadVideos}>
          <div className="field">
            <label htmlFor="videos">Agregar videos</label>
            <input id="videos" name="videos" type="file" accept="video/mp4,video/webm,video/quicktime" multiple />
          </div>
          <button className="button" disabled={uploading} type="submit">
            <UploadCloud size={18} />
            {uploading ? "Subiendo..." : "Subir videos"}
          </button>
          {uploadProgress ? (
            <div className="upload-progress" role="status" aria-live="polite">
              <div className="upload-progress__summary">
                <span>
                  {uploadProgress.phase === "preparing"
                    ? "Preparando"
                    : uploadProgress.phase === "optimizing"
                      ? "Generando streaming"
                    : uploadProgress.phase === "processing"
                      ? "Confirmando guardado"
                      : "Subiendo"}{" "}
                  <strong>{uploadProgress.fileName}</strong>
                </span>
                <strong className="upload-progress__percent">{uploadProgress.percent}%</strong>
              </div>
              <div
                className="upload-progress__track"
                role="progressbar"
                aria-label={`Progreso de carga de ${uploadProgress.fileName}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress.percent}
              >
                <span style={{ width: `${uploadProgress.percent}%` }} />
              </div>
              <div className="upload-progress__meta">
                <span>Archivo {uploadProgress.fileIndex} de {uploadProgress.totalFiles}</span>
                <span>
                  {uploadProgress.phase === "optimizing"
                    ? "Creando calidades 360p y 720p."
                    : uploadProgress.phase === "processing"
                    ? "Carga enviada. MinIO está finalizando el archivo."
                    : `${formatBytes(uploadProgress.loadedBytes)} de ${formatBytes(uploadProgress.totalBytes)}`}
                </span>
              </div>
            </div>
          ) : null}
        </form>

        <form className="course-editor" onSubmit={saveCourse}>
          <div className="course-meta-fields">
            <div className="field">
              <label htmlFor="title">Nombre del curso</label>
              <input id="title" name="title" defaultValue={course?.title || "Curso principal"} required />
            </div>
            <div className="field">
              <label htmlFor="description">Descripción</label>
              <textarea id="description" name="description" defaultValue={course?.description || ""} />
            </div>
          </div>

          <div className="lesson-admin-list">
            {videos.map((video, index) => (
              <article className="lesson-admin-row" key={video.id}>
                <span className="lesson-order">{index + 1}</span>
                <div className="lesson-admin-fields">
                  <div className="field">
                    <label htmlFor={`video-title-${video.id}`}>Título</label>
                    <input
                      id={`video-title-${video.id}`}
                      value={video.title}
                      onChange={(event) => updateVideo(video.id, "title", event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`video-duration-${video.id}`}>Duración visible</label>
                    <input
                      id={`video-duration-${video.id}`}
                      value={video.durationLabel}
                      onChange={(event) => updateVideo(video.id, "durationLabel", event.target.value)}
                      placeholder="Ej: 12 min"
                    />
                  </div>
                  <div className="field lesson-description-field">
                    <label htmlFor={`video-description-${video.id}`}>Descripción</label>
                    <input
                      id={`video-description-${video.id}`}
                      value={video.description}
                      onChange={(event) => updateVideo(video.id, "description", event.target.value)}
                      placeholder="Resumen breve de la lección"
                    />
                  </div>
                </div>
                <div className="lesson-admin-actions">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => optimizeExistingVideo(video)}
                    disabled={Boolean(optimizingVideo) || video.s3Key.endsWith("/master.m3u8")}
                    aria-label={`Optimizar ${video.title} para streaming`}
                    title={video.s3Key.endsWith("/master.m3u8") ? "Streaming adaptativo listo" : "Optimizar para conexiones lentas"}
                  >
                    {optimizingVideo?.id === video.id ? <RefreshCw className="spin" size={17} /> : <Gauge size={17} />}
                  </button>
                  <button
                    className={`icon-button ${video.quiz ? "success" : ""}`}
                    type="button"
                    onClick={() => setExpandedQuizId((current) => current === video.id ? null : video.id)}
                    aria-expanded={expandedQuizId === video.id}
                    aria-label={`${video.quiz ? "Editar" : "Crear"} evaluación de ${video.title}`}
                    title={video.quiz ? "Editar evaluación" : "Crear evaluación"}
                  >
                    <FileQuestion size={17} />
                  </button>
                  <button className="icon-button" type="button" onClick={() => moveVideo(index, -1)} disabled={index === 0} aria-label={`Subir ${video.title}`} title="Subir en el orden">
                    <ArrowUp size={17} />
                  </button>
                  <button className="icon-button" type="button" onClick={() => moveVideo(index, 1)} disabled={index === videos.length - 1} aria-label={`Bajar ${video.title}`} title="Bajar en el orden">
                    <ArrowDown size={17} />
                  </button>
                  <button className="icon-button danger" type="button" onClick={() => removeVideo(video.id)} aria-label={`Quitar ${video.title}`} title="Quitar del curso">
                    <Trash2 size={17} />
                  </button>
                </div>
                {optimizingVideo?.id === video.id ? (
                  <span className="lesson-optimization-status" role="status">
                    Preparando streaming {optimizingVideo.progress}%
                  </span>
                ) : null}
                {expandedQuizId === video.id ? (
                  <QuizEditor
                    lessonTitle={video.title}
                    quiz={video.quiz}
                    onChange={(quiz) => updateQuiz(video.id, quiz)}
                  />
                ) : null}
              </article>
            ))}

            {!videos.length ? (
              <div className="empty-lessons">
                <Film size={24} />
                <p>Sube el primer video para crear la ruta de aprendizaje.</p>
              </div>
            ) : null}
          </div>

          <button className="button secondary save-course-button" disabled={saving} type="submit">
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar curso y orden"}
          </button>
        </form>

        {message ? <p className="notice course-feedback" role="status">{message}</p> : null}
        {error ? <p className="notice danger course-feedback" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
