# Invoice Tracker

Aplicación web sencilla de seguimiento de facturas pensada para freelancers que gestionan sus cobros sin un departamento de administración.

## Problema

Los freelancers suelen controlar sus facturas con hojas de cálculo dispersas, correos y notas sueltas. Es fácil olvidar qué facturas se enviaron, cuáles siguen pendientes y cuáles están vencidas. Esto provoca retrasos en los cobros, problemas de liquidez y tiempo perdido reconstruyendo el estado de cada cliente.

## Usuarios

- Profesionales independientes (diseñadores, desarrolladores, redactores, consultores) que facturan a varios clientes.
- Pequeños estudios de una o dos personas que necesitan una visión clara de sus cobros.
- Freelancers que hoy usan hojas de cálculo y quieren algo más ordenado, sin la complejidad de un ERP o de un software contable completo.

## Funcionalidades MVP

1. **Registro de facturas:** crear y editar facturas con número, cliente, concepto, importe, fecha de emisión y fecha de vencimiento.
2. **Estados de cobro:** marcar cada factura como borrador, enviada, pagada o vencida; el estado vencido se calcula automáticamente según la fecha.
3. **Listado y filtros:** tabla con búsqueda y filtros por cliente, estado y rango de fechas.
4. **Panel resumen:** totales pendientes, cobrados y vencidos del mes en curso, con una vista rápida de las próximas facturas a vencer.
5. **Gestión de clientes:** ficha básica de cada cliente con nombre, correo y listado de sus facturas asociadas.

## Stack sugerido

- Frontend: Next.js con TypeScript.
- Almacenamiento: SQLite mediante Prisma, suficiente para un solo usuario.
- Estilos: Tailwind CSS.
- Pruebas: Vitest para la lógica de estados y totales.

## Alcance v0.0.1

La primera versión se limita a un prototipo funcional que demuestre el flujo principal: crear una factura, cambiar su estado y ver los totales en el panel.

**Datos ficticios:** toda la información de ejemplo (clientes, importes y facturas) será inventada. No se usarán datos reales de personas ni empresas.

**Exclusiones:**

- Sin envío real de correos ni recordatorios automáticos.
- Sin integración con pasarelas de pago ni con la administración tributaria.
- Sin autenticación ni soporte multiusuario.
