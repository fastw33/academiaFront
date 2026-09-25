"use client";

import { FormEvent, useState } from "react";
import { ArrowDown, ArrowUp, Film, Save, Trash2, UploadCloud } from "lucide-react";

type CourseVideo = {
  id: string;
  title: string;
  description: string;
  s3Key: string;
  durationLabel: string;
};

type Course = {
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
  phase: "preparing" | "uploading" | "processing";
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

function uploadFile(
  url: string,
  file: File,
  onProgress: (loaded: number, phase: UploadProgress["phase"]) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
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
        const updateProgress = (loaded: number, phase: UploadProgress["phase"]) => {
          const loadedBytes = Math.min(totalBytes, completedBytes + loaded);
          setUploadProgress({
            fileName: file.name,
            fileIndex: index + 1,
            totalFiles: files.length,
            loadedBytes,
            totalBytes,
            percent: Math.round((loadedBytes / totalBytes) * 100),
            phase,
          });
        };
        updateProgress(0, "preparing");

        const signed = await fetch("/api/admin/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "video/mp4" }),
        });
        const signedPayload = await signed.json().catch(() => null);
        if (!signed.ok) throw new Error(signedPayload?.error || `No se pudo preparar ${file.name}.`);

        await uploadFile(signedPayload.url, file, updateProgress);
        completedBytes += file.size;

        uploaded.push({
          id: signedPayload.id,
          title: titleFromFilename(file.name),
          description: "",
          durationLabel: "",
          s3Key: signedPayload.key,
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

  function updateVideo(id: string, field: keyof Pick<CourseVideo, "title" | "description" | "durationLabel">, value: string) {
    setVideos((current) => current.map((video) => (video.id === id ? { ...video, [field]: value } : video)));
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

    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/course", {
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
                  {uploadProgress.phase === "processing"
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
