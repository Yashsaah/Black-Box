import SplitText from "../components/SplitText";
import { Reveal } from "../components/Layout";
import { Link } from "react-router-dom";
import { team, mentors } from "../data/content";

const initials = (n) => n.split(" ").map((w) => w[0]).join("");

function Person({ p, delay }) {
  return (
    <Reveal variant="rise" delay={delay} style={{ height: "100%" }}>
      <div className="person" style={{ height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {p.photo ? (
            <img className="person__photo" src={p.photo} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="person__initials" aria-hidden="true">{initials(p.name)}</span>
          )}
          <span>
            <h3 className="display" style={{ fontSize: "1.1rem" }}>{p.name}</h3>
            <span className="person__role">{p.role}</span>
          </span>
        </div>
        {p.focus && <p>{p.focus}</p>}
      </div>
    </Reveal>
  );
}

/* Anyone with a portrait and a bio gets the full treatment: the photo is
   presented as a captioned figure, the way every other exhibit here is.
   `compact` is the half-width variant, so two can sit side by side. */
function Feature({ p, compact = false, priority = false }) {
  return (
    <Reveal variant="scale" style={compact ? { height: "100%" } : undefined}>
      <article className={`lead${compact ? " lead--compact" : ""}`}>
        <figure className="lead__fig">
          <div className="lead__frame">
            <img
              className="lead__photo"
              src={p.photo}
              srcSet={p.photo2x ? `${p.photo} 1x, ${p.photo2x} 2x` : undefined}
              alt={p.name}
              width="380"
              height="475"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
            />
            <span className="lead__tick lead__tick--tl" aria-hidden="true" />
            <span className="lead__tick lead__tick--tr" aria-hidden="true" />
            <span className="lead__tick lead__tick--bl" aria-hidden="true" />
            <span className="lead__tick lead__tick--br" aria-hidden="true" />
          </div>
          <figcaption className="mono">{p.affiliation}</figcaption>
        </figure>

        <div className="lead__body">
          {p.kicker && <p className="eyebrow" style={{ marginBottom: 10 }}>{p.kicker}</p>}
          <h3 className="display lead__name">{p.name}</h3>

          {p.bio.map((para) => (
            <p key={para.slice(0, 32)} className="lead__para">{para}</p>
          ))}

          {p.areas?.length > 0 && (
            <>
              <p className="lead__label mono">{p.areasLabel || "Works on"}</p>
              <ul className="chips">
                {p.areas.map((a) => <li key={a} className="chip">{a}</li>)}
              </ul>
            </>
          )}

          {p.offHours && <p className="lead__off">{p.offHours}</p>}
          {p.motto && <p className="lead__motto">“{p.motto}”</p>}
        </div>
      </article>
    </Reveal>
  );
}

export default function Team() {
  const lead = mentors.find((m) => m.lead);
  const otherMentors = mentors.filter((m) => !m.lead);
  const featured = team.filter((p) => p.featured);
  const rest = team.filter((p) => !p.featured);

  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Team</p>
      </Reveal>
      <SplitText as="h1" className="display" text="Two who ask the harder questions, and six of us chasing answers" />
      <Reveal variant="fade" delay={260}>
        <p className="lede">
          Everyone owns a project end to end and reviews someone else's. The mentors read every result
          before it lands on this site. Contact details for all of us are on the{" "}
          <Link to="/contact" style={{ color: "var(--signal)" }}>contact page</Link>.
        </p>
      </Reveal>

      <Reveal variant="wipe">
        <p className="eyebrow" style={{ marginTop: 56 }}>Mentors</p>
      </Reveal>

      {lead && <Feature p={lead} priority />}

      {otherMentors.length > 0 && (
        <div className="grid-3" style={{ marginTop: lead ? 20 : 0 }}>
          {otherMentors.map((p, i) => <Person key={p.name} p={p} delay={i * 80} />)}
        </div>
      )}

      <Reveal variant="wipe">
        <p className="eyebrow" style={{ marginTop: 64 }}>Members</p>
      </Reveal>

      {featured.length > 0 && (
        <div className="features">
          {featured.map((p) => <Feature key={p.name} p={p} compact />)}
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid-3" style={{ marginTop: featured.length ? 20 : 0 }}>
          {rest.map((p, i) => <Person key={p.name} p={p} delay={i * 80} />)}
        </div>
      )}
    </section>
  );
}
