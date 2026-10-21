import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { profile, focus, stack, experience, certHighlights, projects } from "../data.js";
import { Reveal, Stagger, StaggerItem, SpotlightCard } from "../lib/motion.jsx";
import Footer from "../components/Footer.jsx";
import LowPolyPortrait from "../components/LowPolyPortrait.jsx";
import { lazy, Suspense } from "react";

// The darts game loads after the profile, so the page paints first.
const DartsArena = lazy(() => import("../darts/DartsArena.jsx"));

function Row({ label, children, id }) {
  return (
    <section className="row" id={id}>
      <Reveal as="div" className="row-label">{label}</Reveal>
      <div className="row-content">{children}</div>
    </section>
  );
}

function ProjectCard({ p }) {
  return (
    <SpotlightCard className="proj-card lab-card">
      <div className="lab-top">
        <h3>{p.title}</h3>
        <span className="lab-cert">{p.cert}</span>
      </div>
      {p.outcome && <p className="proj-outcome">{p.outcome}</p>}
      <p>{p.blurb}</p>
      {p.tags && (
        <div className="mini-tags">
          {p.tags.map((t) => (<span key={t}>{t}</span>))}
        </div>
      )}
    </SpotlightCard>
  );
}

export default function Home() {
  const featured = projects.find((p) => p.featured);
  // The next two real projects sit under the featured one.
  const topProjects = projects.filter((p) => p !== featured).slice(0, 2);

  return (
    <div className="home-grid">
      <div className="home-left">
      {/* Hero: who I am + one clear path in */}
      <section className="hero hero-split">
        <div className="hero-copy">
          <motion.div className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {profile.role}
          </motion.div>
          <motion.h1
            className="hero-lead"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            I work on <span className="hl">data governance</span>, AI risk and information security.
          </motion.h1>
          <Stagger className="profiles" gap={0.06}>
            <StaggerItem as="span"><Link className="pill" to="/playground">View projects</Link></StaggerItem>
            <StaggerItem as="span"><a className="pill" href={profile.github} target="_blank" rel="noopener">GitHub</a></StaggerItem>
            <StaggerItem as="span"><a className="pill" href={profile.linkedin} target="_blank" rel="noopener">LinkedIn</a></StaggerItem>
          </Stagger>
        </div>
        <motion.div
          className="hero-portrait"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <LowPolyPortrait src="/portrait.png" alt="Umair Javaid Manj" />
        </motion.div>
      </section>

      <Row label="Focus" id="focus">
        <Stagger className="tags" gap={0.03} as="ul">
          {focus.map((f) => (<StaggerItem as="li" key={f}>{f}</StaggerItem>))}
        </Stagger>
      </Row>

      {/* Projects: the evidence a hiring manager actually scans for. */}
      <Row label="Projects" id="projects">
        {featured && (
          <Reveal>
            <SpotlightCard className="proj-featured">
              <span className="proj-featured-tag">Featured</span>
              <div className="lab-top">
                <h3>{featured.title}</h3>
                <span className="lab-cert">{featured.cert}</span>
              </div>
              {featured.outcome && <p className="proj-outcome">{featured.outcome}</p>}
              <p>{featured.blurb}</p>
              {featured.tags && (
                <div className="mini-tags">
                  {featured.tags.map((t) => (<span key={t}>{t}</span>))}
                </div>
              )}
            </SpotlightCard>
          </Reveal>
        )}
        <Stagger className="proj-stack" gap={0.05}>
          {topProjects.map((p) => (
            <StaggerItem key={p.title}><ProjectCard p={p} /></StaggerItem>
          ))}
        </Stagger>
        <div className="see-all"><Link className="alink" to="/playground">See all projects</Link></div>
      </Row>

      <Row label="Experience" id="experience">
        <div className="xp-list">
          {experience.map((x, i) => (
            <Reveal className="xp-item" key={x.role} delay={Math.min(i * 0.04, 0.2)}>
              <div className="xp-top"><h4>{x.role}</h4><span className="xp-date">{x.date}</span></div>
              <div className="xp-org">{x.org}</div>
              <p>{x.blurb}</p>
            </Reveal>
          ))}
        </div>
      </Row>

      <Row label="Stack & tools">
        {Object.entries(stack).map(([group, items]) => (
          <div className="stack-group" key={group}>
            <h4>{group}</h4>
            <Stagger className="tags" gap={0.03} as="ul">
              {items.map((t) => (<StaggerItem as="li" key={t}>{t}</StaggerItem>))}
            </Stagger>
          </div>
        ))}
      </Row>

      <Row label="Certifications">
        <Stagger className="cert-mini" gap={0.05}>
          {certHighlights.map((c) => (
            <StaggerItem key={c.name}>
              <Link to="/certifications">
                <SpotlightCard className="cert-chip">
                  <span className="issuer">{c.issuer}</span>
                  <span className="nm">{c.name}</span>
                </SpotlightCard>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="see-all"><Link className="alink" to="/certifications">See all certifications</Link></div>
      </Row>

      <Row label="Contact">
        <div className="kv">
          <a className="alink" href={`mailto:${profile.email}`}>{profile.email}</a>
          <a className="alink" href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a>
          <span className="muted">{profile.location}</span>
        </div>
      </Row>

      </div>

      {/* Throw darts to master AI security: a lesson or a quick check after every throw. */}
      <aside className="home-right" aria-label="Throw darts to master AI security">
        <Suspense fallback={<div className="dt dt-loading"><div className="dt-stage" /></div>}>
          <DartsArena />
        </Suspense>
      </aside>

      <Footer />
    </div>
  );
}
