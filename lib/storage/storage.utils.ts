export async function getStorageInformation() {
  if (!navigator.storage?.estimate) {
    return null;
  }

  const estimate = await navigator.storage.estimate();

  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    usageMB: ((estimate.usage ?? 0) / (1024 * 1024)).toFixed(2),
    quotaMB: ((estimate.quota ?? 0) / (1024 * 1024)).toFixed(2),
  };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    return false;
  }

  return navigator.storage.persist();
}
