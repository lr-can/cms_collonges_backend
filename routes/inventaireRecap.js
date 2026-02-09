const express = require('express');
const router = express.Router();

let fetch;

const INVENTAIRE_SHEET_ID = '1AkAJTVzypZMMuoQUZ25vWjohQpi_0kJyCAql0cdQNr0';
const HISTORIQUE_SHEET = 'Historique';
const AGENTS_SHEET_ID = '1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI';
const AGENTS_SHEET = 'agentsASUP';
const GRADE_BASE_URL =
  'https://github.com/lr-can/CMS_Collonges/blob/main/src/assets/grades/';

async function ensureFetch() {
  if (!fetch) {
    fetch = (await import('node-fetch')).default;
  }
}

async function fetchSheet(spreadsheetId, sheetName) {
  await ensureFetch();
  const url = `https://opensheet.elk.sh/${spreadsheetId}/${encodeURIComponent(
    sheetName
  )}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Erreur lors de la récupération de ${sheetName}: ${response.status}`
    );
  }
  return response.json();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatComment(value = '') {
  if (!value) return '';
  const escaped = escapeHtml(value);
  return escaped.replace(/\s*\|\s*/g, '<br />').replace(/\n/g, '<br />');
}

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function toIsoDate(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  let year = match[3];
  if (year.length === 2) {
    year = `20${year}`;
  }
  return `${year}-${month}-${day}`;
}

function formatDateFr(isoDate) {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function parseTimeToMinutes(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function computeDuration(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return '-';
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function getGroupKey(code = '') {
  const trimmed = String(code).trim();
  if (!trimmed) return 'AUTRES';
  if (/^\d+$/.test(trimmed)) return 'ASUP';
  const match = trimmed.match(/^[a-zA-Z]+/);
  return match ? match[0].toUpperCase() : 'AUTRES';
}

function buildIssuesMap(inventaireObj) {
  const issues = [];
  if (inventaireObj && typeof inventaireObj === 'object') {
    Object.values(inventaireObj).forEach((item) => {
      if (item && typeof item === 'object') {
        issues.push(item);
      }
    });
  }

  const map = new Map();
  issues.forEach((issue) => {
    const key = normalizeName(issue.nomMateriel);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(issue);
  });

  return { issues, map };
}

function findIssuesForItem(itemName, issuesMap) {
  const normalized = normalizeName(itemName);
  if (!normalized) return null;
  if (issuesMap.has(normalized)) {
    return issuesMap.get(normalized);
  }
  for (const [key, issues] of issuesMap.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return issues;
    }
  }
  return null;
}

function buildGradeUrl(grade = '') {
  if (!grade) return '';
  return `${GRADE_BASE_URL}${encodeURIComponent(grade)}.png?raw=true`;
}

function renderPersonCard(person) {
  if (!person) return '';
  const gradeUrl = buildGradeUrl(person.grade);
  const name = `${person.nomAgent || 'Inconnu'} ${person.prenomAgent || ''}`.trim();
  const matricule = person.matricule || '-';
  const grade = person.grade || 'Grade inconnu';
  const role = person.role || '';

  return `
    <div class="person-card">
      ${
        gradeUrl
          ? `<img class="grade-icon" src="${gradeUrl}" alt="${escapeHtml(
              grade
            )}" />`
          : `<div class="grade-fallback">?</div>`
      }
      <div class="person-details">
        <div class="person-name">
          ${escapeHtml(name)}
          <span class="chip chip-neutral">${escapeHtml(matricule)}</span>
        </div>
        <div class="person-role">${escapeHtml(role)}</div>
        <div class="person-grade">${escapeHtml(grade)}</div>
      </div>
    </div>
  `;
}

function renderStateItem(label, value, ok, comment) {
  const statusClass = ok === true ? 'ok' : ok === false ? 'warning' : 'neutral';
  const statusLabel = ok === true ? 'OK' : ok === false ? 'KO' : 'N/A';
  const commentHtml = comment
    ? `<div class="state-comment">${formatComment(comment)}</div>`
    : '';
  return `
    <div class="state-card">
      <div class="state-label">${escapeHtml(label)}</div>
      <div class="state-value">${escapeHtml(value || '-')}</div>
      <span class="chip chip-${statusClass}">${statusLabel}</span>
      ${commentHtml}
    </div>
  `;
}

function renderInventoryRows(items, issuesMap, matchedIssueKeys) {
  if (!items.length) {
    return '<div class="empty">Aucun inventaire trouvé pour cet engin.</div>';
  }

  const rows = items
    .map((item) => {
      const itemName = item.nomMateriel || item.Nom || '';
      const quantity = item.qteMateriel || item.Qte || '-';
      const baseComment = item.commentaire || '';
      const issues = findIssuesForItem(itemName, issuesMap);

      if (issues && issues.length > 0) {
        issues.forEach((issue) => {
          if (issue && issue.nomMateriel) {
            matchedIssueKeys.add(normalizeName(issue.nomMateriel));
          }
        });
      }

      const status = issues && issues.length > 0 ? 'Problème' : 'OK';
      const statusClass = issues && issues.length > 0 ? 'warning' : 'ok';
      const issueComment = issues
        ? issues
            .map((issue) => {
              const zone = issue.zone ? `${issue.zone} — ` : '';
              const comment = issue.commentaire || 'Anomalie signalée';
              return `${zone}${comment}`;
            })
            .join(' | ')
        : '';

      const baseCommentHtml = baseComment
        ? `<div class="inventory-comment inventory-comment-ok">${formatComment(
            baseComment
          )}</div>`
        : '';
      const issueCommentHtml = issueComment
        ? `<div class="inventory-comment inventory-comment-warning">
            <span class="material-icons">warning</span>
            <span>${formatComment(issueComment)}</span>
          </div>`
        : '';

      return `
        <div class="inventory-row">
          <div class="inventory-cell inventory-name">${escapeHtml(itemName)}</div>
          <div class="inventory-cell">${escapeHtml(quantity)}</div>
          <div class="inventory-cell">
            <span class="chip chip-${statusClass}">${status}</span>
          </div>
          <div class="inventory-cell">
            ${issueCommentHtml || baseCommentHtml || ''}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="inventory-grid">
      <div class="inventory-row inventory-header">
        <div class="inventory-cell">Matériel</div>
        <div class="inventory-cell">Qté</div>
        <div class="inventory-cell">Statut</div>
        <div class="inventory-cell">Commentaire</div>
      </div>
      ${rows}
    </div>
  `;
}

function renderInventoryGroups(items, issuesMap, matchedIssueKeys) {
  if (!items || items.length === 0) {
    return '<div class="empty">Aucun inventaire trouvé pour cet engin.</div>';
  }
  const groups = [];
  const index = new Map();
  items.forEach((item) => {
    const key = getGroupKey(item.codeMateriel);
    if (!index.has(key)) {
      index.set(key, []);
      groups.push({ key, items: index.get(key) });
    }
    index.get(key).push(item);
  });

  return groups
    .map(
      (group) => `
        <div class="inventory-group">
          <div class="inventory-group-title">${escapeHtml(group.key)}</div>
          ${renderInventoryRows(group.items, issuesMap, matchedIssueKeys)}
        </div>
      `
    )
    .join('');
}

function renderUnmatchedIssues(issues, matchedIssueKeys) {
  const remaining = issues.filter(
    (issue) => !matchedIssueKeys.has(normalizeName(issue.nomMateriel))
  );
  if (!remaining.length) return '';

  const rows = remaining
    .map((issue) => {
      const label = issue.nomMateriel || 'Matériel inconnu';
      const zone = issue.zone ? `(${issue.zone})` : '';
      const comment = issue.commentaire || 'Anomalie signalée';
      return `
        <div class="unmatched-row">
          <div class="unmatched-name">${escapeHtml(label)} ${escapeHtml(zone)}</div>
          <div class="unmatched-comment">${formatComment(comment)}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="card">
      <div class="section-title">
        <span class="material-icons">error_outline</span>
        Anomalies détectées hors inventaire
      </div>
      ${rows}
    </div>
  `;
}

function renderRecord(record, agentsMap, inventoryList) {
  const vehicule = record.Vehicule || record.vehicule || 'Engin';
  const recordDateIso = toIsoDate(record.Date || record.date || '');
  const recordDateLabel = formatDateFr(recordDateIso);
  const heureDebut = record.HeureDebut || record.heureDebut || '-';
  const heureFin = record.HeureFin || record.heureFin || '-';
  const duree = computeDuration(heureDebut, heureFin);

  const inventaireObj = parseJson(record.Inventaire);
  const etatVehicule = parseJson(record.EtatVehicule);
  const commentaire = record.Commentaire || record.commentaire || '';

  const { issues, map: issuesMap } = buildIssuesMap(inventaireObj);
  const matchedIssueKeys = new Set();

  const chef = record.ChefDeGarde || record.chefDeGarde;
  const inventaireurs = [
    record.Inventaireur1 || record.inventaireur1,
    record.Inventaireur2 || record.inventaireur2,
    record.Inventaireur3 || record.inventaireur3,
  ].filter(Boolean);

  const people = [
    chef
      ? {
          ...(agentsMap[chef] || {}),
          matricule: chef,
          role: 'Chef de garde',
        }
      : null,
    ...inventaireurs.map((matricule, index) => ({
      ...(agentsMap[matricule] || {}),
      matricule,
      role: `Inventaireur ${index + 1}`,
    })),
  ].filter(Boolean);

  const carburant = etatVehicule ? Number(etatVehicule.niveauCarburant) : null;
  const carburantMax = 8;
  const carburantPercent =
    carburant != null && !Number.isNaN(carburant)
      ? Math.min((carburant / carburantMax) * 100, 100)
      : 0;

  const etatCards = etatVehicule
    ? `
      <div class="state-grid">
        ${renderStateItem(
          'Carrosserie',
          etatVehicule.carrosserie && etatVehicule.carrosserie.ok ? 'OK' : 'KO',
          etatVehicule.carrosserie ? etatVehicule.carrosserie.ok : null,
          etatVehicule.carrosserie ? etatVehicule.carrosserie.commentaire : ''
        )}
        ${renderStateItem(
          'Intérieur',
          etatVehicule.interieur && etatVehicule.interieur.ok ? 'OK' : 'KO',
          etatVehicule.interieur ? etatVehicule.interieur.ok : null,
          etatVehicule.interieur ? etatVehicule.interieur.commentaire : ''
        )}
        ${renderStateItem(
          'Carrosserie nettoyée',
          etatVehicule.carrosserieNettoyee ? 'Oui' : 'Non',
          typeof etatVehicule.carrosserieNettoyee === 'boolean'
            ? etatVehicule.carrosserieNettoyee
            : null
        )}
        ${renderStateItem(
          'Démarrage thermique',
          etatVehicule.demarrageThermique ? 'Oui' : 'Non',
          typeof etatVehicule.demarrageThermique === 'boolean'
            ? etatVehicule.demarrageThermique
            : null
        )}
        ${renderStateItem(
          'Éclairage extérieur',
          etatVehicule.eclairageExterieur ? 'OK' : 'KO',
          typeof etatVehicule.eclairageExterieur === 'boolean'
            ? etatVehicule.eclairageExterieur
            : null,
          etatVehicule.eclairageExterieurCommentaire || ''
        )}
        ${renderStateItem(
          'Éclairage intérieur',
          etatVehicule.eclairageInterieur ? 'OK' : 'KO',
          typeof etatVehicule.eclairageInterieur === 'boolean'
            ? etatVehicule.eclairageInterieur
            : null,
          etatVehicule.eclairageInterieurCommentaire || ''
        )}
        ${renderStateItem(
          'Kilométrage',
          etatVehicule.kilometrage != null ? `${etatVehicule.kilometrage} km` : '-',
          null
        )}
      </div>
      <div class="fuel-card">
        <div class="fuel-header">
          <span class="material-icons">local_gas_station</span>
          Niveau de carburant
        </div>
        <div class="fuel-gauge">
          <div class="fuel-fill" style="width: ${carburantPercent}%"></div>
        </div>
        <div class="fuel-value">
          ${carburant != null && !Number.isNaN(carburant)
            ? `${carburant}/${carburantMax}`
            : 'Non renseigné'}
        </div>
      </div>
    `
    : '<div class="empty">État véhicule non renseigné.</div>';

  return `
    <section class="record">
      <div class="record-hero">
        <div>
          <div class="record-title">Inventaire ${escapeHtml(vehicule)}</div>
          <div class="record-subtitle">${escapeHtml(recordDateLabel)}</div>
        </div>
        <span class="chip chip-neutral">${escapeHtml(
          record.Status || record.status || 'Inventaire'
        )}</span>
      </div>

      <div class="card">
        <div class="section-title">
          <span class="material-icons">event</span>
          Informations générales
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Date</span>
            <span class="info-value">${escapeHtml(recordDateLabel)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Heure début</span>
            <span class="info-value">${escapeHtml(heureDebut)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Heure fin</span>
            <span class="info-value">${escapeHtml(heureFin)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Durée</span>
            <span class="info-value">${escapeHtml(duree)}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <span class="material-icons">group</span>
          Équipe d'inventaire
        </div>
        <div class="people-grid">
          ${people.map(renderPersonCard).join('')}
        </div>
      </div>

      ${
        commentaire
          ? `
        <div class="card">
          <div class="section-title">
            <span class="material-icons">chat_bubble_outline</span>
            Commentaire
          </div>
          <div class="comment-box">${formatComment(commentaire)}</div>
        </div>
      `
          : ''
      }

      <div class="card">
        <div class="section-title">
          <span class="material-icons">fact_check</span>
          État du véhicule
        </div>
        ${etatCards}
      </div>

      <div class="card">
        <div class="section-title">
          <span class="material-icons">inventory_2</span>
          Inventaire complet
        </div>
        ${renderInventoryGroups(inventoryList, issuesMap, matchedIssueKeys)}
      </div>

      ${renderUnmatchedIssues(issues, matchedIssueKeys)}
    </section>
  `;
}

function renderPage({ date, recordsHtml, hasData }) {
  const title = hasData
    ? `Inventaire du ${formatDateFr(date)}`
    : `Aucun inventaire pour le ${formatDateFr(date)}`;
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
        <style>
          :root {
            --primary: #1976d2;
            --primary-dark: #0d47a1;
            --accent: #00bfa5;
            --bg: #f4f6fb;
            --text: #1f2937;
            --muted: #64748b;
            --border: #e2e8f0;
            --shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: 'Roboto', 'Segoe UI', sans-serif;
            background: var(--bg);
            color: var(--text);
          }

          .page {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 20px 56px;
          }

          .hero {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 28px 32px;
            border-radius: 24px;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            box-shadow: var(--shadow);
            margin-bottom: 28px;
          }

          .hero h1 {
            font-size: 28px;
            margin: 0 0 6px;
            font-weight: 600;
          }

          .hero p {
            margin: 0;
            color: rgba(255, 255, 255, 0.8);
          }

          .record {
            margin-bottom: 32px;
          }

          .record-hero {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .record-title {
            font-size: 22px;
            font-weight: 600;
          }

          .record-subtitle {
            color: var(--muted);
            font-size: 14px;
            margin-top: 4px;
          }

          .card {
            background: white;
            border-radius: 18px;
            padding: 20px 22px;
            box-shadow: var(--shadow);
            margin-bottom: 18px;
            border: 1px solid var(--border);
          }

          .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            margin-bottom: 16px;
            font-size: 16px;
          }

          .section-title .material-icons {
            font-size: 20px;
            color: var(--primary);
          }

          .chip {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.2;
          }

          .chip-ok {
            background: #e7f5ec;
            color: #1b5e20;
          }

          .chip-warning {
            background: #ffebee;
            color: #c62828;
          }

          .chip-neutral {
            background: #e2e8f0;
            color: #334155;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
          }

          .info-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px;
            border-radius: 12px;
            background: #f8fafc;
          }

          .info-label {
            font-size: 12px;
            color: var(--muted);
          }

          .info-value {
            font-size: 15px;
            font-weight: 500;
          }

          .people-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
          }

          .person-card {
            display: flex;
            gap: 12px;
            align-items: center;
            padding: 14px;
            background: #f8fafc;
            border-radius: 14px;
            border: 1px solid var(--border);
          }

          .grade-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            object-fit: cover;
            border: 1px solid var(--border);
            background: white;
          }

          .grade-fallback {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748b;
            font-weight: 600;
          }

          .person-name {
            font-weight: 600;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }

          .person-role {
            font-size: 12px;
            color: var(--muted);
            margin-top: 4px;
          }

          .person-grade {
            font-size: 12px;
            color: var(--primary);
            margin-top: 2px;
          }

          .comment-box {
            background: #f8fafc;
            padding: 12px;
            border-radius: 12px;
            color: var(--text);
          }

          .state-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px;
          }

          .state-card {
            background: #f8fafc;
            border-radius: 12px;
            padding: 12px;
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .state-label {
            font-size: 12px;
            color: var(--muted);
          }

          .state-value {
            font-size: 14px;
            font-weight: 600;
          }

          .state-comment {
            font-size: 12px;
            color: var(--muted);
          }

          .fuel-card {
            margin-top: 16px;
            background: #f8fafc;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid var(--border);
          }

          .fuel-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            margin-bottom: 10px;
          }

          .fuel-gauge {
            width: 100%;
            height: 12px;
            background: #e2e8f0;
            border-radius: 999px;
            overflow: hidden;
          }

          .fuel-fill {
            height: 100%;
            background: linear-gradient(90deg, #00bfa5, #26a69a);
            border-radius: 999px;
          }

          .fuel-value {
            margin-top: 8px;
            font-size: 13px;
            color: var(--muted);
          }

          .inventory-group {
            margin-bottom: 20px;
          }

          .inventory-group-title {
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--primary);
          }

          .inventory-grid {
            display: grid;
            gap: 8px;
          }

          .inventory-row {
            display: grid;
            grid-template-columns: 2fr 0.5fr 0.7fr 2fr;
            gap: 12px;
            align-items: start;
            padding: 10px 12px;
            border-radius: 12px;
            background: #f8fafc;
            border: 1px solid var(--border);
          }

          .inventory-header {
            background: #e2e8f0;
            font-weight: 600;
            color: #0f172a;
          }

          .inventory-cell {
            font-size: 13px;
          }

          .inventory-name {
            font-weight: 500;
          }

          .inventory-comment {
            display: flex;
            gap: 6px;
            align-items: flex-start;
            font-size: 12px;
            line-height: 1.4;
          }

          .inventory-comment-ok {
            color: var(--muted);
          }

          .inventory-comment-warning {
            color: #b91c1c;
          }

          .inventory-comment-warning .material-icons {
            font-size: 16px;
          }

          .empty {
            color: var(--muted);
            font-style: italic;
          }

          .unmatched-row {
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
          }

          .unmatched-name {
            font-weight: 600;
          }

          .unmatched-comment {
            color: var(--muted);
            margin-top: 4px;
          }

          @media (max-width: 760px) {
            .hero {
              flex-direction: column;
              align-items: flex-start;
            }

            .inventory-row {
              grid-template-columns: 1fr;
            }

            .inventory-header {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="hero">
            <div>
              <h1>Inventaire récapitulatif</h1>
              <p>${escapeHtml(title)}</p>
            </div>
            <span class="chip chip-neutral">${escapeHtml(date)}</span>
          </div>
          ${
            hasData
              ? recordsHtml
              : `<div class="card"><div class="empty">Aucun inventaire trouvé pour cette date.</div></div>`
          }
        </div>
      </body>
    </html>
  `;
}

router.get('/:date', async function (req, res, next) {
  const requestedDate = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    res.status(400).send(
      renderPage({
        date: requestedDate,
        recordsHtml: '',
        hasData: false,
      })
    );
    return;
  }

  try {
    const [historique, agents] = await Promise.all([
      fetchSheet(INVENTAIRE_SHEET_ID, HISTORIQUE_SHEET),
      fetchSheet(AGENTS_SHEET_ID, AGENTS_SHEET),
    ]);

    const agentsMap = {};
    agents.forEach((agent) => {
      if (agent && agent.matricule) {
        agentsMap[agent.matricule] = agent;
      }
    });

    const filtered = historique.filter(
      (row) => toIsoDate(row.Date) === requestedDate
    );

    if (!filtered.length) {
      res.send(
        renderPage({
          date: requestedDate,
          recordsHtml: '',
          hasData: false,
        })
      );
      return;
    }

    const uniqueVehicules = [
      ...new Set(
        filtered.map((row) => row.Vehicule).filter((vehicule) => vehicule)
      ),
    ];

    const inventories = await Promise.all(
      uniqueVehicules.map(async (vehicule) => {
        try {
          const items = await fetchSheet(INVENTAIRE_SHEET_ID, vehicule);
          return [vehicule, items];
        } catch (err) {
          return [vehicule, []];
        }
      })
    );

    const inventoryMap = {};
    inventories.forEach(([vehicule, items]) => {
      inventoryMap[vehicule] = items;
    });

    const recordsHtml = filtered
      .map((row) => {
        const vehicule = row.Vehicule || row.vehicule;
        return renderRecord(row, agentsMap, inventoryMap[vehicule] || []);
      })
      .join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      renderPage({
        date: requestedDate,
        recordsHtml,
        hasData: true,
      })
    );
  } catch (err) {
    console.error('Erreur lors de la génération inventaire recap:', err.message);
    next(err);
  }
});

module.exports = router;
