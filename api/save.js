const { MongoClient } = require("mongodb");

// Verifica que la variable de entorno esté definida
if (!process.env.MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

const uri = process.env.MONGODB_URI;
let cachedClient = null;

/**
 * Conecta a la base de datos y reutiliza la conexión si es posible.
 */
async function connectToDatabase() {
  // Verifica que cachedClient exista y esté conectado.
  if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
    return cachedClient;
  }
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  cachedClient = await client.connect();
  return cachedClient;
}

/**
 * Handler principal del endpoint.
 * Se espera que se invoque únicamente con el método POST y un JSON que contenga { text }.
 */
module.exports = async (req, res) => {
  // Permitir únicamente el método POST
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
    const db = client.db("pwa"); // Asegúrate de que la base de datos se llame "pwa" o cámbiala según corresponda
    const collection = db.collection("reports");
    const data = { text, date: new Date() };
    const result = await collection.insertOne(data);
    res.status(200).json({ success: true, data: { ...data, _id: result.insertedId } });
  } catch (error) {
    console.error("Error en /api/save:", error);
    res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
};
