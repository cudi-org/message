// crypto.js

// Funciones para manipular Base64Url
const base64UrlToUint8Array = (base64Url) => {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const uint8ArrayToBase64Url = (uint8Array) => {
  const base64 = window.btoa(String.fromCharCode.apply(null, uint8Array));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

// --- Generación y Gestión de Claves ---

async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true, // extractable
    ["sign", "verify"]
  );
  return keyPair;
}

async function exportPublicKey(publicKey) {
  const exported = await window.crypto.subtle.exportKey("jwk", publicKey);
  return uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(exported))
  );
}

async function exportPrivateKey(privateKey) {
  const exported = await window.crypto.subtle.exportKey("jwk", privateKey);
  return uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(exported))
  );
}

async function importPublicKey(publicKeyBase64Url) {
  const jwk = JSON.parse(
    new TextDecoder().decode(base64UrlToUint8Array(publicKeyBase64Url))
  );
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true, // extractable
    ["verify"]
  );
}

async function importPrivateKey(privateKeyBase64Url) {
  const jwk = JSON.parse(
    new TextDecoder().decode(base64UrlToUint8Array(privateKeyBase64Url))
  );
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true, // extractable
    ["sign"]
  );
}

// --- Cifrado y Descifrado de Identidad con Contraseña ---

async function deriveKeyFromPassword(password, salt, iterations) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = base64UrlToUint8Array(salt); // El salt debe ser un Uint8Array

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 }, // Usamos AES-256 GCM para el cifrado
    true, // extractable
    ["encrypt", "decrypt"]
  );
  return derivedKey;
}

async function encryptIdentity(identityJson, password) {
  const encoder = new TextEncoder();
  const dataToEncrypt = encoder.encode(JSON.stringify(identityJson));

  const salt = window.crypto.getRandomValues(new Uint8Array(16)); // 16 bytes de salt
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes de IV para AES-GCM
  const iterations = 100000; // Un número alto de iteraciones para PBKDF2

  const derivedKey = await deriveKeyFromPassword(
    password,
    uint8ArrayToBase64Url(salt),
    iterations
  );

  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    derivedKey,
    dataToEncrypt
  );

  // Devolvemos un objeto con todo lo necesario para descifrar
  return {
    encryptedData: uint8ArrayToBase64Url(new Uint8Array(encryptedContent)),
    salt: uint8ArrayToBase64Url(salt),
    iv: uint8ArrayToBase64Url(iv),
    iterations: iterations,
  };
}

async function decryptIdentity(encryptedIdentityObject, password) {
  const { encryptedData, salt, iv, iterations } = encryptedIdentityObject;

  const derivedKey = await deriveKeyFromPassword(password, salt, iterations);

  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToUint8Array(iv),
    },
    derivedKey,
    base64UrlToUint8Array(encryptedData)
  );

  return JSON.parse(new TextDecoder().decode(decryptedContent));
}

export {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  encryptIdentity,
  decryptIdentity,
  uint8ArrayToBase64Url, // Exporta para usar si necesitas convertir claves a ID de Peer
};
