const STORAGE_KEY = 'SAMA_BU_CONNECTION_STATUS';

export function loadConnectionStatus(buId: string): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, 'success' | 'failed'>;
    const val = data[buId];
    if (val === 'success') return true;
    if (val === 'failed') return false;
    return null;
  } catch {
    return null;
  }
}

export function saveConnectionStatus(buId: string, status: 'success' | 'failed') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: Record<string, 'success' | 'failed'> = raw ? JSON.parse(raw) : {};
    data[buId] = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function clearConnectionStatus(buId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, string>;
    delete data[buId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
