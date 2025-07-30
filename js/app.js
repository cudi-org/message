import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  encryptIdentity,
  decryptIdentity,
  uint8ArrayToBase64Url,
} from "./crypto.js";

import {
  initializePeer,
  connectToPeer,
  sendData,
  closeConnection,
} from "./webrtc.js";

let userKeyPair = null;
let currentPeerId = null;
let currentChatPartnerId = null;

const onboardingScreen = document.getElementById("onboarding-screen");
const identityManagementScreen = document.getElementById(
  "identity-management-screen"
);
const createIdentityBtn = document.getElementById("create-identity-btn");
const restoreIdentityBtn = document.getElementById("restore-identity-btn");

const myPeerIdSpan = document.getElementById("my-peer-id");
const myPublicKeyTextarea = document.getElementById("my-public-key");
const copyPublicKeyBtn = document.getElementById("copy-public-key-btn");
const exportIdentityBtn = document.getElementById("export-identity-btn");
const resetAppBtn = document.getElementById("reset-app-btn");

const remotePeerIdInput = document.getElementById("remote-peer-id-input");
const connectBtn = document.getElementById("connect-btn");
const connectionStatusSpan = document.getElementById("connection-status");
const messageInput = document.getElementById("message-input");
const sendMessageBtn = document.getElementById("send-message-btn");
const messagesDisplay = document.getElementById("messages-display");

const passwordModal = document.getElementById("password-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const passwordInput = document.getElementById("password-input");
const confirmPasswordInput = document.getElementById("confirm-password-input");
const passwordActionButton = document.getElementById("password-action-btn");
const closeModalButton = passwordModal.querySelector(".close-button");

function showSection(section) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.remove("active");
  });
  section.classList.add("active");
}

function displayMessage(message, type = "received") {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", type);
  msgDiv.textContent = message;
  messagesDisplay.appendChild(msgDiv);
  messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
}

const IDENTITY_STORAGE_KEY = "cudi_messenger_identity";

async function saveIdentity(keyPair) {
  const exportedPublicKey = await exportPublicKey(keyPair.publicKey);
  const exportedPrivateKey = await exportPrivateKey(keyPair.privateKey);

  const identityData = {
    publicKey: exportedPublicKey,
    privateKey: exportedPrivateKey,
  };
  localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identityData));
  console.log("Identidad guardada en LocalStorage.");
}

async function loadIdentity() {
  const storedIdentityString = localStorage.getItem(IDENTITY_STORAGE_KEY);
  if (!storedIdentityString) {
    return null;
  }
  try {
    const identityData = JSON.parse(storedIdentityString);
    const publicKey = await importPublicKey(identityData.publicKey);
    const privateKey = await importPrivateKey(identityData.privateKey);
    console.log("Identidad cargada desde LocalStorage.");
    return { publicKey, privateKey };
  } catch (error) {
    console.error(
      "Error al cargar o importar identidad desde LocalStorage:",
      error
    );
    localStorage.removeItem(IDENTITY_STORAGE_KEY);
    return null;
  }
}

function clearIdentity() {
  localStorage.removeItem(IDENTITY_STORAGE_KEY);
  userKeyPair = null;
  currentPeerId = null;
  location.reload();
}

function handlePeerConnected(peerIdConnected) {
  connectionStatusSpan.textContent = `Conectado a: ${peerIdConnected}`;
  currentChatPartnerId = peerIdConnected;
  displayMessage(`[SISTEMA] Conectado a ${peerIdConnected}`, "system");
  remotePeerIdInput.value = peerIdConnected;
}

function handlePeerDisconnected(disconnectedPeerId) {
  connectionStatusSpan.textContent = "Desconectado";
  displayMessage(`[SISTEMA] Desconectado de ${disconnectedPeerId}`, "system");
  if (currentChatPartnerId === disconnectedPeerId) {
    currentChatPartnerId = null;
  }
}

function handleDataReceived(data) {
  displayMessage(`Peer: ${data}`, "received");
}

function handlePeerError(error) {
  console.error("Error de PeerJS en app:", error);
  connectionStatusSpan.textContent = `Error: ${error.type || error.message}`;
  displayMessage(
    `[SISTEMA] Error en la conexión PeerJS: ${error.message || error}`,
    "error"
  );
}

let passwordModalAction = null;

function openPasswordModal(title, message, action, showConfirm = true) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  passwordInput.value = "";
  confirmPasswordInput.value = "";
  confirmPasswordInput.style.display = showConfirm ? "block" : "none";
  passwordModalAction = action;
  passwordModal.style.display = "flex";
}

function closePasswordModal() {
  passwordModal.style.display = "none";
  passwordInput.value = "";
  confirmPasswordInput.value = "";
  confirmPasswordInput.style.display = "none";
  passwordModalAction = null;
}

async function initializeApp() {
  const storedIdentity = await loadIdentity();

  if (storedIdentity) {
    userKeyPair = storedIdentity;
    const publicKeyBase64Url = await exportPublicKey(userKeyPair.publicKey);
    const idForPeerJS = publicKeyBase64Url.substring(0, 36);
    currentPeerId = idForPeerJS;

    myPeerIdSpan.textContent = currentPeerId;
    myPublicKeyTextarea.value = publicKeyBase64Url;

    await initializePeer(
      currentPeerId,
      handlePeerConnected,
      handlePeerDisconnected,
      handleDataReceived,
      handlePeerError
    );
    showSection(identityManagementScreen);
  } else {
    showSection(onboardingScreen);
  }
}

createIdentityBtn.addEventListener("click", async () => {
  try {
    userKeyPair = await generateKeyPair();
    await saveIdentity(userKeyPair);

    const publicKeyBase64Url = await exportPublicKey(userKeyPair.publicKey);
    const idForPeerJS = publicKeyBase64Url.substring(0, 36);
    currentPeerId = idForPeerJS;

    myPeerIdSpan.textContent = currentPeerId;
    myPublicKeyTextarea.value = publicKeyBase64Url;

    await initializePeer(
      currentPeerId,
      handlePeerConnected,
      handlePeerDisconnected,
      handleDataReceived,
      handlePeerError
    );
    showSection(identityManagementScreen);
    alert(
      "¡Nueva identidad creada y guardada! Recuerda exportarla para tener un respaldo."
    );
  } catch (error) {
    console.error("Error al crear nueva identidad:", error);
    alert("No se pudo crear una nueva identidad. Consulta la consola.");
  }
});

restoreIdentityBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,text/plain";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileContent = event.target.result;
        let parsedIdentity = null;

        try {
          const encryptedData = JSON.parse(fileContent);
          if (
            encryptedData.encryptedData &&
            encryptedData.salt &&
            encryptedData.iv
          ) {
            openPasswordModal(
              "Descifrar Identidad",
              "Introduce la contraseña para descifrar tu identidad:",
              "import",
              false
            );
            passwordActionButton.onclick = async () => {
              const password = passwordInput.value;
              if (!password) {
                alert("Por favor, introduce una contraseña.");
                return;
              }
              try {
                parsedIdentity = await decryptIdentity(encryptedData, password);
                if (!parsedIdentity.publicKey || !parsedIdentity.privateKey) {
                  throw new Error(
                    "Contenido descifrado no es una identidad válida."
                  );
                }
                await processRestoredIdentity(parsedIdentity);
                closePasswordModal();
                alert("Identidad restaurada y descifrada con éxito.");
              } catch (decryptionError) {
                console.error("Error al descifrar identidad:", decryptionError);
                alert("Contraseña incorrecta o archivo corrupto.");
              }
            };
            return;
          }
        } catch (jsonError) {
          try {
            const privateKeyOnly = fileContent.trim();
            const privateKey = await importPrivateKey(privateKeyOnly);
            throw new Error("Formato de archivo no soportado o no cifrado.");
          } catch (plainTextError) {
            throw new Error(
              "Formato de archivo no soportado. Debe ser JSON cifrado o clave privada válida."
            );
          }
        }
      } catch (error) {
        console.error("Error al restaurar identidad:", error);
        alert(
          "Error al procesar el archivo de identidad. Asegúrate de que es un archivo válido."
        );
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

async function processRestoredIdentity(parsedIdentity) {
  userKeyPair = {
    publicKey: await importPublicKey(parsedIdentity.publicKey),
    privateKey: await importPrivateKey(parsedIdentity.privateKey),
  };
  await saveIdentity(userKeyPair); // Guardar en localStorage
  const publicKeyBase64Url = await exportPublicKey(userKeyPair.publicKey);
  const idForPeerJS = publicKeyBase64Url.substring(0, 36);
  currentPeerId = idForPeerJS;

  myPeerIdSpan.textContent = currentPeerId;
  myPublicKeyTextarea.value = publicKeyBase64Url;

  await initializePeer(
    currentPeerId,
    handlePeerConnected,
    handlePeerDisconnected,
    handleDataReceived,
    handlePeerError
  );
  showSection(identityManagementScreen);
}

copyPublicKeyBtn.addEventListener("click", () => {
  myPublicKeyTextarea.select();
  document.execCommand("copy");
  alert("Clave pública copiada al portapapeles.");
});

exportIdentityBtn.addEventListener("click", () => {
  if (!userKeyPair) {
    alert("Primero crea o carga una identidad.");
    return;
  }
  openPasswordModal(
    "Exportar Identidad",
    "Introduce una contraseña para cifrar tu identidad. ¡No la olvides!",
    "export",
    true
  );

  passwordActionButton.onclick = async () => {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (
      !password ||
      (confirmPasswordInput.style.display === "block" &&
        password !== confirmPassword)
    ) {
      alert("Las contraseñas no coinciden o están vacías.");
      return;
    }

    try {
      const identityToEncrypt = {
        publicKey: await exportPublicKey(userKeyPair.publicKey),
        privateKey: await exportPrivateKey(userKeyPair.privateKey),
      };
      const encryptedData = await encryptIdentity(identityToEncrypt, password);

      const blob = new Blob([JSON.stringify(encryptedData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cudi_identity_${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(
        "Identidad exportada con éxito. ¡Guarda el archivo y la contraseña en un lugar seguro!"
      );
      closePasswordModal();
    } catch (error) {
      console.error("Error al exportar identidad:", error);
      alert(
        "Error al exportar identidad. Asegúrate de que las contraseñas coincidan y vuelve a intentarlo."
      );
    }
  };
});

resetAppBtn.addEventListener("click", () => {
  if (
    confirm(
      "¿Estás seguro de que quieres borrar tu identidad y reiniciar la aplicación? Esto no se puede deshacer."
    )
  ) {
    clearIdentity();
  }
});

connectBtn.addEventListener("click", () => {
  const remoteId = remotePeerIdInput.value.trim();
  if (remoteId && currentPeerId) {
    connectToPeer(remoteId);
  } else {
    alert(
      "Por favor, introduce un ID de Peer remoto y asegúrate de tener una identidad activa."
    );
  }
});

sendMessageBtn.addEventListener("click", () => {
  const message = messageInput.value.trim();
  if (message) {
    sendData(message);
    displayMessage(`Tú: ${message}`, "sent");
    messageInput.value = "";
  }
});

closeModalButton.addEventListener("click", closePasswordModal);
window.addEventListener("click", (event) => {
  if (event.target == passwordModal) {
    closePasswordModal();
  }
});

initializeApp();
