export function normalizeRoomCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

export function roomIdentityKey(gameType, code) {
  return `bs_board_room:${gameType}:${normalizeRoomCode(code)}`;
}

export function saveRoomIdentity(gameType, code, identity, storage = globalThis.localStorage) {
  if (!storage) return;
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== 6) return;
  try {
    storage.setItem(roomIdentityKey(gameType, normalized), JSON.stringify({
      token: String(identity?.token || ''),
      hostKey: String(identity?.hostKey || ''),
      name: String(identity?.name || '').slice(0, 20),
    }));
  } catch {}
}

export function loadRoomIdentity(gameType, code, storage = globalThis.localStorage) {
  if (!storage) return null;
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== 6) return null;
  try {
    const value = JSON.parse(storage.getItem(roomIdentityKey(gameType, normalized)) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function clearRoomIdentity(gameType, code, storage = globalThis.localStorage) {
  if (!storage) return;
  try { storage.removeItem(roomIdentityKey(gameType, code)); } catch {}
}

export async function copyRoomCode(code) {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return false;
  try {
    await navigator.clipboard.writeText(normalized);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = normalized;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
