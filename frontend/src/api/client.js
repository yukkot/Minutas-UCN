// Cliente HTTP único para hablar con el backend.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, { method = 'GET', body, form, params } = {}) {
  const opciones = { method, headers: {} };
  if (form) {
    opciones.body = form;
  } else if (body !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(body);
  }

  const res = await fetch(BASE + path + queryString(params), opciones);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error ?? `Error ${res.status}`);
    error.status = res.status;
    error.details = data.details;
    throw error;
  }
  return data;
}

/** { a: 1, b: null } -> "?a=1" (omite vacíos) */
function queryString(params = {}) {
  const limpios = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return limpios.length ? `?${new URLSearchParams(limpios)}` : '';
}

function formulario(archivo, campos = {}) {
  const form = new FormData();
  form.append('archivo', archivo);
  Object.entries(campos)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .forEach(([k, v]) => form.append(k, v));
  return form;
}

export const ESTADOS_ACTIVOS = ['pendiente', 'procesando'];
export const estaActiva = (importacion) => ESTADOS_ACTIVOS.includes(importacion?.estado);

export const api = {
  importaciones: {
    listar: (params) => request('/importaciones', { params }),
    obtener: (id) => request(`/importaciones/${id}`),
    formatos: () => request('/importaciones/formatos'),
    previsualizar: (archivo, tipo) =>
      request('/importaciones/preview', { method: 'POST', form: formulario(archivo, { tipo }) }),
    /** Encola el archivo. destino: { lista_id, modo } o { lista_nombre }. Responde 202 con el trabajo. */
    importar: (archivo, tipo, destino = {}) =>
      request('/importaciones', { method: 'POST', form: formulario(archivo, { tipo, ...destino }) }),
    reintentar: (id) => request(`/importaciones/${id}/reintentar`, { method: 'POST' }),
  },
  listas: {
    listar: (tipo = 'ingredientes') => request('/listas', { params: { tipo } }),
    crear: (datos) => request('/listas', { method: 'POST', body: datos }),
    actualizar: (id, datos) => request(`/listas/${id}`, { method: 'PATCH', body: datos }),
    eliminar: (id) => request(`/listas/${id}`, { method: 'DELETE' }),
  },
  ingredientes: {
    /** { lista_id, q, pagina, por_pagina } -> { total, pagina, por_pagina, items } */
    listar: (params) => request('/ingredientes', { params }),
    nutrientes: () => request('/ingredientes/nutrientes'),
  },
  recetas: { listar: (q) => request('/recetas', { params: { q } }) },
  menus: {
    listar: () => request('/menus'),
    obtener: (id) => request(`/menus/${id}`),
    crear: (datos) => request('/menus', { method: 'POST', body: datos }),
    actualizar: (id, datos) => request(`/menus/${id}`, { method: 'PUT', body: datos }),
    eliminar: (id) => request(`/menus/${id}`, { method: 'DELETE' }),
  },
};
