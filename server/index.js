import express, { response } from "express";
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
});


io.on("connection", (socket) => {
  console.log("A user connected");

  // Recover historical messages only once per connection.
  if (!socket.recovered) {
    (async () => {
      const userid = socket.handshake.auth.userid;
      const offset = socket.handshake.auth.serverOffset ?? 0;
      try {
        const results = await db.execute({
          sql: `
        SELECT id, user_id, mensaje, username, fecha FROM (
          SELECT m.id, m.user_id, m.mensaje, u.user AS username, m.fecha_mensaje AS fecha
          FROM mensajes m
          JOIN usuarios u ON m.user_id = u.id
          WHERE m.id > ? AND m.user_id = ?
          UNION ALL
          SELECT b.id, 'BOT' AS user_id, b.respuesta AS mensaje, b.nombre AS username, b.fecha_respuesta AS fecha
          FROM bots b
          WHERE b.id > ? AND b.user_id = ?
        ) AS combined
        ORDER BY fecha
          `,
          args: [offset, userid, offset, userid]
        });
        results.rows.forEach(row => {
          // Cast user_id to string for correct client-side matching.
          socket.emit('chat message', row.mensaje, row.id.toString(), row.username, row.user_id.toString(), row.fecha);
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
    const userid = socket.handshake.auth.userid;
    console.log({ username, userid });

    try {
      const userCheck = await db.execute({
        sql: 'SELECT id FROM usuarios WHERE id = (:userid)',
        args: { userid }
      });
      
      if (userCheck.rows.length === 0) {
        await db.execute({
          sql: "INSERT INTO usuarios (id, user) VALUES (:userid, :username)",
          args: { userid, username }
        });
      }
      result = await db.execute({
        sql: "INSERT INTO mensajes (mensaje, user_id) VALUES (:msg, :userid)",
        args: { msg, userid }
      });
    } catch (e) {
      console.error(e);
      return;
    }

    generateText(msg).then((response) => {
      // Emit the bot response only to the user.
      socket.emit("chat message", response, socket.handshake.auth.serverOffset, "BOT", "BOT");
      const userid = socket.handshake.auth.userid;
      const bot = "gemini";
      try {
        db.execute({
          sql: `INSERT INTO bots (nombre, respuesta, user_id) VALUES (:bot, :msg, :userid)`, // Removed trailing comma from columns list
          args: {bot, msg: response, userid }
        });
      } catch (e) {
        console.error(e);
      }
    })
    .catch((error) => {
      console.error(error);
    });
    
    // Emit the original message only to the user.
    socket.emit('chat message', msg, result.lastInsertRowid.toString(), username, userid);
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
