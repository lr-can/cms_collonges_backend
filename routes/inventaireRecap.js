const express = require('express');
const router = express.Router();

let fetch;

const INVENTAIRE_SHEET_ID = '1AkAJTVzypZMMuoQUZ25vWjohQpi_0kJyCAql0cdQNr0';
const HISTORIQUE_SHEET = 'Historique';
const AGENTS_SHEET_ID = '1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI';
const AGENTS_SHEET = 'agentsASUP';
const AVAILABILITY_SHEET_ID = '1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE';
const AVAILABILITY_SHEET = 'Feuille 12';
const LOGO_URL =
  'https://github.com/lr-can/CMS_Collonges/blob/main/src/assets/logoTitle.png?raw=true';
const ICONS_BASE_URL =
  'https://raw.githubusercontent.com/lr-can/affichageCT2/ae51ac88d6e6a82647a3d3e069db5a96d6e893db/src/assets/vehiculeViewIcons/';
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

function normalizeHexColor(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function getReadableTextColor(hexColor) {
  if (!hexColor) return '#111';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#111';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#111' : '#fff';
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

function toTimestamp(isoDate, timeValue, fallbackIndex = 0) {
  if (!isoDate) return null;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  const minutes = parseTimeToMinutes(timeValue) ?? 0;
  const base = Date.UTC(year, month - 1, day, 0, 0, 0);
  return base + minutes * 60000 + fallbackIndex;
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

function toFlag(value) {
  return parseInt(String(value || '0'), 10) === 1;
}

function buildEmplois(agent) {
  if (!agent) return [];
  const emplois = [];

  if (toFlag(agent.CDG_cdg)) {
    emplois.push({ icon: `${ICONS_BASE_URL}CDG.png`, name: 'CDG', chip: 'CDG' });
  }

  if (toFlag(agent.INFAMU_inf)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}INFAMU.svg`,
      name: 'INFAMU',
      chip: 'PISU',
    });
  }

  if (toFlag(agent.SAP_ca)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}SUAP.svg`,
      name: 'SUAP',
      chip: 'CA',
    });
  } else if (toFlag(agent.SAP_eq)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}SUAP.svg`,
      name: 'SUAP',
      chip: 'EQ',
    });
  }

  if (toFlag(agent.DIV_ca)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}PPBE.svg`,
      name: 'PPBE',
      chip: 'CA',
    });
  } else if (toFlag(agent.DIV_eq)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}PPBE.svg`,
      name: 'PPBE',
      chip: 'EQ',
    });
  }

  if (toFlag(agent.INC_ca)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}INC.svg`,
      name: 'INC',
      chip: 'CA',
    });
  } else if (toFlag(agent.INC_ce)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}INC.svg`,
      name: 'INC',
      chip: 'CE',
    });
  } else if (toFlag(agent.INC_eq)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}INC.svg`,
      name: 'INC',
      chip: 'EQ',
    });
  }

  if (toFlag(agent.BATO_ca)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}BATO.svg`,
      name: 'BATO',
      chip: 'CA',
    });
  } else if (toFlag(agent.BATO_eq)) {
    emplois.push({
      icon: `${ICONS_BASE_URL}BATO.svg`,
      name: 'BATO',
      chip: 'EQ',
    });
  }

  if (toFlag(agent.AQUA_ca)) {
    emplois.push({ icon: `${ICONS_BASE_URL}SAV.svg`, name: 'SAV', chip: null });
  }

  return emplois;
}

function buildPermis(agent) {
  if (!agent) return [];
  const permis = [];
  if (toFlag(agent.INFAMU_cd)) {
    permis.push({ icon: `${ICONS_BASE_URL}B.svg`, name: 'B' });
  }
  if (toFlag(agent.SAP_cd)) {
    permis.push({ icon: `${ICONS_BASE_URL}BTARS.svg`, name: 'BTARS' });
  }
  if (toFlag(agent.INC_cd)) {
    permis.push({ icon: `${ICONS_BASE_URL}CCOD1.png`, name: 'CCOD1' });
  }
  if (toFlag(agent.BATO_ca)) {
    permis.push({ icon: `${ICONS_BASE_URL}CCOD4.png`, name: 'CCOD4' });
  }
  return permis;
}

function buildAgentProfile(matricule, agent, availability) {
  const base = agent || {};
  const availabilityData = availability || {};
  const nomAgent = base.nomAgent || availabilityData.nom || base.nom || '';
  const prenomAgent =
    base.prenomAgent || availabilityData.prenom || base.prenom || '';
  const grade = base.grade || availabilityData.grade || '';
  const email =
    base.email ||
    base.mail ||
    base.emailAgent ||
    availabilityData.email ||
    '';
  return {
    matricule,
    nomAgent,
    prenomAgent,
    grade,
    email,
    status: availabilityData.status || base.status || 'N/C',
    statusColor: availabilityData.statusColor || base.statusColor || '',
    emplois: buildEmplois(base),
    permis: buildPermis(base),
  };
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
  const status = person.status || 'N/C';
  const statusColor = normalizeHexColor(person.statusColor) || '#e2e8f0';
  const statusTextColor = getReadableTextColor(statusColor);
  const modalData = {
    matricule,
    nom: person.nomAgent || '',
    prenom: person.prenomAgent || '',
    grade,
    role,
    status,
    statusColor,
    email: person.email || '',
    emplois: person.emplois || [],
    permis: person.permis || [],
    gradeIcon: gradeUrl || '',
  };
  const encodedData = encodeURIComponent(JSON.stringify(modalData));

  return `
    <div class="person-card" role="button" tabindex="0" data-agent="${encodedData}" aria-label="Voir fiche ${escapeHtml(name)}">
      <div class="person-main">
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
        </div>
      </div>
      <span class="status-chip" style="background-color: ${statusColor}; color: ${statusTextColor};">
        ${escapeHtml(status)}
      </span>
    </div>
  `;
}

function renderStateItem(label, value, ok, comment, options = {}) {
  const showStatus = options.showStatus !== false;
  const statusClass = ok === true ? 'ok' : ok === false ? 'warning' : 'neutral';
  const statusLabel = ok === true ? 'OK' : ok === false ? 'KO' : 'N/A';
  const commentHtml = comment
    ? `<div class="state-comment">${formatComment(comment)}</div>`
    : '';
  const statusHtml = showStatus
    ? `<span class="chip chip-${statusClass}">${statusLabel}</span>`
    : '';
  return `
    <div class="state-card">
      <div class="state-label">${escapeHtml(label)}</div>
      <div class="state-value">${escapeHtml(value || '-')}</div>
      ${statusHtml}
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

function renderRecord(record, agentsMap, inventoryList, recordId) {
  const vehicule = record.Vehicule || record.vehicule || 'Engin';
  const recordDateIso = record.__isoDate || toIsoDate(record.Date || record.date || '');
  const recordDateLabel = formatDateFr(recordDateIso);
  const heureDebut = record.HeureDebut || record.heureDebut || '-';
  const heureFin = record.HeureFin || record.heureFin || '-';
  const duree = computeDuration(heureDebut, heureFin);

  const inventaireObj = record.__inventaire || parseJson(record.Inventaire);
  const etatVehicule = record.__etatVehicule || parseJson(record.EtatVehicule);
  const commentaire = record.Commentaire || record.commentaire || '';
  const kilometrageValue =
    record.__kilometrage != null && !Number.isNaN(record.__kilometrage)
      ? record.__kilometrage
      : null;
  const kilometrageDelta =
    record.__kilometrageDelta != null && record.__kilometrageDelta >= 0
      ? record.__kilometrageDelta
      : null;
  const kilometrageText =
    kilometrageDelta != null
      ? `${kilometrageDelta} km depuis le dernier inventaire`
      : kilometrageValue != null
        ? `${kilometrageValue} km`
        : 'Non renseigné';

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
          kilometrageText,
          null,
          '',
          { showStatus: false }
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
    <section class="record" id="${escapeHtml(recordId || '')}">
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

function renderPage({ date, recordsHtml, hasData, menuHtml }) {
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

          .hero-content {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .hero-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.9);
            padding: 6px;
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

          .inventory-menu {
            margin-top: -6px;
          }

          .inventory-menu-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }

          .inventory-link {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid var(--border);
            background: #f8fafc;
            text-decoration: none;
            color: var(--text);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }

          .inventory-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
          }

          .inventory-link-title {
            font-weight: 600;
          }

          .inventory-link-sub {
            font-size: 12px;
            color: var(--muted);
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
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px;
            background: #f8fafc;
            border-radius: 14px;
            border: 1px solid var(--border);
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }

          .person-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
          }

          .person-card:focus {
            outline: 2px solid rgba(25, 118, 210, 0.4);
            outline-offset: 2px;
          }

          .person-main {
            display: flex;
            align-items: center;
            gap: 12px;
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

          .status-chip {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
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

          .modal {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }

          .modal.open {
            display: flex;
          }

          .modal-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(6px);
          }

          .modal-content {
            position: relative;
            z-index: 2;
            background: white;
            border-radius: 20px;
            padding: 24px;
            width: min(520px, 92vw);
            box-shadow: 0 30px 60px rgba(15, 23, 42, 0.2);
          }

          .modal-close {
            position: absolute;
            top: 14px;
            right: 16px;
            border: none;
            background: #e2e8f0;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            font-weight: 600;
            color: #475569;
          }

          .modal-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 18px;
          }

          .modal-grade {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: #f8fafc;
            padding: 6px;
            object-fit: contain;
          }

          .modal-header-text {
            flex: 1;
          }

          .modal-title {
            font-size: 18px;
            font-weight: 600;
          }

          .modal-subtitle {
            font-size: 13px;
            color: var(--primary);
            margin-top: 2px;
          }

          .modal-role {
            font-size: 12px;
            color: var(--muted);
            margin-top: 4px;
          }

          .modal-section {
            margin-bottom: 16px;
          }

          .modal-section-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .modal-icons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .emploi-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            background: #f8fafc;
            border-radius: 10px;
            padding: 8px;
            border: 1px solid var(--border);
          }

          .emploi-item img {
            width: 26px;
            height: 26px;
            object-fit: contain;
          }

          .emploi-chip {
            font-size: 10px;
            font-weight: 700;
            color: #111;
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
          }

          .mail-button {
            background: var(--primary);
            color: white;
            padding: 10px 16px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
          }

          .mail-button.disabled {
            background: #cbd5f5;
            color: #64748b;
            pointer-events: none;
          }

          .modal-empty {
            margin-top: 6px;
            font-size: 12px;
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
            <div class="hero-content">
              <img class="hero-logo" src="${LOGO_URL}" alt="CMS Collonges" />
              <div>
                <h1>Inventaire récapitulatif</h1>
                <p>${escapeHtml(title)}</p>
              </div>
            </div>
            <span class="chip chip-neutral">${escapeHtml(date)}</span>
          </div>
          ${menuHtml || ''}
          ${
            hasData
              ? recordsHtml
              : `<div class="card"><div class="empty">Aucun inventaire trouvé pour cette date.</div></div>`
          }
        </div>
        <div class="modal" id="agentModal" aria-hidden="true">
          <div class="modal-backdrop" data-modal-close="true"></div>
          <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <button class="modal-close" type="button" data-modal-close="true">×</button>
            <div class="modal-header">
              <img class="modal-grade" src="" alt="" data-modal-grade />
              <div class="modal-header-text">
                <div class="modal-title" id="modalTitle" data-modal-name></div>
                <div class="modal-subtitle" data-modal-grade-label></div>
                <div class="modal-role" data-modal-role></div>
              </div>
              <span class="status-chip" data-modal-status></span>
            </div>
            <div class="modal-section">
              <div class="modal-section-title">Emplois</div>
              <div class="modal-icons" data-modal-emplois></div>
              <div class="empty modal-empty" data-modal-emplois-empty>Aucun emploi renseigné.</div>
            </div>
            <div class="modal-section">
              <div class="modal-section-title">Permis</div>
              <div class="modal-icons" data-modal-permis></div>
              <div class="empty modal-empty" data-modal-permis-empty>Aucun permis renseigné.</div>
            </div>
            <div class="modal-actions">
              <a class="mail-button" data-modal-email href="#" target="_blank" rel="noopener">Envoyer un mail</a>
            </div>
          </div>
        </div>
        <script>
          (function () {
            const modal = document.getElementById('agentModal');
            if (!modal) return;
            const nameEl = modal.querySelector('[data-modal-name]');
            const gradeEl = modal.querySelector('[data-modal-grade-label]');
            const roleEl = modal.querySelector('[data-modal-role]');
            const statusEl = modal.querySelector('[data-modal-status]');
            const gradeImg = modal.querySelector('[data-modal-grade]');
            const emploisEl = modal.querySelector('[data-modal-emplois]');
            const permisEl = modal.querySelector('[data-modal-permis]');
            const emploisEmpty = modal.querySelector('[data-modal-emplois-empty]');
            const permisEmpty = modal.querySelector('[data-modal-permis-empty]');
            const emailButton = modal.querySelector('[data-modal-email]');

            const getTextColor = function (hex) {
              if (!hex || hex.length !== 7) return '#111';
              const r = parseInt(hex.substring(1, 3), 16);
              const g = parseInt(hex.substring(3, 5), 16);
              const b = parseInt(hex.substring(5, 7), 16);
              const yiq = (r * 299 + g * 587 + b * 114) / 1000;
              return yiq >= 140 ? '#111' : '#fff';
            };

            const openModal = function (data) {
              const fullName = ((data.nom || '') + ' ' + (data.prenom || '')).trim();
              nameEl.textContent = fullName || 'Agent';
              gradeEl.textContent = data.grade || 'Grade non renseigné';
              roleEl.textContent = data.role || '';
              const statusColor = data.statusColor || '#e2e8f0';
              statusEl.textContent = data.status || 'N/C';
              statusEl.style.backgroundColor = statusColor;
              statusEl.style.color = getTextColor(statusColor);
              if (data.gradeIcon) {
                gradeImg.src = data.gradeIcon;
                gradeImg.alt = data.grade || '';
                gradeImg.style.display = 'block';
              } else {
                gradeImg.style.display = 'none';
              }

              const emplois = Array.isArray(data.emplois) ? data.emplois : [];
              const permis = Array.isArray(data.permis) ? data.permis : [];
              emploisEl.innerHTML = emplois
                .map(function (emploi) {
                  const chip = emploi.chip
                    ? '<span class="emploi-chip">' + emploi.chip + '</span>'
                    : '';
                  return (
                    '<div class="emploi-item">' +
                    '<img src="' +
                    emploi.icon +
                    '" alt="' +
                    (emploi.name || '') +
                    '" />' +
                    chip +
                    '</div>'
                  );
                })
                .join('');
              permisEl.innerHTML = permis
                .map(function (permit) {
                  return (
                    '<div class="emploi-item">' +
                    '<img src="' +
                    permit.icon +
                    '" alt="' +
                    (permit.name || '') +
                    '" />' +
                    '</div>'
                  );
                })
                .join('');
              emploisEmpty.style.display = emplois.length ? 'none' : 'block';
              permisEmpty.style.display = permis.length ? 'none' : 'block';

              if (data.email) {
                emailButton.textContent = 'Envoyer un mail';
                emailButton.href = 'mailto:' + data.email;
                emailButton.classList.remove('disabled');
              } else {
                emailButton.textContent = 'Email indisponible';
                emailButton.href = '#';
                emailButton.classList.add('disabled');
              }

              modal.classList.add('open');
              modal.setAttribute('aria-hidden', 'false');
            };

            const closeModal = function () {
              modal.classList.remove('open');
              modal.setAttribute('aria-hidden', 'true');
            };

            document.querySelectorAll('.person-card').forEach(function (card) {
              const open = function () {
                const encoded = card.getAttribute('data-agent');
                if (!encoded) return;
                try {
                  const data = JSON.parse(decodeURIComponent(encoded));
                  openModal(data);
                } catch (err) {
                  console.error(err);
                }
              };
              card.addEventListener('click', open);
              card.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  open();
                }
              });
            });

            modal.querySelectorAll('[data-modal-close="true"]').forEach(function (el) {
              el.addEventListener('click', closeModal);
            });

            document.addEventListener('keydown', function (event) {
              if (event.key === 'Escape' && modal.classList.contains('open')) {
                closeModal();
              }
            });
          })();
        </script>
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
        menuHtml: '',
      })
    );
    return;
  }

  try {
    const [historique, agents, availability] = await Promise.all([
      fetchSheet(INVENTAIRE_SHEET_ID, HISTORIQUE_SHEET),
      fetchSheet(AGENTS_SHEET_ID, AGENTS_SHEET),
      fetchSheet(AVAILABILITY_SHEET_ID, AVAILABILITY_SHEET),
    ]);

    const availabilityMap = {};
    availability.forEach((row) => {
      if (row && row.matricule) {
        availabilityMap[row.matricule] = row;
      }
    });

    const agentsMap = {};
    agents.forEach((agent) => {
      if (agent && agent.matricule) {
        agentsMap[agent.matricule] = buildAgentProfile(
          agent.matricule,
          agent,
          availabilityMap[agent.matricule]
        );
      }
    });

    Object.keys(availabilityMap).forEach((matricule) => {
      if (!agentsMap[matricule]) {
        agentsMap[matricule] = buildAgentProfile(
          matricule,
          {},
          availabilityMap[matricule]
        );
      }
    });

    const historiqueWithMeta = historique.map((row, index) => {
      const isoDate = toIsoDate(row.Date || row.date || '');
      const timeValue = row.HeureDebut || row.HeureFin || '';
      const timestamp = toTimestamp(isoDate, timeValue, index);
      const etatVehicule = parseJson(row.EtatVehicule);
      const inventaire = parseJson(row.Inventaire);
      const kilometrage =
        etatVehicule && etatVehicule.kilometrage != null
          ? Number(etatVehicule.kilometrage)
          : null;
      return {
        ...row,
        __index: index,
        __isoDate: isoDate,
        __timestamp: timestamp,
        __etatVehicule: etatVehicule,
        __inventaire: inventaire,
        __kilometrage: Number.isNaN(kilometrage) ? null : kilometrage,
      };
    });

    const recordsByVehicule = new Map();
    historiqueWithMeta.forEach((record) => {
      const vehicule = record.Vehicule || record.vehicule;
      if (!vehicule) return;
      if (!recordsByVehicule.has(vehicule)) {
        recordsByVehicule.set(vehicule, []);
      }
      recordsByVehicule.get(vehicule).push(record);
    });

    recordsByVehicule.forEach((records) => {
      records.sort((a, b) => {
        const timeA = a.__timestamp ?? Number.MAX_SAFE_INTEGER;
        const timeB = b.__timestamp ?? Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;
        return a.__index - b.__index;
      });
      let lastKilometrage = null;
      records.forEach((record) => {
        if (record.__kilometrage != null) {
          if (lastKilometrage != null) {
            const delta = record.__kilometrage - lastKilometrage;
            record.__kilometrageDelta = delta >= 0 ? delta : null;
          } else {
            record.__kilometrageDelta = null;
          }
          lastKilometrage = record.__kilometrage;
        } else {
          record.__kilometrageDelta = null;
        }
      });
    });

    const filtered = historiqueWithMeta.filter(
      (row) => row.__isoDate === requestedDate
    );

    if (!filtered.length) {
      res.send(
        renderPage({
          date: requestedDate,
          recordsHtml: '',
          hasData: false,
          menuHtml: '',
        })
      );
      return;
    }

    filtered.sort((a, b) => {
      const timeA = a.__timestamp ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.__timestamp ?? Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;
      return a.__index - b.__index;
    });

    filtered.forEach((record, index) => {
      record.__recordId = `inventaire-${index + 1}`;
    });

    const uniqueVehicules = [
      ...new Set(
        filtered
          .map((row) => row.Vehicule || row.vehicule)
          .filter((vehicule) => vehicule)
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

    const menuHtml =
      filtered.length > 1
        ? `
        <div class="card inventory-menu">
          <div class="section-title">
            <span class="material-icons">list_alt</span>
            Inventaires de la journée
          </div>
          <div class="inventory-menu-grid">
            ${filtered
              .map((row) => {
                const vehicule = row.Vehicule || row.vehicule || 'Engin';
                const start = row.HeureDebut || '';
                const end = row.HeureFin || '';
                const timeLabel =
                  start && end
                    ? `${start} - ${end}`
                    : start || end || 'Horaire non renseigné';
                const status = row.Status || row.status || 'Inventaire';
                return `
                  <a class="inventory-link" href="#${escapeHtml(
                    row.__recordId
                  )}">
                    <span class="inventory-link-title">${escapeHtml(
                      vehicule
                    )}</span>
                    <span class="inventory-link-sub">${escapeHtml(
                      timeLabel
                    )}</span>
                    <span class="chip chip-neutral">${escapeHtml(
                      status
                    )}</span>
                  </a>
                `;
              })
              .join('')}
          </div>
        </div>
      `
        : '';

    const recordsHtml = filtered
      .map((row) => {
        const vehicule = row.Vehicule || row.vehicule;
        return renderRecord(
          row,
          agentsMap,
          inventoryMap[vehicule] || [],
          row.__recordId
        );
      })
      .join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      renderPage({
        date: requestedDate,
        recordsHtml,
        hasData: true,
        menuHtml,
      })
    );
  } catch (err) {
    console.error('Erreur lors de la génération inventaire recap:', err.message);
    next(err);
  }
});

module.exports = router;
