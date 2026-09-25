import { redirect } from "next/navigation";
import Image from "next/image";
import LoginForm from "@/components/LoginForm";
import { serverApi } from "@/lib/server-api";

export default async function LoginPage() {
  const session = await serverApi("/api/auth/me");
  if (session.ok) redirect("/dashboard");

  return (
    <main className="login-wrap">
      <section className="login-visual" aria-label="Academia Fastway">
        <Image
          className="login-background"
          src="/brand/training-hero.webp"
          alt="Operación logística aérea y marítima de Fastway"
          fill
          priority
          sizes="(max-width: 880px) 100vw, 58vw"
        />
        <div className="login-overlay" />
        <div className="login-brand">
          <Image src="/brand/fastway-logo.webp" alt="Fastway" width={210} height={143} priority />
        </div>
        <div className="login-copy">
          <span className="eyebrow">Formación corporativa</span>
          <h1>Academia Fastway</h1>
          <p>Contenido privado para fortalecer nuestro conocimiento y nuestra operación.</p>
        </div>
      </section>
      <section className="login-access" aria-label="Iniciar sesión">
        <div className="login-access__inner">
          <div className="login-access__header">
            <span className="eyebrow">Acceso privado</span>
            <h2>Bienvenido</h2>
            <p>Ingresa con las credenciales asignadas por tu administrador.</p>
          </div>
          <LoginForm />
          <p className="login-help">¿Tienes problemas para ingresar? Contacta al administrador de la plataforma.</p>
        </div>
      </section>
    </main>
  );
}
