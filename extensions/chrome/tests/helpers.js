export function memoryStorage(seed = {}) {
  const data = structuredClone(seed);
  return {
    data,
    async get(key) { return { [key]: structuredClone(data[key]) }; },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async setAccessLevel() {},
  };
}
