const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(
  cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], credentials: true })
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "OPTIONS"], credentials: true },
  transports: ["websocket", "polling"],
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`User ${userName} (${socket.id}) joined room ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { code: "", users: new Map() });
    }

    const room = rooms.get(roomId);
    room.users.set(socket.id, { id: socket.id, name: userName });

    socket.emit("initial-code", room.code);
    io.to(roomId).emit("users-update", Array.from(room.users.values()));
  });

  socket.on("code-change", ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.code !== code) {
        room.code = code;
        socket.to(roomId).emit("code-update", code);
      }
    }
  });

  socket.on("cursor-update", ({ roomId, position }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const user = room.users.get(socket.id);
      if (user) {
        socket.to(roomId).emit("cursor-moved", {
          userId: socket.id,
          userName: user.name,
          position,
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        io.to(roomId).emit("users-update", Array.from(room.users.values()));
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Code server running on port ${PORT}`);
});
