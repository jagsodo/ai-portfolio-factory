# Hello CRM

CRM minimalista para pequeñas empresas que necesitan ordenar sus relaciones con clientes sin la complejidad ni el coste de las suites empresariales.

## Objetivos

- Centralizar contactos, empresas y conversaciones en un único lugar.
- Dar visibilidad clara del estado de cada oportunidad de venta.
- Reducir el tiempo de configuración: usable en menos de diez minutos.
- Mantener una interfaz simple, rápida y accesible desde el móvil.

## Usuarios

- **Propietarios y autónomos**: necesitan una visión global de clientes y ventas.
- **Equipos comerciales pequeños** (2-10 personas): registran contactos, seguimientos y tareas.
- **Personal de atención al cliente**: consulta el historial de cada contacto antes de responder.

## Funcionalidades MVP

1. Gestión de contactos y empresas (alta, edición, búsqueda y etiquetas).
2. Pipeline de ventas en tablero con etapas personalizables (arrastrar y soltar).
3. Notas y registro de actividad por contacto.
4. Tareas y recordatorios con fecha de vencimiento.
5. Importación y exportación de datos en CSV.
6. Autenticación por correo y roles básicos (administrador y miembro).
7. Panel resumen con oportunidades abiertas, ganadas y tareas pendientes.

Quedan fuera del MVP: automatizaciones, integraciones de correo y facturación.

## Stack sugerido

- **Frontend**: Next.js con TypeScript y Tailwind CSS.
- **Backend**: rutas API de Next.js o Node.js con Fastify.
- **Base de datos**: PostgreSQL con Prisma como ORM.
- **Autenticación**: Auth.js o un proveedor gestionado.
- **Despliegue**: Vercel para la aplicación y Neon o Supabase para la base de datos.
- **Pruebas**: Vitest y Playwright para flujos principales.
