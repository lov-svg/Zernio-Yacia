# PRD — Dashboard de Análisis de Instagram (Yacia Patisserie)

## Problema original
Usuario (principiante, sin experiencia en código) adjuntó PDF "GUIA_REPLICAR_DASHBOARD.pdf" con instrucciones para construir un dashboard de análisis de su cuenta de Instagram (@yaciapatisserie, pastelería en Guadalajara, ~7,825 seguidores). Todo lo de YouTube se omite. El PDF pedía Python+Streamlit local; se adaptó al stack de la plataforma con acuerdo del usuario, con la excepción de que el usuario insistió en **Supabase** como base de datos (en lugar de MongoDB).

## Decisiones del usuario
- Base de datos: Supabase Postgres (connection string via pooler aws-0-us-east-1, la directa falla por IPv6)
- IA: clave propia de Anthropic (Claude Sonnet 4.5, model "claude-sonnet-4-5")
- Zona horaria: America/Mexico_City
- Solo Instagram, sin transcripciones de reels, sin YouTube, sin autenticación

## Arquitectura
- **Backend** FastAPI (puerto 8001, prefijo /api) + SQLAlchemy Core → Supabase Postgres (NullPool)
  - `zernio_client.py`: cliente REST Zernio (12 endpoints, retry/backoff)
  - `db.py`: 17 tablas (account_snapshot, account_health, account_insights_30d, daily_metrics, demographics, posts, comments, conversations, messages, best_time, posting_frequency, content_decay, follower_history, ideas, idea_discards, refresh_log)
  - `refresh_service.py`: orquesta el fetch completo (~80s), políticas de retención (comments 90d, messages 30d, daily_metrics 180d, snapshots sobrescritos, follower_history acumulativo)
  - `ideas_service.py`: generación con Anthropic (prompt caching ephemeral en system+contexto, descartes en bloque no cacheado, max_tokens=16000), filtros en `idea_filters.py` (ADORATION_PATTERNS, BOT_PATTERNS, sustantividad)
  - `prompts/ideas_system.md`: system prompt literal del PDF (adaptado a solo Instagram)
- **Frontend** React + shadcn + recharts, tema "Organic & Earthy" (Playfair Display + Inter, terracotta #D17D5B, fondo #FDFBF7), todo en español
  - Header sticky: foto perfil, @username, seguidores, salud, última actualización, botón "Actualizar datos"
  - 7 tabs: Resumen (KPIs 30d), Tendencia (líneas 90d multi-métrica + seguidores), Audiencia (edad/género/país/ciudad), Posts (grid ordenable + modal con comentarios reales), Cuándo publicar (heatmap 7×24 en hora local), Frecuencia (scatter + decay), Ideas (buckets comments/dms/top_content, tarjetas con 3 bloques, descarte con modal de razón, últimas descartadas)

## Claves (en /app/backend/.env, nunca en frontend)
ZERNIO_API_KEY, ZERNIO_ACCOUNT_ID=6a3b100d9d9472faaeca6e44, ANTHROPIC_API_KEY, DATABASE_URL (Supabase pooler), DASHBOARD_TZ

## Implementado (2026-06 / sesión 1)
- [x] Verificación de claves Zernio/Anthropic y detección automática de account_id
- [x] Conexión Supabase (pooler us-east-1) + creación automática de tablas
- [x] Refresh completo funcional (25 posts, comentarios, 50 conversaciones, 966 DMs, métricas, demografía)
- [x] Todas las rutas API (account, refresh, overview, trend, demographics, posts, comments, best-time, frequency, ideas, generate, discard)
- [x] Generación real de ideas probada: 16 ideas con citas verbatim de clientes
- [x] Loop de aprendizaje de descartes (últimos 50 en bloque no cacheado)
- [x] UI 7 tabs completa, testing agent 13/13 backend + 100% frontend
- [x] Fixes: React key en heatmap, DialogDescription a11y

## Backlog priorizado
- P1: Botón/aviso para regenerar cuando los datos tengan más de N días
- P1: Paginación de posts en Zernio (hoy trae los 25 más recientes)
- P2: Deploy a producción (verificar deployment_agent; nota: la app usa Supabase externo, no MongoDB)
- P2: Exportar ideas a CSV / copiar idea
- P2: Add-on de transcripciones de reels (explícitamente diferido por el usuario)

## Notas técnicas
- Zernio `/inbox/comments` devuelve POSTS; drilldown `/inbox/comments/{postId}` devuelve comentarios (campo `message`, autor en `from.username`, se filtra `from.isOwner`)
- best_time viene en UTC; el backend convierte a DASHBOARD_TZ
- Generar todas las ideas tarda ~3 min y cuesta ~$0.10-0.30 USD de la clave Anthropic del usuario
- `discarded`: 0=activa, 1=descartada por usuario, 2=reemplazada por regeneración
