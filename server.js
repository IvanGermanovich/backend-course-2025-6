const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { v4: uuidv4 } = require("uuid");

const program = new Command();

program
  .requiredOption("-h, --host <host>", "server host")
  .requiredOption("-p, --port <port>", "server port")
  .requiredOption("-c, --cache <path>", "cache directory");

program.parse(process.argv);

const options = program.opts();

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

const uploadDir = path.join(options.cache, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const inventory = [];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "Inventory management service"
    }
  },
  apis: ["./server.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/inventory", (req, res) => {
  const data = inventory.map(item => ({
    ...item,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null
  }));

  res.status(200).json(data);
});

app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).json({ error: "inventory_name is required" });
  }

  const item = {
    id: uuidv4(),
    inventory_name,
    description: description || "",
    photo: req.file ? req.file.filename : null
  };

  inventory.push(item);

  res.status(201).json({
    message: "Inventory item registered",
    item
  });
});

app.get("/inventory/:id", (req, res) => {
  const item = inventory.find(i => i.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  res.status(200).json({
    ...item,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null
  });
});

app.put("/inventory/:id", (req, res) => {
  const item = inventory.find(i => i.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  const { inventory_name, description } = req.body;

  if (inventory_name) {
    item.inventory_name = inventory_name;
  }

  if (description) {
    item.description = description;
  }

  res.status(200).json({
    message: "Item updated",
    item
  });
});

app.get("/inventory/:id/photo", (req, res) => {
  const item = inventory.find(i => i.id === req.params.id);

  if (!item || !item.photo) {
    return res.status(404).json({ error: "Photo not found" });
  }

  const filePath = path.join(uploadDir, item.photo);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Photo file missing" });
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.status(200).sendFile(filePath);
});

app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = inventory.find(i => i.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Photo is required" });
  }

  item.photo = req.file.filename;

  res.status(200).json({
    message: "Photo updated",
    item
  });
});

app.delete("/inventory/:id", (req, res) => {
  const index = inventory.findIndex(i => i.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Item not found" });
  }

  inventory.splice(index, 1);

  res.status(200).json({
    message: "Item deleted"
  });
});

app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

app.all("/search", (req, res, next) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  next();
});

app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;

  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  let response = {
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description
  };

  if (has_photo) {
    response.photo_url = `/inventory/${item.id}/photo`;
  }

  res.status(200).json(response);
});

app.get("/search", (req, res) => {
  const { id, includePhoto } = req.query;

  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  let response = {
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description
  };

  if (includePhoto) {
    response.photo_url = `/inventory/${item.id}/photo`;
  }

  res.status(200).json(response);
});

app.use((req, res) => {
  res.status(405).json({ error: "Method not allowed" });
});

app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
