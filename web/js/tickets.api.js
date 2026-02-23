// web/js/tickets.api.js
import { sb } from "./supabaseClient.js";

/**
 * Trae tickets reales de Supabase
 * y los normaliza para UI (kanban/mapa)
 */
export async function fetchTickets() {
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[fetchTickets] error:", error);
    return [];
  }

  // ✅ Normalización: UI espera (estado, prioridad, cliente, bloque) + (lat,lng)
  return (data ?? []).map((t) => ({
    ...t,

    // Kanban compat
    estado: t.status,
    prioridad: t.priority,
    cliente: t.client_name,
    bloque: t.time_block,
    zona: t.zone, // (si tu BD usa zone)

    issue_type: t.issue_type ?? "otro",


    // Mapa compat (soporta varios nombres de columnas)
    lat: t.lat ?? t.latitude ?? t.location_lat ?? null,
    lng: t.lng ?? t.longitude ?? t.location_lng ?? null,
  }));
}

/**
 * Update status (kanban mover a...)
 */
export async function updateTicketStatus(ticketId, newStatus) {
  const { error } = await sb
    .from("tickets")
    .update({ status: newStatus })
    .eq("id", ticketId);

  if (error) {
    console.error("[updateTicketStatus] error:", error);
    return false;
  }
  return true;
}

/**
 * Ticket detail: obtener 1 ticket
 */
export async function getTicketById(ticketId) {
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (error) {
    console.error("[getTicketById] error:", error);
    return null;
  }
  return data;
}

/**
 * Ticket detail: notas
 */
export async function fetchTicketNotes(ticketId) {
  const { data, error } = await sb
    .from("ticket_notes")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[fetchTicketNotes] error:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Ticket detail: agregar nota
 */
export async function addTicketNote(ticketId, noteText) {
  const { error } = await sb.from("ticket_notes").insert({
    ticket_id: ticketId,
    note: noteText,
  });

  if (error) {
    console.error("[addTicketNote] error:", error);
    return false;
  }
  return true;
}

/**
 * Ticket detail: actualizar descripción
 */
export async function updateTicketDescription(ticketId, newDescription) {
  const { error } = await sb
    .from("tickets")
    .update({ description: newDescription })
    .eq("id", ticketId);

  if (error) {
    console.error("[updateTicketDescription] error:", error);
    return false;
  }
  return true;
}