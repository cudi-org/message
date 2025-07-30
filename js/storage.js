const IDENTITY_STORAGE_KEY = "cudi_messenger_identity";

async function saveIdentity(identity) {
  try {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch (error) {
    console.error("Error al guardar la identidad en localStorage:", error);
    throw error;
  }
}

async function loadIdentity() {
  try {
    const stored = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error("Error al cargar la identidad de localStorage:", error);
    return null;
  }
}

async function deleteIdentity() {
  try {
    localStorage.removeItem(IDENTITY_STORAGE_KEY);
  } catch (error) {
    console.error("Error al eliminar la identidad de localStorage:", error);
    throw error;
  }
}

export { saveIdentity, loadIdentity, deleteIdentity };
