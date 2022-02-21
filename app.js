const express = require("express");
const socketIO = require("socket.io");
const { Client, MessageMedia } = require("whatsapp-web.js");
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

//izin browser
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', "*");
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  next();
})

const SESSION_FILE_PATH = "./wa-session.json";
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      // "--single-process", // <- this one doesn't works in Windows
      "--disable-gpu",
    ],
  },
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
  } else if (msg.body == "gi") {
    msg.reply("oi");
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

//checking nomer WA apakah sudah teregister atau belum
const checkRegisteredNumber = async function (number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
};

//number formater
const phoneNumberFormatter = function (number) {
  // 1. Menghilangkan karakter selain angka
  let formatted = number.replace(/\D/g, "");

  // 2. Menghilangkan angka 0 di depan (prefix)
  //    Kemudian diganti dengan 62
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1);
  }

  if (!formatted.endsWith("@c.us")) {
    formatted += "@c.us";
  }

  return formatted;
};

//routing
app.post("/wa-send", async (req, res, next) => {
  const no = phoneNumberFormatter(req.body.no);
  const pesan = req.body.pesan;
  //   res.send(req.body)

  const isRegisteredNumber = await checkRegisteredNumber(no);
  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: "Nomer ini belum terdaftar di WhatsApp",
    });
  }
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
app.post("/wa-send-attach", async (req, res, next) => {
  const no = phoneNumberFormatter(req.body.no);
  const pesan = req.body.pesan;
  const media = MessageMedia.fromFilePath(req.body.filePath);
  //   res.send(req.body)

  const isRegisteredNumber = await checkRegisteredNumber(no);
  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: "Nomer ini belum terdaftar di WhatsApp",
    });
  }
  // const media = MessageMedia.fromFilePath('./files/space-rocket-launch.png')

  client
    .sendMessage(no, media, {caption: pesan})
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
