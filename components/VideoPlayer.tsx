"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CirclePlay, ListVideo, Lock, PlayCircle, RefreshCw } from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
};

type VideoPlayerProps = {
  videos: Lesson[];
  initialCompletedVideoIds: string[];
  isAdmin: boolean;
  watermark: string;
};

export default function VideoPlayer({ videos, initialCompletedVideoIds, isAdmin, watermark }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [watermarkTime, setWatermarkTime] = useState("");
  const [completedIds, setCompletedIds] = useState(initialCompletedVideoIds);
  const firstAvailable = useMemo(() => {
    if (isAdmin) return videos[0]?.id || "";
    return videos.find((video, index) => !completedIds.includes(video.id) && videos.slice(0, index).every((previous) => completedIds.includes(previous.id)))?.id
      || videos.at(-1)?.id
      || "";
  }, [completedIds, isAdmin, videos]);
  const [selectedId, setSelectedId] = useState(firstAvailable);
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const selectedIndex = videos.findIndex((video) => video.id === selectedId);
  const selected = videos[selectedIndex] || videos[0];

  function isUnlocked(index: number) {
    return isAdmin || videos.slice(0, index).every((video) => completedIds.includes(video.id));
  }

  useEffect(() => {
    if (!selected?.id) return;
    const controller = new AbortController();

    async function loadVideo() {
      setLoading(true);
      setError("");
      setSrc("");
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

      setSrc(payload.url);
    }

    loadVideo().catch((loadError) => {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setLoading(false);
      setError("No se pudo conectar con el video.");
    });
    return () => controller.abort();
  }, [selected?.id]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) videoRef.current?.pause();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const updateTime = () => setWatermarkTime(formatter.format(new Date()));
    updateTime();
    const interval = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(interval);
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
    setCompletedIds(updated);
    if (selectedIndex < videos.length - 1) setSelectedId(videos[selectedIndex + 1].id);
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
                src={src}
                title={selected.title}
                controls
                controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
                disablePictureInPicture
                playsInline
                onEnded={completeLesson}
              />
              <div className="watermark-layer" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index}>{watermark}{watermarkTime ? ` · ${watermarkTime}` : ""}</span>
                ))}
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
