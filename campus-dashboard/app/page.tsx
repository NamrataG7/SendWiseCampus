import Link from 'next/link';

export const metadata = {
  title: 'SendWise Campus',
  description:
    'On-campus, on-college-owned-devices cyberbullying prevention — privacy-preserving, wellbeing-first.',
};

export default function LandingPage() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        color: '#1b1b1f',
        background: '#fafbff',
        minHeight: '100vh',
      }}
    >
      {/* Top nav */}
      <header
        style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        <nav
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>
            SendWise <span style={{ color: '#4c1d95' }}>Campus</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/privacy" style={linkMuted}>
              Privacy
            </Link>
            <Link href="/terms" style={linkMuted}>
              Terms
            </Link>
            <Link href="/login" style={btnGhost}>
              Sign in
            </Link>
            <Link href="/signup" style={btnPrimary}>
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '72px 24px 40px',
          textAlign: 'center',
        }}
      >
        <div style={pill}>Academic project · Not for commercial use</div>
        <h1
          style={{
            fontSize: 44,
            lineHeight: 1.15,
            margin: '18px 0 14px',
            fontWeight: 700,
          }}
        >
          Reduce campus cyberbullying,{' '}
          <span style={{ color: '#4c1d95' }}>without surveillance.</span>
        </h1>
        <p
          style={{
            fontSize: 17,
            color: '#4b5563',
            maxWidth: 640,
            margin: '0 auto',
            lineHeight: 1.55,
          }}
        >
          A privacy-preserving, on-device nudge system for college-owned devices
          and campus WiFi. Wellbeing-first, not disciplinary. Message content
          never leaves the student&apos;s browser.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginTop: 28,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/signup" style={btnPrimaryLg}>
            Create wellbeing-team account
          </Link>
          <Link href="/login" style={btnGhostLg}>
            Sign in to dashboard
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px 24px 24px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} style={card}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
              <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '48px 24px 24px',
        }}
      >
        <h2 style={h2}>How it works</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7, color: '#374151' }}>
          <li>
            <strong>Browser extension</strong> runs on college-owned Chrome /
            Edge. Detects potentially harmful drafts on-device before send.
          </li>
          <li>
            <strong>Shadow-DOM warning</strong> shows Edit / Send anyway / Cancel
            &mdash; student always chooses.
          </li>
          <li>
            <strong>Metadata only</strong> (category, severity, action &mdash;
            no message text) is reported to the wellbeing team.
          </li>
          <li>
            <strong>Aggregate-first dashboard</strong> shows cohort trends.
            Per-student drill-down requires <em>dual-control</em> approval
            (wellbeing lead + student ombudsman).
          </li>
        </ol>
      </section>

      {/* Roles */}
      <section
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px 24px 40px',
        }}
      >
        <h2 style={h2}>Who signs in here</h2>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Wellbeing team
            </div>
            <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
              Sign in to see aggregate cohort statistics and submit drill-down
              requests when supporting a specific student.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href="/login" style={linkAccent}>
                Sign in &rarr;
              </Link>
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Student ombudsman
            </div>
            <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
              Independent role. Co-approves drill-down requests. Has veto
              power. See the{' '}
              <Link href="/terms" style={linkAccent}>
                terms
              </Link>{' '}
              for the charter.
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Students</div>
            <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
              You do not sign in here. The extension runs on your college
              browser. Read the{' '}
              <Link href="/privacy" style={linkAccent}>
                privacy notice
              </Link>{' '}
              to see exactly what is (and isn&apos;t) collected.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #e5e7eb',
          padding: '20px 24px',
          background: '#fff',
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            fontSize: 13,
            color: '#6b7280',
          }}
        >
          <div>
            SendWise Campus &middot; academic project &middot; built on{' '}
            <a
              href="https://github.com/NamrataG7/SendWise"
              style={linkAccent}
              target="_blank"
              rel="noreferrer"
            >
              SendWise
            </a>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <Link href="/privacy" style={linkMuted}>
              Privacy
            </Link>
            <Link href="/terms" style={linkMuted}>
              Terms
            </Link>
            <a
              href="https://github.com/NamrataG7/SendWiseCampus"
              style={linkMuted}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: '🛡',
    title: 'On-device detection',
    body: 'Content classification runs locally in the browser. Message text never leaves the student device.',
  },
  {
    icon: '📊',
    title: 'Aggregate-first',
    body: 'Wellbeing dashboard shows cohort trends. No per-student rows on the default view.',
  },
  {
    icon: '🔑',
    title: 'Dual-control drill-down',
    body: 'Viewing an individual student requires both a wellbeing lead and an independent student ombudsman.',
  },
  {
    icon: '🧾',
    title: 'Audit chain',
    body: 'Every de-anonymisation and role change is written to a hash-chained audit log.',
  },
  {
    icon: '⏳',
    title: 'Auto-retention',
    body: 'Aggregate data purged after one academic year. Per-student incidents purged 6 months after resolution.',
  },
  {
    icon: '🏫',
    title: 'MDM-deployed',
    body: 'Extension is force-installed via Chrome Enterprise / Intune / Jamf. Personal devices remain voluntary.',
  },
];

const linkMuted: React.CSSProperties = {
  color: '#4b5563',
  textDecoration: 'none',
  fontSize: 14,
};
const linkAccent: React.CSSProperties = {
  color: '#4c1d95',
  textDecoration: 'none',
  fontWeight: 500,
};
const btnGhost: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  color: '#1b1b1f',
  textDecoration: 'none',
  fontSize: 14,
  background: '#fff',
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  background: '#4c1d95',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
};
const btnPrimaryLg: React.CSSProperties = {
  ...btnPrimary,
  padding: '11px 22px',
  fontSize: 15,
};
const btnGhostLg: React.CSSProperties = {
  ...btnGhost,
  padding: '11px 22px',
  fontSize: 15,
};
const pill: React.CSSProperties = {
  display: 'inline-block',
  background: '#efe6ff',
  color: '#4c1d95',
  fontSize: 12,
  padding: '4px 10px',
  borderRadius: 999,
  fontWeight: 500,
  letterSpacing: 0.2,
};
const h2: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  margin: '0 0 18px',
};
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '18px 18px 20px',
};
