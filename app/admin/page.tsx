import Link from "next/link";
import Image from "next/image";
import AdminPanel from "@/components/AdminPanel";
import UserManager, { type ManagedUser } from "@/components/UserManager";
import CourseManager, { type CourseSummary } from "@/components/CourseManager";
import LogoutButton from "@/components/LogoutButton";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";
import type { LessonQuiz } from "@/components/QuizEditor";

type AdminCourse = {
  id: string;
  title: string;
  description: string;
  videos: Array<{ id: string; title: string; description: string; s3Key: string; durationLabel: string; quiz: LessonQuiz | null }>;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ courseId?: string }> }) {
  const params = await searchParams;
  const coursesResponse = await serverApi("/api/admin/courses");
  if (coursesResponse.status === 401) redirect("/login");
  if (coursesResponse.status === 403) redirect("/dashboard");
  if (!coursesResponse.ok) throw new Error("No se pudo cargar el catálogo de cursos.");
  const { courses } = await coursesResponse.json() as { courses: CourseSummary[] };
  const selectedCourseId = courses.some((course) => course.id === params.courseId)
    ? params.courseId as string
    : courses[0]?.id || "";
  const [courseResponse, usersResponse] = await Promise.all([
    serverApi(`/api/admin/course${selectedCourseId ? `?courseId=${encodeURIComponent(selectedCourseId)}` : ""}`),
    serverApi("/api/admin/users"),
  ]);
  if (!courseResponse.ok || !usersResponse.ok) throw new Error("No se pudo cargar la administración.");
  const { course } = await courseResponse.json() as { course: AdminCourse | null };
  const { users } = await usersResponse.json() as { users: ManagedUser[] };

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

      <CourseManager courses={courses} selectedCourseId={selectedCourseId} />

      <AdminPanel
        key={course?.id || "empty-course"}
        course={
          course
            ? {
                id: course.id,
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
