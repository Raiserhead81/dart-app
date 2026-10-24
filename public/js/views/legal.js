// Impressum & Datenschutz (KAY-VERKAUF, 24.10.): Rechtstexte fuer den Vertrieb.
// PLATZHALTER [KAY-...] einmal im Profil/Server ausfuellen - ich markiere sie deutlich.

import { el } from '/js/util.js';

const IMPRESSUM = [
  ['Angaben gemäß § 5 TMG', '[KAY-NAME]\n[KAY-STRASSE Nr.]\n[KAY-PLZ ORT]\nDeutschland'],
  ['Kontakt', 'E-Mail: [KAY-MAIL]'],
  ['Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV', '[KAY-NAME], Anschrift wie oben'],
  ['Streitschlichtung', 'Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'],
];

const DATENSCHUTZ = [
  ['1. Verantwortlicher', '[KAY-NAME], [KAY-ANSCHRIFT], E-Mail: [KAY-MAIL]'],
  ['2. Daten auf deinem Gerät (Standard)', 'Alle Spieldaten (Sessions, Statistiken, Profile) werden ausschließlich lokal auf deinem Gerät gespeichert (localStorage). Ohne Registrierung verlässt kein Datum dein Gerät.'],
  ['3. Account / Online-Spiele', 'Wenn du ein Konto anlegst oder Online-Matches spielst, werden Benutzername, Passwort-Hash, Match-Daten und Zeitstempel auf unserem Server (EU, Deutschland) gespeichert, um den Spielbetrieb zu ermöglichen (Art. 6 Abs. 1 lit. b DSGVO).'],
  ['4. Kein Tracking, keine Werbung', 'Die App verwendet keine Analyse-Tools, keine Werbenetzwerke und keine Third-Party-Tracker.'],
  ['5. Speicherdauer', 'Account-Daten werden bis zur Löschung deines Kontos gespeichert. Lokale Daten löschst du jederzeit über „Profil → Daten löschen“ oder durch Deinstallation.'],
  ['6. Deine Rechte', 'Du hast Anspruch auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer Aufsichtsbehörde zu beschweren.'],
  ['7. Kontaktaufnahme', 'Anfragen zur Datenverarbeitung: [KAY-MAIL]'],
];

export function renderLegal(view) {
  view.className = 'view';
  view.append(
    el('p', { class: 'kicker' }, 'Rechtliches'),
    el('div', { class: 'panel' },
      el('h2', {}, 'Impressum'),
      ...IMPRESSUM.map(([h, t]) => el('div', { class: 'mt' }, el('h3', { style: 'font-size:13px;margin:0 0 4px' }, h), ...t.split('\n').map(l => el('p', { style: 'margin:0;font-size:14px;white-space:pre-wrap' }, l))))
    ),
    el('div', { class: 'panel' },
      el('h2', {}, 'Datenschutzerklärung'),
      ...DATENSCHUTZ.map(([h, t]) => el('div', { class: 'mt' }, el('h3', { style: 'font-size:13px;margin:0 0 4px' }, h), el('p', { style: 'margin:0;font-size:14px' }, t)))
    ),
    el('button', { class: 'btn ghost', onclick: () => { history.back(); } }, 'Zurück')
  );
}
