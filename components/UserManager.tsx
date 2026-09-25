"use client";

import { FormEvent, useMemo, useState } from "react";
import { Ban, BarChart3, BookOpen, Check, CheckCircle2, Circle, ClipboardCheck, Edit3, KeyRound, RotateCcw, Save, UserPlus, Video, X } from "lucide-react";

export type LessonProgress = {
  id: string;
  title: string;
  order: number;
  watched: boolean;
  completed: boolean;
  hasQuiz: boolean;
  lastAttempt: null | { score: number; passed: boolean; correct: number; total: number; attemptedAt: string | null };
};

export type CourseProgress = {
  courseId: string;
  title: string;
  lessonCount: number;
  completedLessons: number;
  percentage: number;
  lessons: LessonProgress[];
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  accessDurationDays: number;
  accessStartsAt: string | null;
  blocked: boolean;
  progress: CourseProgress[];
};

export default function UserManager({ initialUsers }: { initialUsers: ManagedUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editingUser = useMemo(() => users.find((user) => user.id === editingId) || null, [editingId, users]);

  function replaceUser(updated: ManagedUser) {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setMessage("");
    setBusyId("create");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        accessDurationDays: Number(form.get("accessDurationDays") || 20),
      }),
    });
    const payload = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok) {
      setError(payload?.error || "No se pudo crear el alumno.");
      return;
    }
    setUsers((current) => [payload.user, ...current]);
    setMessage("Alumno creado. Ya puede iniciar sesión.");
    formElement.reset();
  }

  async function updateUser(id: string, changes: Record<string, unknown>, successMessage: string) {
    setError("");
    setMessage("");
    setBusyId(id);
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok) {
      setError(payload?.error || "No se pudo actualizar el alumno.");
      return false;
    }
    replaceUser(payload.user);
    setMessage(successMessage);
    return true;
  }

  async function resetProgress(userId: string, courseId: string, lesson: LessonProgress, scope: "module" | "quiz") {
    setError("");
    setMessage("");
    setBusyId(`${userId}-${lesson.id}-${scope}`);
    const response = await fetch(`/api/admin/users/${userId}/progress/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, videoId: lesson.id, scope }),
    });
    const payload = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok) {
      setError(payload?.error || "No se pudo reiniciar el progreso.");
      return;
    }
    replaceUser(payload.user);
    setMessage(scope === "quiz" ? `Evaluación de "${lesson.title}" reiniciada.` : `Módulo "${lesson.title}" reiniciado.`);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    const saved = await updateUser(editingUser.id, {
      name: form.get("editName"),
      email: form.get("editEmail"),
      password: form.get("editPassword"),
      accessDurationDays: Number(form.get("editAccessDurationDays")),
    }, "Datos del alumno actualizados.");
    if (saved) setEditingId(null);
  }

  return (
    <section className="panel user-manager">
      <div className="panel-header"><div><h2>Gestión de alumnos</h2><p>{users.length} {users.length === 1 ? "usuario registrado" : "usuarios registrados"}</p></div></div>
      <div className="panel-body">
        <form className="create-user-form" onSubmit={createUser}>
          <div className="field"><label htmlFor="newName">Nombre</label><input id="newName" name="name" required /></div>
          <div className="field"><label htmlFor="newEmail">Correo</label><input id="newEmail" name="email" type="email" required /></div>
          <div className="field"><label htmlFor="newPassword">Contraseña inicial</label><input id="newPassword" name="password" type="password" minLength={8} required /></div>
          <div className="field field-days"><label htmlFor="newAccessDurationDays">Días</label><input id="newAccessDurationDays" name="accessDurationDays" type="number" min="1" max="365" defaultValue="20" required /></div>
          <button className="button" disabled={busyId === "create"} type="submit"><UserPlus size={17} />{busyId === "create" ? "Creando..." : "Crear alumno"}</button>
        </form>

        {editingUser ? (
          <form className="user-editor" onSubmit={saveUser}>
            <div className="user-editor__title"><div><span>Editando usuario</span><strong>{editingUser.name}</strong></div><button className="icon-button" type="button" onClick={() => setEditingId(null)} aria-label="Cerrar edición" title="Cerrar edición"><X size={18} /></button></div>
            <div className="user-editor__fields">
              <div className="field"><label htmlFor="editName">Nombre</label><input id="editName" name="editName" defaultValue={editingUser.name} required /></div>
              <div className="field"><label htmlFor="editEmail">Correo</label><input id="editEmail" name="editEmail" type="email" defaultValue={editingUser.email} required /></div>
              <div className="field"><label htmlFor="editPassword">Nueva contraseña</label><input id="editPassword" name="editPassword" type="password" minLength={8} placeholder="Dejar vacía para conservarla" /></div>
              <div className="field field-days"><label htmlFor="editAccessDurationDays">Días</label><input id="editAccessDurationDays" name="editAccessDurationDays" type="number" min="1" max="365" defaultValue={editingUser.accessDurationDays} required /></div>
            </div>
            <button className="button" disabled={busyId === editingUser.id} type="submit"><Save size={17} /> Guardar cambios</button>
          </form>
        ) : null}

        {message ? <p className="notice user-feedback" role="status">{message}</p> : null}
        {error ? <p className="notice danger user-feedback" role="alert">{error}</p> : null}

        <div className="user-list" role="list">
          {users.length ? users.map((user) => (
            <article className={`user-row ${expandedId === user.id ? "is-expanded" : ""}`} key={user.id} role="listitem">
              <div className="user-identity"><span className="user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
              <div className="user-access"><span className={`status-tag ${user.blocked ? "is-blocked" : "is-active"}`}>{user.blocked ? "Bloqueado" : "Activo"}</span><span>{user.accessDurationDays} días</span><span>{user.accessStartsAt ? `Inició ${new Date(user.accessStartsAt).toLocaleDateString("es-CO")}` : "Sin iniciar"}</span></div>
              <div className="user-actions">
                <button className={`icon-button ${expandedId === user.id ? "success" : ""}`} type="button" onClick={() => setExpandedId((current) => current === user.id ? null : user.id)} aria-expanded={expandedId === user.id} aria-label={`Ver progreso de ${user.name}`} title="Ver progreso por curso"><BarChart3 size={17} /></button>
                <button className="icon-button" type="button" onClick={() => setEditingId(user.id)} aria-label={`Editar a ${user.name}`} title="Editar usuario"><Edit3 size={17} /></button>
                <button className="icon-button" type="button" disabled={busyId === user.id} onClick={() => updateUser(user.id, { resetAccess: true }, "Periodo y progreso completo reiniciados.")} aria-label={`Reiniciar acceso de ${user.name}`} title="Reiniciar todo el acceso"><RotateCcw size={17} /></button>
                <button className={`icon-button ${user.blocked ? "success" : "danger"}`} type="button" disabled={busyId === user.id} onClick={() => updateUser(user.id, { blocked: !user.blocked }, user.blocked ? "Alumno desbloqueado." : "Alumno bloqueado.")} aria-label={`${user.blocked ? "Desbloquear" : "Bloquear"} a ${user.name}`} title={user.blocked ? "Desbloquear" : "Bloquear"}>{user.blocked ? <CheckCircle2 size={17} /> : <Ban size={17} />}</button>
              </div>

              {expandedId === user.id ? (
                <div className="student-progress">
                  {user.progress.map((course) => (
                    <section className="student-course-progress" key={course.courseId}>
                      <header><div><BookOpen size={17} /><strong>{course.title}</strong></div><span>{course.completedLessons}/{course.lessonCount} módulos · {course.percentage}%</span></header>
                      <div className="student-progress-track" aria-label={`${course.percentage}% completado`}><span style={{ width: `${course.percentage}%` }} /></div>
                      {course.lessons.length ? (
                        <div className="student-module-list">
                          {course.lessons.map((lesson) => (
                            <div className="student-module-row" key={lesson.id}>
                              <span className={`module-state ${lesson.completed ? "is-complete" : lesson.watched ? "is-watched" : ""}`} aria-hidden="true">{lesson.completed ? <Check size={14} /> : lesson.watched ? <Video size={14} /> : <Circle size={13} />}</span>
                              <div className="module-copy"><small>Módulo {lesson.order + 1}</small><strong>{lesson.title}</strong></div>
                              <div className="module-results">
                                <span>{lesson.completed ? "Completado" : lesson.watched ? "Video visto" : "Pendiente"}</span>
                                {lesson.hasQuiz ? <span className={`quiz-score ${lesson.lastAttempt?.passed ? "is-passed" : ""}`}><ClipboardCheck size={13} /> {lesson.lastAttempt ? `${lesson.lastAttempt.score}%` : "Sin intento"}</span> : null}
                              </div>
                              <div className="module-actions">
                                {lesson.hasQuiz ? <button className="icon-button" type="button" disabled={busyId === `${user.id}-${lesson.id}-quiz` || !lesson.lastAttempt} onClick={() => resetProgress(user.id, course.courseId, lesson, "quiz")} aria-label={`Reiniciar evaluación de ${lesson.title}`} title="Reiniciar solo esta evaluación"><ClipboardCheck size={16} /></button> : null}
                                <button className="icon-button danger" type="button" disabled={busyId === `${user.id}-${lesson.id}-module`} onClick={() => resetProgress(user.id, course.courseId, lesson, "module")} aria-label={`Reiniciar módulo ${lesson.title}`} title="Reiniciar este módulo y los siguientes"><RotateCcw size={16} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="muted empty-course-progress">Este curso aún no tiene módulos.</p>}
                    </section>
                  ))}
                </div>
              ) : null}
            </article>
          )) : <div className="empty-users"><KeyRound size={24} /><p>Aún no hay alumnos. Crea el primero con el formulario superior.</p></div>}
        </div>
      </div>
    </section>
  );
}
