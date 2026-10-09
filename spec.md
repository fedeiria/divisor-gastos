# Divisor de Gastos Express: Spec

## 1. Objetivo
App web para dividir gastos de eventos cortos (salidas, viajes de fin de semana) sin registro ni contraseñas. Cualquiera con el enlace/QR carga gastos, todos ven los cambios en tiempo real, y al final la app indica quién le transfiere a quién.

Fuera de alcance: autenticación, multimoneda por grupo, adjuntar tickets, notificaciones push, división por porcentajes, agregar/editar/eliminar participantes después de crear el grupo, reabrir grupos cerrados.

## 2. Stack y restricciones
- Angular 18+: standalone components.
- Supabase: PostgreSQL + Realtime (Postgres Changes).
- Estado centralizado en GroupStateService (signals; balances y transferencias como computed).
- Reactive Forms para validación.
- SCSS modular, mobile-first, variables CSS. Verde = saldo a favor, rojo = deudor.
- Todo el texto de UI en español (es-AR); montos formateados con Intl.NumberFormat('es-AR').

## 3. Modelo de datos
- Group: id (uuid), title, currency (default "ARS"), is_closed (default false), created_at. Restricción: is_closed solo pasa de false a true.
- Participant: id, group_id, name, created_at. FK group ON DELETE CASCADE. Nombre único dentro del grupo; inmutable.
- Expense: id, group_id, description, amount, paid_by, created_at. Restricciones: amount > 0; paid_by -> Participant; FK group CASCADE.
- ExpenseSplit: id, expense_id, participant_id, assigned_amount. Restricciones: assigned_amount >= 0; FK CASCADE; sum(assigned_amount) = Expense.amount.

Tipos de dominio derivados (no persistidos): ParticipantBalance (participant, totalPaid, totalConsumed, netBalance) y Transaction (from, to, amount).

## 4. Funcionalidad
- US-01 Crear grupo con solo título + lista inicial de participantes (mínimo 2, nombres únicos). Redirige a /group/:id.
- US-02 Acceso por enlace/QR/WhatsApp sin registro. Elegir "¿Quién sos?" entre los participantes existentes. Elección guardada en localStorage.
- US-03 Cambios en tiempo real. Resincronización al reconectar.
- US-04 Agregar, editar o eliminar gastos: monto, concepto, quién pagó, entre quiénes se divide.
- US-05 Modos de división: Partes iguales (default) y Montos fijos.
- US-06 Dashboard: Total gastado, promedio por persona, balance por participante y feed de gastos.
- US-07 Botón "Cerrar cuenta" e indicación de transferencias finales. Botón "Copiar resumen".

## 5. Reglas de negocio
1. Consistencia: sum(totalPaid) = sum(totalConsumed) (tolerancia 0,01).
2. Redondeo en partes iguales: trabajar en centavos enteros; el resto se reparte de a 1 centavo entre los primeros beneficiarios.
3. Liquidación: algoritmo greedy deudores y acreedores ordenados por monto descendente.
4. Grupo cerrado: ninguna mutación permitida.
5. Seguridad: RLS en Supabase por group_id.

## 6. Criterios de aceptación
- AC-01 Se crea el grupo y redirige a /group/:id al ingresar título y >=2 nombres.
- AC-02 Dos dispositivos ven gastos actualizados en <2s sin recargar.
- AC-03 Al cerrar la cuenta, se bloquean cargas y la lista de transferencias deja saldos en 0.
- AC-04 Botón "Copiar resumen" genera el texto con formato correcto.
- AC-05 División de $100 entre 3 genera splits de 33,34 / 33,33 / 33,33.
- AC-06 Montos fijos que no suman el total bloquean la acción de guardar.
- AC-07 Estado resincronizado tras perder conexión.
- AC-08 Modal "¿Quién sos?" bloquea la app hasta elegir participante.
- AC-09 Intento de reabrir grupo cerrado es rechazado por la API.