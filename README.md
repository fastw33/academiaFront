# Academia Fastway Frontend

Frontend independiente de Academia Fastway, construido con Next.js y React.

## Funcionalidad

- Inicio de sesion para administradores y alumnos.
- Aula con lecciones ordenadas y progreso secuencial.
- Reproductor de videos privados mediante enlaces temporales.
- Panel para gestionar cursos, videos y usuarios.
- Interfaz responsive basada en la identidad visual de Fastway.

## Desarrollo local

```bash
npm install
copy .env.example .env.local
npm run dev
```

La aplicacion queda disponible en `http://localhost:3000`.

## Produccion

Configura `BACKEND_INTERNAL_URL` con la URL publica o interna del backend y
ejecuta:

```bash
npm ci
npm run build
npm start
```

Las solicitudes realizadas a `/api/*` son enviadas por Next.js al backend.
