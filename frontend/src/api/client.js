// Cliente HTTP único para hablar con el backend.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, { method = 'GET', body, form } = {}) {
  const opciones = { method, headers: {} };
  if (form) {
    opciones.body = form;
  } else if (body !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(body);
  }

  const res = await fetch(BASE + path, opciones);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error ?? `Error ${res.status}`);
    error.details = data.details;
    throw error;
  }
  return data;
}

const conBusqueda = (path, q) => (q ? `${path}?q=${encodeURIComponent(q)}` : path);

function formulario(archivo, extra = {}) {
  const form = new FormData();
  form.append('archivo', archivo);
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return form;
}

export const api = {
  importaciones: {
    listar: () => request('/importaciones'),
    previsualizar: (archivo) => request('/importaciones/preview', { method: 'POST', form: formulario(archivo) }),
    importar: (archivo, tipo) => request('/importaciones', { method: 'POST', form: formulario(archivo, { tipo }) }),
  },
  ingredientes: { listar: (q) => request(conBusqueda('/ingredientes', q)) },
  recetas: { listar: (q) => request(conBusqueda('/recetas', q)) },
  menus: {
    listar: () => request('/menus'),
    obtener: (id) => request(`/menus/${id}`),
    crear: (datos) => request('/menus', { method: 'POST', body: datos }),
    actualizar: (id, datos) => request(`/menus/${id}`, { method: 'PUT', body: datos }),
    eliminar: (id) => request(`/menus/${id}`, { method: 'DELETE' }),
  },
};
