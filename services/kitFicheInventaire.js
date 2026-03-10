/**
 * Génère le HTML de la fiche inventaire imprimable pour un kit
 * S'inspire de generateKitPDF côté client
 */
const bwipjs = require('bwip-js');
const kit = require('./kit');
const allAgents = require('./allAgents');

const GRADE_BASE_URL = process.env.GRADE_IMAGES_URL || 'https://github.com/lr-can/CMS_Collonges/blob/main/src/assets/grades/';

function buildGradeImageUrl(grade) {
  if (!grade) return '';
  return `${GRADE_BASE_URL}${encodeURIComponent(grade)}.png?raw=true`;
}

async function generateBarcodeBase64(text) {
  if (!text || String(text).trim() === '') return '';
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(text).trim(),
      scale: 2,
      height: 10,
      includetext: false
    });
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    console.warn('Erreur génération code-barres:', err.message);
    return '';
  }
}

function generateKitFicheHTML({ agent, nomKit, itemsKit, idKit, dateEdition, observations, datePeremption, barcodeDataUri }) {
  const today = dateEdition || new Date().toLocaleDateString('fr-FR');
  const baseHost = process.env.QR_BASE_URL || 'https://api.cms-collonges.fr';
  const qrUrl = `${baseHost}/kitDetail.html?idKit=${encodeURIComponent(idKit)}&modify=false`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qrUrl)}`;

  const agentName = agent
    ? `${(agent.nomAgent || agent.nom || '').trim()} ${(agent.prenomAgent || agent.prenom || '').trim()}`.trim() || (agent.grade || '')
    : '';
  const gradeUrl = buildGradeImageUrl(agent?.grade || agent?.gradeAgent);

  const items = itemsKit || [];
  const itemRows =
    items.length > 0
      ? items
          .map(
            (item) => `
      <tr>
        <td class="td-produit">${escapeHtml(item.produit || '')}</td>
        <td class="td-center">${escapeHtml(item.cms || '')}</td>
        <td class="td-center">${item.qte ?? ''}</td>
        <td class="td-center">${item.date || ''}</td>
        <td class="td-center">${item.numero || ''}</td>
      </tr>`
          )
          .join('')
      : `<tr><td colspan="5" class="td-produit td-empty">Aucun matériel associé pour le moment.</td></tr>`;

  const observContent = observations ? escapeHtml(observations) : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(nomKit || 'Kit')}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 11pt !important;
      color: #000 !important;
      background: #fff !important;
      padding: 20px !important;
    }
    .page { max-width: 750px !important; margin: 0 auto !important; }
    .header {
      display: flex !important;
      align-items: flex-start !important;
      margin-bottom: 12px !important;
    }
    .header-qr { flex-shrink: 0 !important; margin-right: 16px !important; }
    .header-qr img { width: 90px !important; height: 90px !important; display: block !important; }
    .header-right { flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 8px !important; }
    .header-barcode { text-align: center !important; }
    .header-barcode img { height: 50px !important; min-width: 140px !important; display: block !important; margin: 0 auto !important; }
    .header-barcode .barcode-text { font-size: 14pt !important; font-weight: 600 !important; color: #000 !important; margin-top: 4px !important; }
    .header-title-block { }
    .kit-title-banner {
      background-color: #008080 !important;
      color: #fff !important;
      text-align: center !important;
      font-size: 16pt !important;
      font-weight: bold !important;
      padding: 10px 20px !important;
      letter-spacing: 1px !important;
      border-radius: 2px !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .peremption-block { margin-top: 8px !important; text-align: right !important; }
    .peremption-label { color: #cc0000 !important; font-size: 13pt !important; font-weight: bold !important; }
    .peremption-value {
      color: #cc0000 !important;
      font-size: 13pt !important;
      font-weight: bold !important;
      min-width: 120px !important;
      display: inline-block !important;
      border-bottom: 1.5px solid #cc0000 !important;
    }
    .items-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 10px !important;
    }
    .items-table thead tr {
      background-color: #008080 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .items-table thead th {
      padding: 7px 10px !important;
      text-align: center !important;
      font-size: 10pt !important;
      font-weight: bold !important;
      border: 1px solid #006666 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .items-table thead th:first-child { text-align: left !important; }
    .items-table tbody tr:nth-child(even) { background-color: #f5f5f5 !important; }
    .items-table tbody tr:nth-child(odd) { background-color: #fff !important; }
    .items-table tbody td {
      padding: 5px 10px !important;
      border: 1px solid #ccc !important;
      font-size: 10pt !important;
    }
    .td-produit { text-align: left !important; }
    .td-center { text-align: center !important; }
    .td-empty { color: #888 !important; font-style: italic !important; padding: 16px !important; }
    .signature-block {
      display: flex !important;
      gap: 0 !important;
      margin-top: 16px !important;
      border: 1px solid #ccc !important;
    }
    .signature-half { flex: 1 !important; padding: 10px 12px !important; min-height: 70px !important; }
    .signature-half:first-child { border-right: 1px solid #ccc !important; }
    .signature-half strong { display: block !important; font-size: 9.5pt !important; margin-bottom: 4px !important; }
    .signature-half .sig-value { font-size: 9.5pt !important; color: #333 !important; }
    .observations-block {
      border: 1px solid #ccc !important;
      border-top: none !important;
      padding: 10px 12px !important;
      min-height: 60px !important;
    }
    .observations-block strong { font-size: 9.5pt !important; display: block !important; margin-bottom: 4px !important; }
    .footer {
      margin-top: 20px !important;
      text-align: center !important;
      font-size: 8pt !important;
      color: #555 !important;
      border-top: 1px solid #ccc !important;
      padding-top: 6px !important;
    }
    .footer-meta {
      display: flex !important;
      justify-content: space-between !important;
      font-size: 8pt !important;
      color: #555 !important;
      margin-top: 4px !important;
    }
    @media print {
      body { padding: 10px !important; }
      .no-print { display: none !important; }
      .kit-title-banner, .items-table thead tr, .items-table thead th {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-qr">
        <img src="${qrApiUrl}" alt="QR Code Kit ${escapeHtml(idKit)}" />
      </div>
      <div class="header-right">
        <div class="header-barcode">
          ${barcodeDataUri ? `<img src="${barcodeDataUri}" alt="Code-barres ${escapeHtml(idKit)}" /><span class="barcode-text">${escapeHtml(idKit || '')}</span>` : ''}
        </div>
        <div class="header-title-block">
        <div class="kit-title-banner">${escapeHtml(nomKit || '')}</div>
        <div class="peremption-block">
          <span class="peremption-label">Date de péremption :&nbsp;</span>
          <span class="peremption-value">${(datePeremption != null && datePeremption !== '') ? escapeHtml(String(datePeremption)) : '&nbsp;'}</span>
        </div>
        </div>
      </div>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:40%">Produit</th>
          <th style="width:15%">N° CMS</th>
          <th style="width:12%">Quantité</th>
          <th style="width:18%">Date</th>
          <th style="width:15%">Numéro</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="signature-block">
      <div class="signature-half">
        <strong>Préparé par :</strong>
        <span class="sig-value">
          ${escapeHtml(agentName || '-')}
          ${gradeUrl ? ` <img src="${gradeUrl}" alt="grade" style="height:20px;width:20px;border-radius:50%;vertical-align:middle;margin-left:4px;" />` : ''}
        </span>
        <br/>
        <strong style="margin-top:8px">Le :</strong>
        <span class="sig-value">${today}</span>
      </div>
      <div class="signature-half">
        <strong>Contrôlé par :</strong>
      </div>
    </div>
    <div class="observations-block">
      <strong>Observations :</strong>
      <span class="sig-value">${observContent}</span>
    </div>
    <div class="footer">
      <div>Bureau Pharmacie - CT COLLONGES - SDMIS</div>
      <div>37 Rue Pierre Pays 69660 COLLONGES-AU-MONT-D'OR</div>
      <div class="footer-meta">
        <span>CMS Collonges - Bureau informatique CT Collonges</span>
        <span>Date d'édition : ${today}</span>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      var imgs = document.querySelectorAll('.header img');
      function allLoaded() {
        for (var i = 0; i < imgs.length; i++) if (!imgs[i].complete) return false;
        return true;
      }
      function triggerPrint() { setTimeout(function () { window.print(); }, 300); }
      if (allLoaded()) { triggerPrint(); }
      else {
        imgs.forEach(function(img) {
          img.addEventListener('load', function() { if (allLoaded()) triggerPrint(); });
          img.addEventListener('error', function() { if (allLoaded()) triggerPrint(); });
        });
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getFicheInventaireHTML(idKit, agent = {}) {
  const data = await kit.getDonneesFicheInventaire(idKit);
  if (!data) return null;

  let resolvedAgent = agent;
  const createurId = data.createurId;
  if ((!agent || !agent.matricule) && createurId) {
    try {
      const creator = await allAgents.getAgentByMatricule(createurId);
      if (creator) resolvedAgent = creator;
    } catch (_) {}
  }

  const datePeremption =
    data.datePeremption != null && data.datePeremption !== ''
      ? data.datePeremption
      : null;

  const today = new Date();
  const dateEdition = String(today.getDate()).padStart(2, '0') + '/' +
    String(today.getMonth() + 1).padStart(2, '0') + '/' +
    today.getFullYear();

  const barcodeDataUri = await generateBarcodeBase64(data.idKit || idKit);

  return generateKitFicheHTML({
    agent: resolvedAgent,
    nomKit: data.nomKit || '',
    itemsKit: data.itemsKit || [],
    idKit: data.idKit || idKit,
    dateEdition,
    observations: data.observations || '',
    datePeremption,
    barcodeDataUri
  });
}

module.exports = {
  generateKitFicheHTML,
  getFicheInventaireHTML
};
