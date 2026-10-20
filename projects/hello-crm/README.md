# Hello CRM

Especificación de un CRM minimalista pensado para pequeñas empresas que necesitan ordenar sus relaciones con clientes sin la complejidad ni el coste de las grandes plataformas.

## Objetivos

- Centralizar en un único lugar los datos de contactos, empresas y oportunidades.
- Ofrecer una curva de aprendizaje mínima: cualquier persona debe poder usarlo en menos de diez minutos.
- Dar visibilidad clara del embudo de ventas y de las tareas pendientes.
- Mantener un coste de operación bajo y una instalación sencilla.

## Usuarios

- **Propietarios y gerentes** de negocios con entre 1 y 20 empleados, que quieren ver el estado de las ventas de un vistazo.
- **Vendedores y personal comercial**, que registran contactos, llamadas y seguimientos a diario.
- **Administrativos**, que consultan datos de clientes y exportan información cuando la necesitan.

## Funcionalidades MVP

1. **Gestión de contactos y empresas**: alta, edición, búsqueda y etiquetas.
2. **Pipeline de oportunidades**: tablero con etapas (nuevo, contactado, propuesta, ganado, perdido) y arrastrar y soltar.
3. **Notas y actividades**: historial de llamadas, correos y reuniones asociado a cada contacto.
4. **Tareas y recordatorios**: fechas de seguimiento con aviso por correo.
5. **Importación y exportación CSV** para migrar datos desde hojas de cálculo.
6. **Autenticación** con correo y contraseña, y roles básicos (administrador y usuario).

## Stack sugerido

- **Frontend**: Next.js con TypeScript y Tailwind CSS.
- **Backend**: rutas API de Next.js o Node.js con Fastify.
- **Base de datos**: PostgreSQL con Prisma como ORM.
- **Autenticación**: Auth.js.
- **Despliegue**: Vercel o un contenedor Docker en un VPS, con una base de datos gestionada.
- **Pruebas**: Vitest para unitarias y Playwright para flujos principales.
