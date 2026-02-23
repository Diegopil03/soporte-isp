// web/js/inventory.api.js
import { sb } from "./supabaseClient.js";

/**
 * Normaliza IDs y números
 */
function asString(v) {
  return v === null || v === undefined ? "" : String(v);
}
function asInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * INVENTORY ITEMS
 * Devuelve items activos para dropdown/lista.
 */
export async function fetchInventoryItems(limit = 500) {
  const { data, error } = await sb
    .from("inventory_items")
    .select("id,name,category,unit,stock_on_hand,min_stock,is_active,sku")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[inventory.api] fetchInventoryItems error", error);
    return [];
  }
  return (data || []).map((x) => ({
    ...x,
    id: asString(x.id),
    stock: x.stock_on_hand ?? x.stock ?? 0,
  }));
}

/**
 * INVENTORY ITEMS
 * "Eliminar" material = desactivarlo (soft delete) para no romper FKs con movimientos.
 */
export async function archiveInventoryItem(itemId) {
  const id = String(itemId || "").trim();
  if (!id) return { ok: false, error: "itemId inválido" };

  const { data, error } = await sb
    .from("inventory_items")
    .update({ is_active: false })
    .eq("id", id)
    .select("id,is_active")
    .single();

  if (error) {
    console.error("[inventory.api] archiveInventoryItem error", error);
    return { ok: false, error: error.message || "No se pudo eliminar" };
  }

  return { ok: true, data };
}

/**
 * MOVEMENTS by ITEM
 */
export async function fetchMovementsByItemId(itemId, limit = 20) {
  const id = asString(itemId).trim();
  if (!id) return [];

  const { data, error } = await sb
    .from("inventory_movements")
    .select(
      "id,item_id,movement_type,qty,note,ticket_id,created_at, item:inventory_items(id,name,unit,sku)"
    )
    .eq("item_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[inventory.api] fetchMovementsByItemId error", error);
    return [];
  }

  return (data || []).map(normalizeMovementRow);
}

/**
 * MOVEMENTS by TICKET
 */
export async function fetchMovementsByTicketId(ticketId, limit = 100) {
  const tid = asString(ticketId).trim();
  if (!tid) return [];

  const { data, error } = await sb
    .from("inventory_movements")
    .select(
      "id,item_id,movement_type,qty,note,ticket_id,created_at, item:inventory_items(id,name,unit,sku)"
    )
    .eq("ticket_id", tid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[inventory.api] fetchMovementsByTicketId error", error);
    return [];
  }

  return (data || []).map(normalizeMovementRow);
}

/**
 * CLOSED TICKETS (para dropdown en inventario si lo usas)
 * Ajusta el filtro de status si tu columna se llama distinto.
 */
export async function fetchClosedTickets(limit = 200) {
  const { data, error } = await sb
    .from("tickets")
    .select("id,client_name,title,status,closed_at,created_at")
    .eq("status", "cerrado")
    .order("closed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[inventory.api] fetchClosedTickets error", error);
    return [];
  }

  return (data || []).map((t) => ({
    id: asString(t.id),
    client_name: t.client_name ?? "",
    title: t.title ?? "",
    status: t.status ?? "",
    closed_at: t.closed_at ?? t.created_at ?? null,
  }));
}

/**
 * CREATE MOVEMENT
 * Inserta movimiento + actualiza stock_on_hand.
 * Nota: Esto es 2 pasos (cliente). Si más adelante quieres “transacción real”,
 * se hace con RPC en Supabase.
 */
export async function createInventoryMovement({ itemId, kind, qty, note, ticketId }) {
  const id = asString(itemId).trim();
  const movement_type = (kind === "in" ? "in" : "out"); // out default
  const q = Math.max(1, asInt(qty, 1));
  const n = asString(note).trim() || null;
  const tid = asString(ticketId).trim() || null;

  if (!id) return { ok: false, error: "missing_item_id" };

  // 1) leer stock actual
  const { data: item, error: itemErr } = await sb
    .from("inventory_items")
    .select("id,stock_on_hand")
    .eq("id", id)
    .single();

  if (itemErr) {
    console.error("[inventory.api] read item error", itemErr);
    return { ok: false, error: "read_item_failed" };
  }

  const currentStock = asInt(item?.stock_on_hand, 0);

  if (movement_type === "out" && currentStock < q) {
    return { ok: false, error: "insufficient_stock" };
  }

  // 2) insertar movimiento
  const { data: movement, error: movErr } = await sb
    .from("inventory_movements")
    .insert([
      {
        item_id: id,
        movement_type,
        qty: q,
        note: n,
        ticket_id: tid,
      },
    ])
    .select("id,item_id,movement_type,qty,note,ticket_id,created_at")
    .single();

  if (movErr) {
    console.error("[inventory.api] insert movement error", movErr);
    return { ok: false, error: "insert_failed" };
  }

  // 3) actualizar stock_on_hand
  const nextStock = movement_type === "out" ? currentStock - q : currentStock + q;

  const { error: updErr } = await sb
    .from("inventory_items")
    .update({ stock_on_hand: nextStock })
    .eq("id", id);

  if (updErr) {
    console.error("[inventory.api] update stock error", updErr);
    // movimiento ya existe; reportamos pero no “revocamos”
    return { ok: true, warning: "stock_update_failed", movement };
  }

  return { ok: true, movement, stock_on_hand: nextStock };
}

/**
 * Normaliza filas al formato que tu UI ya espera (m.item, m.movement_type, etc.)
 */
function normalizeMovementRow(m) {
  return {
    id: asString(m.id),
    item_id: asString(m.item_id),
    movement_type: m.movement_type === "in" ? "in" : "out",
    qty: asInt(m.qty, 0),
    note: m.note ?? "",
    ticket_id: m.ticket_id ? asString(m.ticket_id) : null,
    created_at: m.created_at ?? null,
    item: m.item
      ? {
          id: asString(m.item.id),
          name: m.item.name ?? "Material",
          unit: m.item.unit ?? "",
          sku: m.item.sku ?? "",
        }
      : null,
  };
}

// Create a new inventory item (Supabase table: inventory_items)
export async function createInventoryItem(payload) {
  try {
    const name = (payload?.name || "").trim();
    const category = (payload?.category || "").trim();
    const unit = (payload?.unit || "pza").trim();
    const qty = Number.isFinite(Number(payload?.qty)) ? Number(payload.qty) : 0;

    if (!name) return { ok: false, error: "Falta el nombre." };
    if (!category) return { ok: false, error: "Falta la categoría." };

    const row = {
      name,
      category,
      unit,
      stock_on_hand: qty,
      is_active: true,
    };

    const { data, error } = await sb
      .from("inventory_items")
      .insert([row])
      .select("*")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || "Error creando material." };
  }
}