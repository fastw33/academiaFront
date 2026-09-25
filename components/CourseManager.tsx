"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BookOpen, Plus, X } from "lucide-react";

export type CourseSummary = {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  active: boolean;
};

type CourseManagerProps = {
  courses: CourseSummary[];
  selectedCourseId: string;
};

export default function CourseManager({ courses, selectedCourseId }: CourseManagerProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("courseTitle"),
        description: form.get("courseDescription"),
      }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(payload?.error || "No se pudo crear el curso.");
      return;
    }
    formElement.reset();
    setCreating(false);
    router.push(`/admin?courseId=${encodeURIComponent(payload.course.id)}`);
    router.refresh();
  }

  return (
    <section className="course-manager" aria-label="Cursos de la academia">
      <div className="course-manager__header">
        <div>
          <span className="eyebrow">Catálogo</span>
          <h2>Cursos</h2>
        </div>
        <button className="button secondary" type="button" onClick={() => setCreating((current) => !current)}>
          {creating ? <X size={17} /> : <Plus size={17} />}
          {creating ? "Cancelar" : "Nuevo curso"}
        </button>
      </div>

      <nav className="course-tabs" aria-label="Seleccionar curso">
        {courses.map((course) => (
          <Link
            className={`course-tab ${course.id === selectedCourseId ? "is-active" : ""}`}
            href={`/admin?courseId=${encodeURIComponent(course.id)}`}
            key={course.id}
          >
            <BookOpen size={17} />
            <span>
              <strong>{course.title}</strong>
              <small>{course.lessonCount} {course.lessonCount === 1 ? "módulo" : "módulos"}</small>
            </span>
          </Link>
        ))}
      </nav>

      {creating ? (
        <form className="create-course-form" onSubmit={createCourse}>
          <div className="field">
            <label htmlFor="courseTitle">Nombre del curso</label>
            <input id="courseTitle" name="courseTitle" placeholder="Ej: Operación logística" required />
          </div>
          <div className="field">
            <label htmlFor="courseDescription">Descripción</label>
            <input id="courseDescription" name="courseDescription" placeholder="Objetivo general del curso" />
          </div>
          <button className="button" disabled={saving} type="submit">
            <Plus size={17} /> {saving ? "Creando..." : "Crear curso"}
          </button>
          {error ? <p className="notice danger" role="alert">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
