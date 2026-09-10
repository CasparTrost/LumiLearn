export const BASE = import.meta.env.BASE_URL ?? '/'
export const asset = (path) => BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
