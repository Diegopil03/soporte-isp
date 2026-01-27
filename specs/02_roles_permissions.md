# Roles y permisos

## Objetivo
Definir los perfiles de usuario y sus responsabilidades dentro del sistema.

## Roles

### Administrador
Supervisa la operación general y revisa que todo funcione correctamente.

Permisos:
- Ver todos los tickets
- Ver Kanban y mapa
- Registrar observaciones

Restricciones:
- No gestiona tickets día a día

### Coordinador
Gestiona los tickets y coordina técnicos.

Permisos:
- Crear y actualizar tickets
- Asignar técnicos
- Cambiar prioridad, estado y bloque de tiempo

Restricciones:
- No modifica configuración del sistema

### Técnico
Atiende tickets en campo.

Permisos:
- Ver tickets asignados
- Actualizar estado
- Agregar notas técnicas

Restricciones:
- No crea ni asigna tickets

### Ingeniero
Responsable técnico de la plataforma.

Permisos:
- Acceso total técnico
- Mantenimiento y mejoras

Restricciones:
- No opera tickets
