# Location Taxonomy Open Cases

Stand nach dem normalen Taxonomie-Lauf:

- `4027` oeffentliche Items mit Slug
- `3992` mit vollstaendiger Geo-Hierarchie
- `35` ohne `country_slug` / `district_slug` / `municipality_slug`

Beobachtungen:

- Alle `35` offenen Faelle haben unstrukturierte `original_name`-Werte.
- Die Restfaelle verteilen sich auf nur drei Profile.
- Fast alle offenen Eintraege haben GPS-Koordinaten und sind damit gute Kandidaten fuer einen gezielten GPS-Fallback-Lauf.

Verteilung nach Profil:

- `18` Items: `aae40790-a31e-4c21-a03b-762f513f52af`
- `10` Items: `0ceb2320-0553-463b-971a-a0eef5ecdf09`
- `7` Items: `37d006d4-2b71-4cac-a9b4-2f195dfa75b8`

Typische offene Faelle:

- Kamera-Dateinamen wie `DSC02887.jpg`, `DSC02373.jpg`, `1000094813.jpg`
- historische oder freie Namen wie `Berlin Reichstag.jpg`
- aeltere Motive mit sprechendem Titel, aber ohne strukturierte Importlogik im Dateinamen

Empfohlener Nachzug:

1. Nur offene Restfaelle mit GPS pruefen:
   `npm run taxonomy:migrate:missing:gps`
2. Wenn die Ergebnisse plausibel sind, gezielt schreiben:
   `npm run taxonomy:migrate:apply:missing:gps`
3. Danach verbleibende Sonderfaelle manuell pruefen.

Neue Script-Modi:

- `--missing-geo`
  Nur Items ohne vollstaendige Geo-Hierarchie
- `--needs-review`
  Nur Items mit `location_needs_review = true`

Sinnvolle Befehle:

```bash
npm run taxonomy:migrate:missing
npm run taxonomy:migrate:missing:gps
npm run taxonomy:migrate:apply:missing:gps
```
