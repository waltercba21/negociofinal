// controllers/reportesController.js
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');

module.exports = {
  recomendacionesCompra: async (req, res) => {
    try {
      const { categoria_id, desde, hasta } = req.query;

      // 1) Datos de ventas + presupuestos (lo que ya hicimos)
      const masVendidos = await producto.obtenerMasVendidos(conexion, {
        categoria_id: categoria_id || null,
        desde: desde || null,
        hasta: hasta || null,
        limit: 100
      });

      // 2) Datos de "más buscados" (ver modelo más abajo)
      const masBuscados = await producto.obtenerMasBuscados(conexion, {
        categoria_id: categoria_id || null,
        desde: desde || null,
        hasta: hasta || null,
        limit: 100
      });

      // 3) Fusionar en un ranking combinado (score simple)
      // Normalizamos por percentil y sumamos ponderado (ventas 0.7, búsquedas 0.3)
      const mapVentas = new Map(masVendidos.map((r, i) => [r.id, { rank: i+1, total: r.total_vendido }]));
      const mapBusq  = new Map(masBuscados.map((r, i) => [r.id, { rank: i+1, total: r.total_buscado }]));

      const productosIds = new Set([...mapVentas.keys(), ...mapBusq.keys()]);
      const combinar = [];

      for (const id of productosIds) {
        const v = mapVentas.get(id);
        const b = mapBusq.get(id);
        const ventas = v?.total || 0;
        const busq  = b?.total || 0;
        combinar.push({
          id,
          nombre: (masVendidos.find(x => x.id === id)?.nombre) || (masBuscados.find(x => x.id === id)?.nombre) || '',
          precio_venta: (masVendidos.find(x => x.id === id)?.precio_venta) || (masBuscados.find(x => x.id === id)?.precio_venta) || 0,
          ventas,
          buscado: busq,
          score: ventas * 0.7 + busq * 0.3
        });
      }

      combinar.sort((a,b)=> b.score - a.score);

      // 4) Render EJS -> HTML
      const templatePath = path.join(__dirname, '../views/reportes/recomendacionesCompra.ejs');
      const html = await ejs.renderFile(templatePath, {
        filtros: { categoria_id, desde, hasta },
        topVendidos: masVendidos.slice(0, 20),
        topBuscados: masBuscados.slice(0, 20),
        ranking: combinar.slice(0, 50) // top 50 recomendados
      });

      // 5) HTML -> PDF
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '12mm', bottom: '18mm', left: '12mm' }
      });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recomendaciones_compra.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('❌ recomendacionesCompra:', error);
      res.status(500).send('Error al generar recomendaciones');
    }
  }
};
