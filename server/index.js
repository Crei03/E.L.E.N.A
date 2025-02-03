import express from "express";
import logger from "morgan";
import { createServer } from "node:http";
import { Server } from "socket.io";
import generateText from "./gemini.cjs";

const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app);

const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("chat message", (msg) => {
    socket.broadcast.emit("chat message", msg);

    // generateText(msg)
    //   .then((response) => {
    //     io.emit("chat message", response);
    //     console.log(response);
    //   })
    //   .catch((error) => {
    //     console.error(error);
    //   });
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
