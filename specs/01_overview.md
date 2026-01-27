# Visión general del sistema

## Objetivo
Definir el propósito del sistema interno de soporte técnico del ISP y el contexto en el que será utilizado.

## Contexto
El ISP opera principalmente en zonas de casas de descanso, donde la mayoría de los tickets se generan por cortes de fibra. El sistema busca optimizar la gestión operativa sin depender completamente de plataformas externas.

## Objetivo general
Diseñar e implementar una plataforma interna que centralice la gestión de tickets, técnicos, visitas e inventario, facilitando la operación diaria y la toma de decisiones.

## Alcance
Incluye:
- Gestión interna de tickets
- Kanban operativo
- Vista de mapa
- Inventario básico
- Roles de usuario

No incluye:
- Atención directa al cliente
- Facturación
- SLA con horarios exactos
- Integración automática con WispHub (fase futura)

## Supuestos y restricciones
- WispHub es el sistema origen de los tickets
- El sistema es de uso interno
- La integración automática queda sujeta a disponibilidad de API
