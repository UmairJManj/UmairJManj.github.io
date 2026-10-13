// Content for the portfolio. Voice: plain first person, short lines, no
// adjective padding. Positioning bridges data & AI governance (current role)
// with the real cybersecurity and networking base. Certifications mirror the
// curated LinkedIn set. The PhD stays in the background.

export const profile = {
  name: "Umair Javaid Manj",
  role: "Data & AI Governance · Cybersecurity",
  location: "Auckland, New Zealand",
  email: "umairjavaidmanj@gmail.com",
  phone: "+64 20 4483186",
  github: "https://github.com/umairjmanj",
  linkedin: "https://linkedin.com/in/umairjm",
};

export const focus = [
  "Data Governance",
  "AI Risk & Governance",
  "Privacy Act 2020",
  "ISO/IEC 27001",
  "OWASP LLM Top 10",
  "Security Operations",
  "Incident Response",
  "Network Defense",
];

export const stack = {
  "Governance & risk": ["ISO/IEC 27001", "NIST AI RMF", "NIST CSF", "Privacy Act 2020", "OWASP LLM Top 10", "MITRE ATT&CK"],
  Networking: ["TCP/IP", "Routing & Switching", "VLANs", "Subnetting", "Firewalls", "IDS / IPS", "ACLs", "Cisco IOS"],
  Tooling: ["Python", "PowerShell", "Bash", "Nmap", "Wireshark", "Burp Suite", "Nessus"],
};

export const experience = [
  {
    role: "Data & AI Governance Analyst",
    org: "Centre for Chiropractic Research, New Zealand College of Chiropractic",
    date: "Aug 2026 to present",
    blurb:
      "Research data governance and privacy under the Privacy Act 2020, AI model and pipeline risk against the OWASP LLM Top 10 and NIST AI RMF, and an ISO/IEC 27001 aligned information risk register.",
  },
  {
    role: "Program Manager",
    org: "Coding, Robotics & AI Learning Project, NUST",
    date: "2024 to 2025",
    blurb: "Ran a national cybersecurity, networking and AI training program, from scheduling and delivery through to reporting.",
  },
  {
    role: "Instructor",
    org: "HISDP, AI Lounge & Murabbi, NUST",
    date: "2023 to 2024",
    blurb: "Taught smart contract and blockchain security, built the hands on labs and CTF style assessments, and won a Best Instructor award.",
  },
  {
    role: "Research Associate",
    org: "COGNET Lab, SEECS, NUST",
    date: "2022 to 2023",
    blurb: "Researched post quantum cryptography and defences against adversarial attacks on machine learning models.",
  },
  {
    role: "Research Assistant",
    org: "COGNET Lab, SEECS, NUST",
    date: "2021 to 2022",
    blurb: "Built a tamper evident, cryptography based verifiable voting system with end to end audit controls.",
  },
  {
    role: "Network Engineer",
    org: "Nexalink",
    date: "2016 to 2017",
    blurb: "Configured and hardened routers, switches and firewalls, with VLAN segmentation and access control lists.",
  },
];

// Real work, framed by outcome. `featured` surfaces the lead project.
export const projects = [
  {
    title: "Tamper evident voting system",
    domain: "Applied security research",
    cert: "Research",
    featured: true,
    outcome: "End to end auditable system with cryptographic integrity checks",
    blurb:
      "Built a verifiable voting system that pairs cryptographic integrity checks with computer vision, designed threat model first. COGNET Lab, NUST.",
    tags: ["Cryptography", "Threat modeling", "Computer vision", "Python"],
  },
  {
    title: "Post quantum cryptography and adversarial ML",
    domain: "Applied security research",
    cert: "Research",
    outcome: "Threat models and defences for deep learning under attack",
    blurb:
      "Research on post quantum cryptography and on hardening deep learning models against adversarial examples. COGNET Lab, NUST.",
    tags: ["Post quantum cryptography", "Adversarial ML", "Threat modeling"],
  },
];

// Home-page preview, newest governance-direction credentials first.
export const certHighlights = [
  { issuer: "IBM", name: "Cybersecurity Analyst" },
  { issuer: "Microsoft", name: "AI Skills Fest 2026, Cloud Security" },
  { issuer: "LinkedIn", name: "Statistics Foundations 1 to 3" },
  { issuer: "Global AI Community", name: "Agents League, Creative Apps" },
  { issuer: "IBM", name: "Incident Response & Digital Forensics" },
  { issuer: "TryHackMe", name: "Jr Penetration Tester" },
];

// Mirrors the curated LinkedIn certifications list.
export const certsCompleted = [
  { issuer: "IBM", name: "Cybersecurity Analyst Specialization" },
  { issuer: "Microsoft", name: "AI Skills Fest 2026, Cloud Security" },
  { issuer: "Global AI Community", name: "Agents League, Creative Apps" },
  { issuer: "LinkedIn", name: "Statistics Foundations 1 to 3" },
  { issuer: "IBM", name: "Incident Response and Digital Forensics" },
  { issuer: "IBM", name: "Cybersecurity Assessment: CompTIA Security+ & CySA+" },
  { issuer: "TryHackMe", name: "Jr Penetration Tester Learning Path" },
  { issuer: "Princeton", name: "Bitcoin & Cryptocurrency Technologies" },
];

// Security relevant research only, from the authoritative publication list.
export const securityResearch = [
  {
    cite:
      "Haq, M. I. U., Manj, U. J., Paracha, S. Q., Imam, Y., Rizvi, D. Q., & Farooqi, A. R. (2026). Neuro-symbolic AI-driven secure communication framework for autonomous cyber-physical systems.",
    venue: "APAN 2026, Track 2: AI, Machine Learning and Computer Vision, 1–6. https://doi.org/10.1109/apan70967.2026.11709696",
    status: "Published",
  },
  {
    cite:
      "Haq, M. I. U., Manj, U. J., Qamar, D., Imam, Y., Yasin, J., & Perwaiz, N. (2026). Rethinking intrusion detection evaluation: evidence of performance inflation under random data splits.",
    venue: "FIT26, Machine Learning and its Applications Track. (UR)",
    status: "Submitted",
  },
  {
    cite:
      "Murad, M. A., Manj, U. J., Haq, M. I. U., Qamar, D., & Imam, Y. (2026). Rethinking intrusion detection evaluation: evidence from temporal and unseen attack generalization.",
    venue: "FIT26, Machine Learning and its Applications Track. (UR)",
    status: "Submitted",
  },
  {
    cite:
      "Haq, M. I. U., Manj, U. J., Qamar, D., Fatima, K., Imam, Y., & Rizvi, H. (2026). Quantized CNN–Transformer inference on FPGA for real-time RF spectrum intelligence and adaptive jamming defense.",
    venue: "Engineering Reports. (UR)",
    status: "Submitted",
  },
];
