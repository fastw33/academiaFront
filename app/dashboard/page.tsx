import Link from "next/link";
import Image from "next/image";
import { Clock3, ShieldCheck } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import VideoPlayer from "@/components/VideoPlayer";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type DashboardData = {
  user: { name: string; email: string; role: "student" | "admin" };
  course: null | {
    title: string;
    description: string;
    videos: Array<{ id: string; title: string; description: string; durationLabel: string; order: number }>;
  };
  access: { active: boolean; remainingDays: number };
  completedVideoIds: string[];
};

export default async function DashboardPage() {
  const response = await serverApi("/api/course");
  if (response.status === 401) redirect("/login");
  if (!response.ok) throw new Error("No se pudo cargar el curso.");
  const { user, course, access, completedVideoIds } = await response.json() as DashboardData;
  const videos = course?.videos || [];
  const canWatch = user.role === "admin" || access.active;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Image src="/brand/fastway-logo.webp" alt="Fastway" width={148} height={101} priority />
          <span className="brand-divider" aria-hidden="true" />
          <div className="brand-copy">
            <strong>Academia</strong>
            <span>Formación corporativa</span>
          </div>
        </div>
        <div className="actions">
          {user.role === "admin" ? <Link className="button ghost" href="/admin">Admin</Link> : null}
          <LogoutButton />
        </div>
      </header>

      <section className="page-heading">
        <div>
          <span className="eyebrow">Mi formación</span>
          <h1>{course?.title || "Curso pendiente"}</h1>
          <p>{course?.description || "El contenido aparecerá cuando el administrador configure el curso."}</p>
        </div>
        <span className={`access-pill ${canWatch ? "is-active" : "is-blocked"}`}>
          <span aria-hidden="true" />
          {canWatch ? "Acceso activo" : "Acceso bloqueado"}
        </span>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-header">
            <span className="badge">
              <ShieldCheck size={16} />
              Contenido protegido
            </span>
            <span className="course-duration">{videos.length} {videos.length === 1 ? "lección" : "lecciones"}</span>
          </div>
          <div className="panel-body">
            {!course || !videos.length ? (
              <p className="notice danger">Aún no hay lecciones configuradas. Entra al panel admin y sube los videos.</p>
            ) : canWatch ? (
              <VideoPlayer
                videos={videos.map((video) => ({
                  id: video.id,
                  title: video.title,
                  description: video.description,
                  durationLabel: video.durationLabel,
                }))}
                initialCompletedVideoIds={completedVideoIds}
                isAdmin={user.role === "admin"}
                watermark={`${user.email} · acceso personal`}
              />
            ) : (
              <div className="notice danger">
                Tu tiempo de acceso terminó. Puedes entrar a la cuenta, pero el video queda bloqueado.
              </div>
            )}
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <h2>Detalle de acceso</h2>
          </div>
          <div className="panel-body">
            <div className="status-row" style={{ gridTemplateColumns: "1fr" }}>
              <div className="stat">
                <span>Alumno</span>
                <strong>{user.name}</strong>
              </div>
              <div className="stat">
                <span>Estado</span>
                <strong>{canWatch ? "Activo" : "Bloqueado"}</strong>
              </div>
              <div className="stat">
                <span>Tiempo</span>
                <strong>
                  <Clock3 size={18} />{" "}
                  {user.role === "admin" ? "Ilimitado" : `${access.remainingDays} días`}
                </strong>
              </div>
            </div>
            <p className="muted access-explanation">
              El periodo inicia al reproducir el video por primera vez. La duración fue asignada por el administrador.
            </p>
            <p className="notice compact">
              Este contenido es personal. La reproducción usa enlaces temporales y una marca de agua asociada a tu cuenta.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
