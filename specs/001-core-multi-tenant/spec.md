# Spec 001 — Núcleo Multi-Tenant, Autenticación y Límites

Estado: aprobada

## Contexto y objetivo
Para que el Sistema Inteligente de Indexación funcione como un SaaS, necesitamos una arquitectura base donde las organizaciones (ONGs, Empresas) puedan registrarse, establecer su zona horaria y obtener su subdominio. Además, el sistema debe proteger los datos (Aislamiento RLS) y aplicar bloqueos automáticos basados en cuotas. Se incluye un panel de superadministrador. Se soportará registro mediante correo tradicional y OAuth (Google, Meta).

## Usuarios / Actores
- **Superadmin:** Dueño de la plataforma (Identificado vía Variable de Entorno).
- **Tenant Admin:** Administrador de la ONG/Diócesis/Empresa.
- **Digitador:** Operario invitado a trabajar en un Tenant específico.

## Historias de usuario
- **HU-1.** Como Superadmin, quiero un panel para gestionar ONGs y sus límites.
- **HU-2.** Como ONG, quiero registrarme (por email o Google/Meta), elegir mi zona horaria y reclamar un subdominio único.
- **HU-3.** Como Administrador de ONG, quiero invitar digitadores y reenviarles la invitación si la pierden.
- **HU-4.** Como Digitador, quiero usar mi misma cuenta para acceder a distintas ONGs, pero manteniendo mis accesos aislados.

## Requisitos funcionales (en EARS)
- **RF-1:** CUANDO una ONG se registra (vía email o OAuth), EL SISTEMA debe solicitarle una Zona Horaria y un subdominio deseado.
- **RF-2:** SI el subdominio deseado ya está en uso, ENTONCES EL SISTEMA debe mostrar un error y pedirle a la ONG que escriba uno diferente.
- **RF-3:** CUANDO una ONG recién registrada accede, EL SISTEMA le asigna el límite gratuito (5 folios diarios, 25 semanales).
- **RF-4:** MIENTRAS el sistema calcule límites, EL SISTEMA debe usar la Zona Horaria elegida por la ONG para determinar cuándo es "medianoche".
- **RF-5:** SI una ONG alcanza el límite de folios y un digitador intenta guardar uno nuevo, ENTONCES EL SISTEMA debe bloquear el guardado inmediatamente y mostrar el aviso: "Límite diario alcanzado".
- **RF-6:** CUANDO un Administrador invita a un digitador, EL SISTEMA debe enviar un correo y mostrar un botón en el panel para "Reenviar invitación".
- **RF-7:** EL SISTEMA debe bloquear permanentemente a nivel de Base de Datos (RLS en Postgres) cualquier consulta donde el usuario no pertenezac al `tenant_id`.
- **RF-8:** CUANDO un usuario intenta acceder a la ruta `/god-mode`, SI su correo coincide con la variable de entorno `SUPERADMIN_EMAIL`, ENTONCES EL SISTEMA debe mostrar el panel de control global.

## Criterios de finalización
- El registro de usuario crea un tenant, valida el correo/OAuth y guarda la zona horaria.
- Subdominios duplicados son rechazados en el formulario.
- Se puede navegar a `[subdominio].localhost:3000`.
- El RLS de Supabase bloquea lecturas cruzadas.
- Intentos de guardado post-límite son bloqueados con mensaje visual.
