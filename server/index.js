import express from "express";
import logger from "morgan";
import { createServer } from "node:http";
import { Server } from "socket.io";
import generateText from "./gemini.cjs";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config();
const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app);

const io = new Server(server,{
  connectionStateRecovery: {}
});

const db = createClient({
  url: process.env.url,
  authToken: process.env.authToken,
})


io.on("connection", (socket) => {
  console.log("A user connected");

  // Recover historical messages only once per connection.
  if (!socket.recovered) {
    (async () => {
      try {
        const username = socket.handshake.auth.username ;
        const results = await db.execute({
          sql: 'SELECT id, content, user FROM messages WHERE id > ?',
          args: [socket.handshake.auth.serverOffset ?? 0]
        });
        results.rows.forEach(row => {
          socket.emit('chat message', row.content, row.id.toString(), row.user);
        });
      } catch (e) {
        console.error(e);
      }
      socket.recovered = true;
    })();
  }

  socket.on('chat message', async (msg) => {
    let result;
    const username = socket.handshake.auth.username ?? 'Anonimo';
    console.log({ username });
    try {
      result = await db.execute({
        sql: `INSERT INTO messages (content, user) VALUES (:msg, :username)`,
        args: { msg, username }
      });
    } catch (e) {
      console.error(e);
      return;
    }
    
    // Emit the new message to all sockets.
    io.emit('chat message', msg, result.lastInsertRowid.toString(), username);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.use(logger("dev"));
app.use(express.static('client')); // Add this line to serve static files

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
