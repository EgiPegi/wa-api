const express = require("express");
const socketIO = require("socket.io");
const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const fs = require("fs");
const http = require("http");
const port = 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// parse requests of content-type - application/json
app.use(express.json({ limit: "50mb" }));

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const SESSION_FILE_PATH = "./wa-session.json";
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
  puppeteer: { headless: true },
  session: sessionCfg,
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

client.on("auth_failure", (msg) => {
  // Fired if session restore was unsuccessfull
  console.error("AUTHENTICATION FAILURE", msg);
});

client.on("message", (msg) => {
  if (msg.body == "halo") {
    msg.reply("Test Auto Reply WHATSAPP API");
  }
});

client.initialize();

io.on("connection", (socket) => {
  socket.emit("message", "connecting...");
  client.on("qr", (qr) => {
    // Generate and scan this code with your phone
    console.log("QR RECEIVED", qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit("qr", url);
      socket.emit(
        "message",
        "qrcode diterima, silahkan untuk melakukan scanning"
      );
    });
  });

  client.on("ready", () => {
    socket.emit("ready", "Berhasil Terhubung ke WhatsApp");
    socket.emit("message", "Berhasil Terhubung ke WhatsApp");
    console.log("Client is ready!");
  });

  client.on("authenticated", (session) => {
    socket.emit("authenticated", "Berhasil authenticated ke WhatsApp");
    socket.emit("message", "Berhasil authenticated ke WhatsApp");
    console.log("AUTHENTICATED", session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
        console.error(err);
      }
    });
  });
});

//routing
app.post("/wa-send", (req, res, next) => {
  const no = req.body.no;
  const pesan = req.body.pesan;
  //   res.send(req.body)

  client
    .sendMessage(no, pesan)
    .then((rs) => {
      res.send(rs);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while send message.",
      });
      console.log(err.message);
    });
});

server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
