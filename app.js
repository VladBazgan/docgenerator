const express = require("express");
const axios = require("axios");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3010;

/**
 * 🔧 Flatten recursiv pentru obiecte JSON
 * ex: cpu.clocks.avg => 3691
 */
function flattenObject(obj, prefix = "") {
  let rows = [];

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      rows = rows.concat(flattenObject(value, newKey));
    } else {
      rows.push({
        key: newKey,
        value: value
      });
    }
  }

  return rows;
}

app.get("/generate-pdf", async (req, res) => {
  try {
    // 1️⃣ Fetch date din API-ul de stats
    const apiResponse = await axios.get(
      "http://192.168.100.221:3001/api/stats",
      { timeout: 3000 }
    );

    const stats = apiResponse.data;

    // 2️⃣ Flatten date
    const rows = flattenObject(stats);

    // 3️⃣ HTML pentru PDF
    const html = `
      <!DOCTYPE html>
      <html lang="ro">
      <head>
        <meta charset="utf-8">
        <title>System Stats Report</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            padding: 40px;
            color: #111;
          }
          h1 {
            color: #0b5ed7;
            margin-bottom: 5px;
          }
          .meta {
            margin-bottom: 20px;
            color: #555;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background-color: #f2f2f2;
          }
          tr:nth-child(even) td {
            background-color: #fafafa;
          }
        </style>
      </head>
      <body>
        <h1>System Stats Report</h1>
        <div class="meta">
          Generat la: ${new Date().toLocaleString()}
        </div>

        <table>
          <tr>
            <th>Cheie</th>
            <th>Valoare</th>
          </tr>
          ${rows.map(r => `
            <tr>
              <td>${r.key}</td>
              <td>${r.value}</td>
            </tr>
          `).join("")}
        </table>
      </body>
      </html>
    `;

    // 4️⃣ Generare PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--disable-gpu"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm"
      }
    });

    await browser.close();

    // 5️⃣ Răspuns
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=system-stats.pdf"
    );

    res.send(pdfBuffer);

  } catch (err) {
    console.error("EROARE PDF:");
    console.error(err.stack || err);

    if (err.code === "ECONNREFUSED") {
      return res
        .status(503)
        .send("API-ul stats (3001) nu este pornit");
    }

    res.status(500).send("Eroare la generarea PDF-ului");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`📄 DocGenerator PDF rulează pe http://0.0.0.0:${PORT}`);
});
