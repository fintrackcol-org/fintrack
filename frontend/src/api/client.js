import { API_V1 } from '@/lib/api';
import { regionHeaders } from '@/lib/region';
import { getSession } from '@/auth/tokenStorage';
import { t } from '@/lib/i18n';

function send(path, options = {}) {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json', ...regionHeaders() };

  if (session) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const config = { ...options, headers };
  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  return fetch(`${API_V1}${path}`, config);
}

export async function apiFetch(path, options = {}) {
  const res = await send(path, options);
  if (res.status === 204) {
    return null;
  }
  const info = await res.json();
  if (!res.ok) {
    throw new Error(info.error?.message || t('Algo salió mal. Inténtalo de nuevo.'));
  }
  return info;
}
