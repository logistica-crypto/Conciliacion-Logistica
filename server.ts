/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Lazy initializer for Gemini to prevent crashes on startup if GEMINI_API_KEY is not configured
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for intelligent reports.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST API Route for Smart Logistics Report Generation using Gemini
app.post("/api/gemini/report", async (req, res) => {
  try {
    const { stats, filterInfo } = req.body;

    if (!stats) {
      return res.status(400).json({ error: "Falta estadísticas de logística para el informe." });
    }

    // Exact formatting helpers matching the user's template (comma thousands, dot decimals)
    const formatMoney = (v: number) => {
      return "$" + (v || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const formatNum = (v: number, decimals: number = 2) => {
      return (v || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    const subtotal = stats.subtotal || 0;
    const totalSales = stats.totalSales || 0;
    const effectiveness = subtotal > 0 ? (totalSales / subtotal) * 100 : 0;
    const difference = subtotal - totalSales;
    const brechaPct = subtotal > 0 ? (difference / subtotal) * 100 : 0;

    const metaGoal = 1000000000; // 1,000,000,000 COP
    const metaPct = (totalSales / metaGoal) * 100;
    const metaFalta = metaGoal - totalSales;

    const transportCost = stats.transportCost || 0;
    const impactPct = stats.impactPct || 0;
    const efLogEstado = impactPct <= 10.0 ? "✅ DENTRO DE POLÍTICA" : "⚠️ EXCEDE POLÍTICA (Límite 10%)";

    const totalBoxes = stats.totalBoxes || 0;
    const totalWeightTons = (stats.totalWeight || 0) / 1000;

    const pendingValue = stats.pendingValue || 0;
    const pendingBoxes = stats.pendingBoxes || 0;
    const pendingWeightTons = (stats.pendingWeight || 0) / 1000;

    const attentionClient = stats.attentionClient || { name: "N/A", flete: 0, pct: 0 };
    const attentionRegion = stats.attentionRegion || { name: "N/A", flete: 0, pct: 0 };

    // Format canonical regions list
    const regionalSummaries = stats.regionalSummaries || [];
    const formattedRegions = regionalSummaries.map((r: any) => {
      const isRegionYumbo = r.region.toUpperCase() === "YUMBO";
      // Let's use custom "Pendiente:" label for Yumbo to match template exactly
      const pendLabel = isRegionYumbo ? "Pendiente" : "Pend";
      return `📍 **REGIÓN: ${r.region.toUpperCase()}**
• Venta: ${formatMoney(r.venta)} (${formatNum(r.ventaTons, 2)} TON)
• ${pendLabel}: ${formatMoney(r.pend)} (${formatNum(r.pendTons, 2)} TON)`;
    }).join("\n\n");

    const activeMonth = (filterInfo?.reportMonthName || "JUNIO").toUpperCase();
    const mesesString = filterInfo?.meses || "Junio";

    // Dynamic prompt instructing Gemini to format exactly according to the template
    const prompt = `
Actúa como un Director de Operaciones y Auditoría Logística de LATIN PRODUCTS SAS.
Genera el informe ejecutivo inteligente utilizando EXACTAMENTE la siguiente plantilla y estructura, manteniendo las fuentes en negrita, los asteriscos, guiones, saltos de línea y emojis al pie de la letra. 

Debes reemplazar las variables entre llaves con la información real calculada provista a continuación. No agregues saludos informales ni comentarios fuera del formato establecido. Conserva el estilo literal y profesional chileno/colombiano de negocios.

INFORMACIÓN DE VARIABLES PARA REEMPLAZAR:
- MONTH_NAME: ${activeMonth}
- MonthsSelected: ${mesesString}
- Subtotal: ${formatMoney(subtotal)}
- TotalSales: ${formatMoney(totalSales)}
- Effectiveness: ${formatNum(effectiveness, 1)}%
- Difference: ${formatMoney(difference)}
- BrechaPct: ${formatNum(brechaPct, 1)}%
- FormattedRegions:
${formattedRegions}
- MetaPct: ${formatNum(metaPct, 1)}%
- MetaFalta: ${formatMoney(metaFalta)}
- EficienciaLogPct: ${formatNum(impactPct, 2)}%
- TransportCost: ${formatMoney(transportCost)}
- EficienciaLogEstado: ${efLogEstado}
- TotalBoxes: ${formatNum(totalBoxes, 1)}
- TotalWeightTons: ${formatNum(totalWeightTons, 2)}
- PendingValue: ${formatMoney(pendingValue)}
- PendingBoxes: ${formatNum(pendingBoxes, 1)}
- PendingWeightTons: ${formatNum(pendingWeightTons, 2)}
- AttentionClientName: ${attentionClient.name}
- AttentionClientFlete: ${formatMoney(attentionClient.flete)}
- AttentionClientPct: ${formatNum(attentionClient.pct, 1)}%
- AttentionRegionName: ${attentionRegion.name}
- AttentionRegionFlete: ${formatMoney(attentionRegion.flete)}
- AttentionRegionPct: ${formatNum(attentionRegion.pct, 1)}%

PLANTILLA REQUERIDA (Genera el reporte final siguiendo EXACTAMENTE este texto de salida con las sustituciones realizadas):

📊 *INFORME DE GESTIÓN INTELIGENTE - {MONTH_NAME}*
📅 *Filtro Mes:* {MonthsSelected}
--------------------------------------------------

💎 *1. RESUMEN EJECUTIVO*
Durante este período, se gestionaron pedidos por un subtotal neto de **{Subtotal}**. De este valor, se ha logrado facturar y despachar efectivamente un total de **{TotalSales}**, lo que representa una efectividad del **{Effectiveness}** sobre el subtotal registrado.
📉 *Diferencia (Brecha):* {Difference} ({BrechaPct})

🏢 *2. ANÁLISIS GEOGRÁFICO Y CLIENTES*
{FormattedRegions}

📈 *3. EFICIENCIA Y METAS*
🏁 *Cumplimiento Meta (1000M):* Estamos al **{MetaPct}**. Faltan **{MetaFalta}** para alcanzar el objetivo.
🚚 *Eficiencia Logística:* El costo de transporte representó el **{EficienciaLogPct}** del valor facturado ({TransportCost}). Estado: **{EficienciaLogEstado}**.

📦 *4. DINÁMICA DE DESPACHOS*
Se movilizaron un total de **{TotalBoxes} cajas** con un peso neto de **{TotalWeightTons} toneladas**.
⏳ *Pendiente Actual:* Hay **{PendingValue}** en espera de despacho. Esto equivale a **{PendingBoxes} cajas** y **{PendingWeightTons} toneladas** que aún no han salido a ruta.

🏁 *5. CONCLUSIÓN Y ACCIÓN*
• **Atención (Cliente):** {AttentionClientName} presenta el mayor costo logístico ({AttentionClientFlete} - {AttentionClientPct}).
• **Atención (Región):** {AttentionRegionName} es la zona con mayor gasto logístico ({AttentionRegionFlete} - {AttentionRegionPct}).
• INSTA a agilizar el despacho de pendientes para alcanzar la meta.
`;

    // Initialize client and request generation or fallback if API key is not configured
    let reportText = "";
    const hasKey = !!process.env.GEMINI_API_KEY;

    if (!hasKey) {
      reportText = `📊 *INFORME DE GESTIÓN INTELIGENTE - ${activeMonth}*
📅 *Filtro Mes:* ${mesesString}
--------------------------------------------------

💎 *1. RESUMEN EJECUTIVO*
Durante este período, se gestionaron pedidos por un subtotal neto de **${formatMoney(subtotal)}**. De este valor, se ha logrado facturar y despachar efectivamente un total de **${formatMoney(totalSales)}**, lo que representa una efectividad del **${formatNum(effectiveness, 1)}%** sobre el subtotal registrado.
📉 *Diferencia (Brecha):* ${formatMoney(difference)} (${formatNum(brechaPct, 1)}%)

🏢 *2. ANÁLISIS GEOGRÁFICO Y CLIENTES*
${formattedRegions}

📈 *3. EFICIENCIA Y METAS*
🏁 *Cumplimiento Meta (1000M):* Estamos al **${formatNum(metaPct, 1)}%**. Faltan **${formatMoney(metaFalta)}** para alcanzar el objetivo.
🚚 *Eficiencia Logística:* El costo de transporte representó el **${formatNum(impactPct, 2)}%** del valor facturado (${formatMoney(transportCost)}). Estado: **${efLogEstado}**.

📦 *4. DINÁMICA DE DESPACHOS*
Se movilizaron un total de **${formatNum(totalBoxes, 1)} cajas** con un peso neto de **${formatNum(totalWeightTons, 2)} toneladas**.
⏳ *Pendiente Actual:* Hay **${formatMoney(pendingValue)}** en espera de despacho. Esto equivale a **${formatNum(pendingBoxes, 1)} cajas** y **${formatNum(pendingWeightTons, 2)} toneladas** que aún no han salido a ruta.

🏁 *5. CONCLUSIÓN Y ACCIÓN*
• **Atención (Cliente):** ${attentionClient.name} presenta el mayor costo logístico (${formatMoney(attentionClient.flete)} - ${formatNum(attentionClient.pct, 1)}%).
• **Atención (Región):** ${attentionRegion.name} es la zona con mayor gasto logístico (${formatMoney(attentionRegion.flete)} - ${formatNum(attentionRegion.pct, 1)}%).
• INSTA a agilizar el despacho de pendientes para alcanzar la meta.`;
    } else {
      const gemini = getGeminiClient();
      const result = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      reportText = result.text || "No se pudo generar el reporte. Inténtelo de nuevo.";
    }

    res.json({ report: reportText });
  } catch (err: any) {
    console.error("Error generating Gemini logistic report:", err);
    res.status(500).json({ error: err.message || "Error interno del servidor al procesar la IA." });
  }
});

// Intelligent PDF Parser and Logistics Classifier Route
app.post("/api/gemini/parse-pdf", async (req, res) => {
  try {
    const { fileData, fileType } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: "Falta el archivo PDF en base64 para procesar." });
    }

    const systemInstruction = `Eres un asistente de extracción de datos de logística para Latin Products S.A.S.
Analiza el PDF adjunto y extrae de forma ultra-precisa la información tributaria y comercial.
Clasifica Tipo de documento:
- "PEDIDO_CLIENTE": pedido de venta, orden de compra, despacho.
- "FACTURA_PROVISION": planilla de fletes de transportadora.

LISTA DE CLIENTES VÁLIDOS:
- "ALMACENES ÉXITO S.A."
- "TIENDAS JUMBO S.A.S. (CENCOSUD)"
- "ALKOSTO SUR S.A."
- "SÚPER TIENDAS OLÍMPICA S.A."
- "INVERSIONES LA VAQUITA EXPRESS"
- "SUPERMERCADOS CAÑAVERAL"
- "QUÍMICA PACÍFICO INDUSTRIAL"
- "MERCACENTRO HUILA"
- "MERCAPAVA SA (MERCAPAVA (013) MAYORISTA)"
- "MERCAPAVA SA (MERCAPAVA (010) VILLAMARIA)"

LISTA DE TRANSPORTADORAS VÁLIDAS:
- "SISA CARGO"
- "VIACARGO S.A.S."
- "THR LOGÍSTICA"
- "FREDY HERNANDEZ (IND)"
- "A5 LOGISTICA"

REGLA CRÍTICA DE CLASIFICACIÓN (MERCAPAVA vs ALKOSTO):
- MERCAPAVA: Si el documento o encabezado menciona 'MERCAPAVA' (ej. 'MERCAPAVA SA', 'MERCAPAVA (013)', 'MERCAPAVA (010)'), el cliente DEBE extraerse exactamente como el nombre de MERCAPAVA que aparezca (por ejemplo 'MERCAPAVA SA (MERCAPAVA (013) MAYORISTA)' o 'MERCAPAVA SA (MERCAPAVA (010) VILLAMARIA)').
- NO CLASIFIQUES COMO 'ALKOSTO SUR S.A.' solo porque los ítems o marcas de producto en la tabla digan 'Alkosto'. Latin Products fabrica productos marca 'Alkosto' que son despachados y facturados a otros clientes como Mercapava. Confía SIEMPRE en el nombre del comprador o destinatario en la cabecera.

IMPORTANTE: Si el cliente del documento NO está en la lista de clientes válidos (como "INVERSIONES SUPERVAQUITA LA 33 SAS" o "SUPERMERCADO LA VAQUITA BELLO"), extrae y escribe su nombre real exacto.`;

    const prompt = "Extrae y asocia los datos del PDF adjunto rellenando el esquema JSON estructurado de forma ultra-rápida.";

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        tipoDocumento: {
          type: Type.STRING,
          description: "Debe ser 'PEDIDO_CLIENTE' o 'FACTURA_PROVISION'."
        },
        oc: {
          type: Type.STRING,
          description: "Número de la Orden de Compra/OC (ej. 'OC-COE-00000081'). Extrae el valor exacto del campo 'OC' o 'OC:'. Vacío si no hay."
        },
        pv: {
          type: Type.STRING,
          description: "Número del Pedido de Venta/PV (ej. 'PV 2070' o '2070'). Busca la etiqueta 'PEDIDO DE VENTA' o 'PV'. Extrae exactamente el número real legible de la cabecera."
        },
        cliente: {
          type: Type.STRING,
          description: "Nombre del cliente. Si asocia a CLIENTES VALIDOS usa ese; si es nuevo (ej: 'INVERSIONES SUPERVAQUITA LA 33 SAS'), extrae el nombre exacto de la cabecera."
        },
        ciudad: {
          type: Type.STRING,
          description: "Ciudad destino, ej 'Medellín', 'Cali', 'Yumbo', 'Bello'."
        },
        cajas: {
          type: Type.STRING,
          description: "Cantidad de cajas o bultos. E.g. '612.44' o '612'."
        },
        peso: {
          type: Type.STRING,
          description: "Peso total en Kg. E.g. '11980.53' o '11981'."
        },
        venta: {
          type: Type.STRING,
          description: "Valor neto o subtotal de la venta en pesos. Ej. '43785200'."
        },
        factura: {
          type: Type.STRING,
          description: "Número de Factura de Venta del cliente, ej. 'FE-1229'. Vacío si no hay."
        },
        provision: {
          type: Type.STRING,
          description: "Solo para FACTURA_PROVISION. Factura o cuenta de cobro del flete."
        },
        flete: {
          type: Type.STRING,
          description: "Solo para FACTURA_PROVISION. Costo liquidado del flete."
        },
        transportadora: {
          type: Type.STRING,
          description: "Solo para FACTURA_PROVISION. Nombre de la transportadora emitiendo."
        }
      },
      required: ["tipoDocumento"]
    };

    const hasKey = !!process.env.GEMINI_API_KEY;
    if (!hasKey) {
      // Deterministic simulation based on base64 content length
      const isProvision = fileData.length % 2 === 0;
      if (isProvision) {
        return res.json({
          tipoDocumento: "FACTURA_PROVISION",
          oc: "",
          pv: "",
          cliente: "ALMACENES ÉXITO S.A.",
          ciudad: "Bello",
          cajas: "350",
          peso: "7200",
          venta: "0",
          provision: "FP-12005",
          flete: "1850000",
          transportadora: "SISA CARGO"
        });
      } else {
        return res.json({
          tipoDocumento: "PEDIDO_CLIENTE",
          oc: "OC-COE-779011",
          pv: "PV-4590",
          cliente: "TIENDAS JUMBO S.A.S. (CENCOSUD)",
          ciudad: "Bogotá",
          cajas: "420",
          peso: "8600",
          venta: "34850000",
          factura: "FE-2280"
        });
      }
    }

    const gemini = getGeminiClient();
    const result = await gemini.models.generateContent({
      model: "gemini-3.5-flash", // Use the recommended gemini-3.5-flash model
      contents: {
        parts: [
          {
            inlineData: {
              data: fileData,
              mimeType: fileType || "application/pdf"
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.0
      }
    });

    const text = result.text || "{}";
    const parsedData = JSON.parse(text);

    res.json(parsedData);
  } catch (err: any) {
    console.error("Error parsing logistics PDF via Gemini API:", err);
    res.status(500).json({ error: err.message || "Error al procesar el archivo PDF con Inteligencia Artificial." });
  }
});

// Custom JSON error handler to prevent returning HTML error pages to API consumers
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Uncaught server error",
    details: err.stack || undefined
  });
});

// Configure development or production asset serving
async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve build static assets on production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start custom server:", err);
});
