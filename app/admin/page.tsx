import Link from "next/link";
import Image from "next/image";
import AdminPanel from "@/components/AdminPanel";
import UserManager from "@/components/UserManager";
import LogoutButton from "@/components/LogoutButton";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";
import type { LessonQuiz } from "@/components/QuizEditor";

type AdminCourse = {
  title: string;
  description: string;
  videos: Array<{ id: string; title: string; description: string; s3Key: string; durationLabel: string; quiz: LessonQuiz | null }>;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  accessDurationDays: number;
  accessStartsAt: string | null;
  blocked: boolean;
};

export default async function AdminPage() {
  const [courseResponse, usersResponse] = await Promise.all([
    serverApi("/api/admin/course"),
    serverApi("/api/admin/users"),
  ]);
  if (courseResponse.status === 401 || usersResponse.status === 401) redirect("/login");
  if (courseResponse.status === 403 || usersResponse.status === 403) redirect("/dashboard");
  if (!courseResponse.ok || !usersResponse.ok) throw new Error("No se pudo cargar la administración.");
  const { course } = await courseResponse.json() as { course: AdminCourse | null };
  const { users } = await usersResponse.json() as { users: AdminUser[] };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Image src="/brand/fastway-logo.webp" alt="Fastway" width={148} height={101} priority />
          <span className="brand-divider" aria-hidden="true" />
          <div className="brand-copy">
            <strong>Academia</strong>
            <span>Administración</span>
          </div>
        </div>
        <div className="actions">
          <Link className="button ghost" href="/dashboard">Curso</Link>
          <LogoutButton />
        </div>
      </header>

      <section className="page-heading admin-heading">
        <div>
          <span className="eyebrow">Panel de control</span>
          <h1>Gestión de la academia</h1>
          <p>Configura el curso, carga el video y administra el acceso de tus alumnos.</p>
        </div>
      </section>

      <AdminPanel
        course={
          course
            ? {
                title: course.title,
                description: course.description || "",
                videos: course.videos.map((video) => ({
                  id: video.id,
                  title: video.title,
                  description: video.description,
                  s3Key: video.s3Key,
                  durationLabel: video.durationLabel,
                  quiz: video.quiz || null,
                })),
              }
            : null
        }
      />
      <UserManager
        initialUsers={users}
      />
    </main>
  );
}
