# Outline file schema (one JSON file per exam, content-build/outlines/<id>.json)
{
  "id": "sc-900",                       // lowercase slug
  "name": "Microsoft Security, Compliance, and Identity Fundamentals",
  "code": "SC-900",
  "issuer": "Microsoft",
  "outlineVersion": "Skills measured as of <date from the official page>",
  "sourceUrl": "<official skills outline / study guide URL>",
  "exam": { "minutes": 45, "passMark": "700/1000", "questionCount": "40-60", "notes": "..." },
  "domains": [
    {
      "id": "d1",
      "name": "Describe the concepts of security, compliance, and identity",
      "weight": "10-15%",                // as published; for non-weighted frameworks give your best equal split and say so in notes
      "objectives": [
        {
          "id": "d1.1",
          "name": "Describe security and compliance concepts",
          "bullets": ["Describe the shared responsibility model", "..."]   // every bullet from the official outline, verbatim-paraphrased in short form
        }
      ]
    }
  ],
  "keyTerms": ["Zero Trust", "..."],     // 40-120 technical terms an examinee must know
  "status": "verified" | "best-effort", // best-effort if official outline could not be fetched
  "caveats": "anything uncertain, e.g. exam is new/beta, outline changed on <date>"
}
