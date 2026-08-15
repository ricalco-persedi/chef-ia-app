import { Router } from 'express';
import { upload } from '../config/multer.js';
import { ai, MODEL_CANDIDATES } from '../config/genai.js';
import fs from 'fs';

const router = Router();

async function generateContentWithFallback(contents) {
  let lastError = null;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`📡 Invocando Gemini con Salud, Maridaje y Multifoto: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
      });
      return { text: response.text, modelUsed: modelName };
    } catch (error) {
      console.warn(`⚠️ Fallo en modelo ${modelName}:`, error.message || error);
      lastError = error;
    }
  }
  throw lastError;
}

router.post('/analizar-imagen', upload.array('imagenes', 4), async (req, res) => {
  let uploadedPaths = [];

  try {
    const { ubicacion, condicionesSalud, preferenciaBebida, modoCocina, preferenciaTexto, estiloComida, comensales, sorprendeme } = req.body;
    const saludList = condicionesSalud ? JSON.parse(condicionesSalud) : [];

    let contents = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        uploadedPaths.push(file.path);
        const imageBuffer = fs.readFileSync(file.path);
        contents.push({
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: file.mimetype
          }
        });
      }
    }

    let saludInstructions = saludList.length > 0 
      ? `🚨 RESTRICCIONES MÉDICAS Y ALIMENTARIAS OBLIGATORIAS: ${saludList.join(', ')}. DEBES garantizar que NINGÚN ingrediente, preparación o BEBIDA transgreda estas condiciones (ej: si es diabético, bebidas sin azúcar agregada; si es hipertenso, bajo en sodio/alcohol moderado).`
      : `Sin restricciones de salud especificadas.`;

    let bebidalInstruction = "";
    if (preferenciaBebida === 'solo_sin_alcohol') {
      bebidalInstruction = "Recomienda exclusivamente 2 opciones de MARIDAJE SIN ALCOHOL (ej: mocktails, infusiones frías, aguas saborizadas naturales, kombuchas).";
    } else if (preferenciaBebida === 'solo_con_alcohol') {
      bebidalInstruction = "Recomienda exclusivamente 2 opciones de MARIDAJE CON ALCOHOL (ej: cepas de vino específicas, cervezas artesanales, cócteles clásicos).";
    } else {
      bebidalInstruction = "Recomienda OBLIGATORIAMENTE 2 opciones de maridaje: 1 Opción CON ALCOHOL (vino, cerveza o cóctel) y 1 Opción SIN ALCOHOL (mocktail, limonada botánica o agua aromatizada).";
    }

    const masterPrompt = `
Eres un Sommelier Internacional, Nutricionista y Executive Chef Profesional.

PARÁMETROS DEL USUARIO:
- Ubicación: ${ubicacion || 'Global'}
- Comensales: ${comensales || 2}
- Estilo: ${estiloComida ? estiloComida.toUpperCase() : 'FAMILIAR'}
- RESTRICCIONES DE SALUD: ${saludInstructions}
- PREFERENCIA DE BEBIDAS: ${bebidalInstruction}
- Alimentos descritos/ocultos/antojos: "${preferenciaTexto || 'Ninguno especifico'}"

TAREA:
1. Revisa las fotografías adjuntas y el texto/voz del usuario.
2. Crea una receta adaptada estrictamente a las RESTRICCIONES DE SALUD solicitadas.
3. INCLUYE UN MÓDULO DESTACADO DE MARIDAJE DE BEBIDAS que armonice perfectamente con el perfil organoléptico del plato.
4. Sugiere 3 a 4 comercios locales económicos en ${ubicacion} para comprar insumos y bebidas.

INSTRUCCIONES DE RESPUESTA EN MARKDOWN:

🩺 ADAPTACIÓN DE SALUD Y NUTRICIÓN:
- Breve resumen de cómo esta receta y sus bebidas cumplen con: ${saludList.join(', ') || 'Alimentación General'}.

🍳 INGREDIENTES DETECTADOS / DISPONIBLES:
- Lista de ingredientes identificados en fotos/dictado.

🛒 LISTA DE COMPRAS SUGERIDA (Para ${comensales} personas):
- Ingredientes y bebidas requeridas faltantes con nomenclatura de ${ubicacion}.

🍷 SUGERENCIA DE MARIDAJE DE BEBIDAS (Sugerido para este plato):
- 🍷 **Opción Con Alcohol:** [Nombre del Vino / Cepa / Cerveza o Cóctel] - *Explicación del porqué marida bien con las grasas, acidez o sabores del plato*.
- 🍹 **Opción Sin Alcohol:** [Nombre del Mocktail / Infusión / Agua Saborizada] - *Explicación de la combinación de notas frescas o herbales*.

📍 COMERCIOS Y VINOTECAS RECOMENDADAS EN ${ubicacion.toUpperCase()}:
1. 🏬 **[Mercado/Tienda Local 1]** - *Opción Económica para Ingredientes*.
2. 🍷 **[Vinoteca / Tienda de Bebidas Local 2]** - *Ideal para conseguir las opciones de maridaje recomendadas*.
3. 🛒 **[Supermercado 3]** - *Productos generales e insumos de bebidas*.

👨‍🍳 RECETA: [Nombre de la Receta]
- Dificultad, tiempo y perfil nutricional.
- Ingredientes y cantidades exactas.

🥣 PASO A PASO SEGURO:
1. Paso 1.
2. Paso 2.
3. Paso 3.

💡 CONSEJO DEL SOMMELIER & CHEF:
- Recomendación sobre la temperatura de servicio de la bebida y un tip gastronómico.
`;

    contents.push(masterPrompt);

    const result = await generateContentWithFallback(contents);

    uploadedPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

    return res.json({
      success: true,
      modelUsed: result.modelUsed,
      recetaSugerida: result.text
    });

  } catch (error) {
    uploadedPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    console.error('❌ Error en /analizar-imagen:', error);
    return res.status(500).json({ error: 'Error interno en el servidor.', details: error.message });
  }
});

export default router;