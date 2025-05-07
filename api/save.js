// api/save.js
const { MongoClient } = require("mongodb");

// La conexión se obtiene de una variable de entorno; asegúrate de configurarla en Vercel.
const uri = process.env.MONGODB_URI;

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
    return cachedClient;
  }
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  cachedClient = await client.connect();
  return cachedClient;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method Not Allowed" });
    return;
  }
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ success: false, error: "El campo 'text' es requerido" });
    return;
  }
  try {
    const client = await connectToDatabase();
    const db = client.db("pwa");
    const collection = db.collection("reports");
    const data = { text, date: new Date() };
    const result = await collection.insertOne(data);
    res.status(200).json({ success: true, data: { ...data, _id: result.insertedId } });
  } catch (error) {
    console.error("Error en /api/save:", error);
    res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
};
