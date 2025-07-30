import { uint8ArrayToBase64Url } from "./crypto.js";

let peer = null;
let currentConnection = null;
let peerId = null;

let onDataReceivedCallback = null;
let onPeerConnectedCallback = null;
let onPeerDisconnectedCallback = null;
let onPeerErrorCallback = null;

const PEER_SERVER_CONFIG = {
  host: "cudi-sync-signalin.onrender.com",
  port: 443,
  path: "/peerjs",
  secure: true,
};

async function initializePeer(
  idForPeerJS,
  onConnected,
  onDisconnected,
  onData,
  onError
) {
  if (peer && peer.open) {
    console.log("PeerJS ya está inicializado y abierto.");
    if (onConnected) onConnected(peerId);
    return;
  }

  peerId = idForPeerJS;
  console.log("Intentando inicializar PeerJS con ID:", peerId);

  onDataReceivedCallback = onData;
  onPeerConnectedCallback = onConnected;
  onPeerDisconnectedCallback = onDisconnected;
  onPeerErrorCallback = onError;

  try {
    peer = new Peer(peerId, PEER_SERVER_CONFIG);

    peer.on("open", (id) => {
      console.log("Mi ID de Peer es:", id);
      if (onPeerConnectedCallback) onPeerConnectedCallback(id);
    });

    peer.on("connection", (conn) => {
      console.log("Conexión entrante de:", conn.peer);
      currentConnection = conn;

      conn.on("open", () => {
        console.log("Conexión de datos abierta con:", conn.peer);
        if (onPeerConnectedCallback) onPeerConnectedCallback(conn.peer);
      });

      conn.on("data", (data) => {
        console.log("Datos recibidos de Peer:", conn.peer, data);
        if (onDataReceivedCallback) onDataReceivedCallback(data);
      });

      conn.on("close", () => {
        console.log("Conexión de datos cerrada con:", conn.peer);
        if (onPeerDisconnectedCallback) onPeerDisconnectedCallback(conn.peer);
        currentConnection = null;
      });

      conn.on("error", (err) => {
        console.error("Error en la conexión con", conn.peer, err);
        if (onPeerErrorCallback) onPeerErrorCallback(err);
      });
    });

    peer.on("disconnected", () => {
      console.log("Desconectado del servidor PeerJS.");
      if (onPeerDisconnectedCallback) onPeerDisconnectedCallback(peerId);
      currentConnection = null;
    });

    peer.on("error", (err) => {
      console.error("Error en PeerJS:", err);
      if (onPeerErrorCallback) onPeerErrorCallback(err);
    });
  } catch (error) {
    console.error("Error al inicializar PeerJS:", error);
    if (onPeerErrorCallback) onPeerErrorCallback(error);
  }
}

function connectToPeer(remotePeerId) {
  if (!peer || !peer.open) {
    console.error(
      "PeerJS no está inicializado o abierto. Llama a initializePeer primero."
    );
    if (onPeerErrorCallback)
      onPeerErrorCallback(new Error("PeerJS not initialized."));
    return;
  }
  if (remotePeerId === peerId) {
    alert("No puedes conectar contigo mismo.");
    return;
  }

  if (currentConnection && currentConnection.open) {
    console.log("Ya hay una conexión activa. Cerrando la anterior.");
    currentConnection.close();
  }

  console.log(`Intentando conectar a ${remotePeerId}...`);
  const conn = peer.connect(remotePeerId);

  conn.on("open", () => {
    console.log("Conexión de datos abierta con:", conn.peer);
    currentConnection = conn;
    if (onPeerConnectedCallback) onPeerConnectedCallback(conn.peer);
  });

  conn.on("data", (data) => {
    console.log("Datos recibidos de Peer:", conn.peer, data);
    if (onDataReceivedCallback) onDataReceivedCallback(data);
  });

  conn.on("close", () => {
    console.log("Conexión de datos cerrada con:", conn.peer);
    if (onPeerDisconnectedCallback) onPeerDisconnectedCallback(conn.peer);
    currentConnection = null;
  });

  conn.on("error", (err) => {
    console.error("Error en la conexión con", conn.peer, err);
    if (onPeerErrorCallback) onPeerErrorCallback(err);
  });
}

function sendData(data) {
  if (currentConnection && currentConnection.open) {
    currentConnection.send(data);
    console.log("Datos enviados:", data);
  } else {
    console.warn("No hay conexión de datos activa para enviar el mensaje.");
  }
}

function closeConnection() {
  if (currentConnection) {
    currentConnection.close();
    currentConnection = null;
    console.log("Conexión WebRTC cerrada manualmente.");
  }
}

export {
  initializePeer,
  connectToPeer,
  sendData,
  closeConnection,
  peerId,
  currentConnection,
};
