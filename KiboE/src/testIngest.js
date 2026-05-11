// src/testIngest.js
require("dotenv").config();
const { ingestUrls } = require("./services/ingest");

async function main() {
  const urls = [
    /*"https://www.gob.mx/presidencia/articulos/version-estenografica-conferencia-de-prensa-de-la-presidenta-claudia-sheinbaum-pardo-del-4-de-abril-de-2025",
    "https://www.gob.mx/presidencia/articulos/version-estenografica-conferencia-de-prensa-de-la-presidenta-claudia-sheinbaum-pardo-del-9-de-abril-de-2025",
    "https://www.dof.gob.mx/nota_detalle.php?codigo=5758077&fecha=22/05/2025#gsc.tab=0",
    "https://www.dof.gob.mx/nota_detalle.php?codigo=5758079&fecha=22/05/2025#gsc.tab=0",
    "https://www.gob.mx/presidencia/prensa/plan-mexico-presidenta-claudia-sheinbaum-pone-en-marcha-los-primeros-15-polos-de-desarrollo-economico-para-el-bienestar-en-14-estados",
    "https://www.gob.mx/presidencia/prensa/presidenta-firma-acuerdo-con-22-grupos-empresariales-para-aumentar-los-productos-hechos-en-mexico-en-tiendas?idiom=es",
    "https://www.gob.mx/presidencia/prensa/plan-mexico-presidenta-claudia-sheinbaum-anuncia-decreto-para-convertir-al-pais-en-lider-de-la-industria-farmaceutica",
    "https://www.gob.mx/shcp/prensa/comunicado-no-19-suscriben-acuerdo-el-gobierno-federal-banco-de-mexico-y-la-abm-para-incrementar-el-financiamiento-a-las-pymes?idiom=es-MX",
    "https://www.gob.mx/presidencia/prensa/se-ofertaran-100-mil-empleos-adicionales-como-parte-del-plan-mexico-presidenta-claudia-sheinbaum?idiom=es",
*/
    // "https://mextudia.com/becas-gubernamentales-en-mexico/",
    // "https://miestatusbienestar.com.mx/mujeres-con-bienestar/",
    // "https://www.infobae.com/mexico/2025/03/19/beneficios-y-apoyos-para-mujeres-en-2025-lista-completa-de-cuantos-hay-y-cuanto-dinero-ofrecen/",
    // "https://www.gob.mx/cms/uploads/attachment/file/964733/100_compromisos.pdf",
    // "https://www.proyectosmexico.gob.mx/ppp06-tren-mexico-pachuca/",
    // "https://www.proyectosmexico.gob.mx/ppp07-tren-mexico-queretaro/",
    // "https://www.trenmaya.gob.mx/images/documentos/Programa%20Institucional_Tren%20Maya%202025.pdf",
    // "https://www.gob.mx/ciit",
    // "https://codeso.mx/plan-sonora/",
    // "https://www.gob.mx/conavi/acciones-y-programas/programa-de-vivienda-para-el-bienestar-2025",

    //"https://www.proyectosmexico.gob.mx/proyecto_inversion/polos-de-desarrollo-economico-para-el-bienestar/",
    "https://www.proyectosmexico.gob.mx/proyecto_inversion/1001-podecobi-seybaplaya-i-campeche/",
    "https://www.proyectosmexico.gob.mx/proyecto_inversion/1002-podecobi-san-jeronimo-chihuahua/",
    "https://www.proyectosmexico.gob.mx/proyecto_inversion/1003-podecobi-chetumal-quintana-roo/",
    "https://www.proyectosmexico.gob.mx/proyecto_inversion/1005-podecobi-reserva-zapotlan-hidalgo/",
    "https://www.proyectosmexico.gob.mx/proyecto_inversion/1006-podecobi-parque-industrial-bajio-michoacan/",
    "https://www.proyectosmexico.gob.mx/proyecto_inversion/1015-podecobi-nezahualcoyotl-estado-de-mexico/",
    "https://www.gob.mx/becasbenitojuarez/articulos/calendario-de-pago-primer-bimestre-2025-beca-benito-juarez?idiom=es",
    "https://www.gob.mx/becasbenitojuarez/es/articulos/conoce-todo-sobre-la-beca-jovenes-escribiendo-el-futuro",
    "https://www.gob.mx/se/acciones-y-programas/polos-de-desarrollo-economico-para-el-bienestar",
    

  ];

  console.log("[testIngest] Empezando ingesta de URLs:", urls);

  const results = await ingestUrls(urls);

  console.log("\n[testIngest] Resultados:");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("[testIngest] Error general:", err.message);
});