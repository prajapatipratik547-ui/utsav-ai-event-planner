import { lazy, Suspense, useEffect } from 'react';
import { Icon, Logo } from './components/Icon.js';
import { PlannerForm } from './components/PlannerForm.js';
import { SavedPlans } from './components/SavedPlans.js';
import { navigate, useRoute, useTheme } from './lib/browser.js';
import { usePlans } from './state/PlansContext.js';

// The dashboard is the heaviest view; load it only when a plan is opened.
const Dashboard = lazy(() => import('./components/Dashboard.js'));

function showSavedPlans() {
  if (window.location.hash.startsWith('#/plan')) navigate({ name: 'home' });
  window.setTimeout(() => {
    const heading = document.getElementById('saved-plans-title');
    heading?.scrollIntoView?.({ block: 'start' });
    heading?.focus();
  }, 50);
}

function Header() {
  const [theme, toggleTheme] = useTheme();
  const { plans } = usePlans();
  return (
    <header className="site-header">
      <div className="toran" aria-hidden="true" />
      <div className="container">
        <a className="brand" href="#/" aria-label="Utsav home">
          <Logo />
          <span>
            Utsav
            <small>Celebration planner</small>
          </span>
        </a>
        <nav className="header-actions" aria-label="Site">
          {plans.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={showSavedPlans}>
              My plans ({plans.length})
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </nav>
      </div>
    </header>
  );
}

function Home() {
  return (
    <>
      <section className="container hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <Icon name="sparkles" /> GenAI celebration planner
          </p>
          <h1 id="hero-title">
            Plan every celebration, <em>beautifully.</em>
          </h1>
          <p className="lead">
            Tell Utsav about your wedding, birthday, festival or community event. In seconds you get
            a rupee-accurate budget, a dated timeline, a vendor checklist and ideas made for your
            city, style and diet — then refine it with an AI assistant.
          </p>
          <ul className="feature-list">
            <li>
              <span className="feature-icon">
                <Icon name="wallet" />
              </span>
              <span>
                <strong>Smart budget split</strong>
                <span>Adjusts for guests, city, style and your priorities.</span>
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <Icon name="calendar" />
              </span>
              <span>
                <strong>Countdown timeline</strong>
                <span>
                  Dated milestones that compress if time is short. Export to your calendar.
                </span>
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <Icon name="store" />
              </span>
              <span>
                <strong>Vendor checklist</strong>
                <span>What to ask every vendor, and when to book them.</span>
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <Icon name="palette" />
              </span>
              <span>
                <strong>Personalised ideas</strong>
                <span>Theme, palette, menu, decor and activities by Gemini.</span>
              </span>
            </li>
          </ul>
        </div>
        <PlannerForm />
      </section>
      <SavedPlans />
    </>
  );
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    if (route.name === 'home') document.title = 'Utsav — AI Celebration & Event Planner';
  }, [route.name]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {route.name === 'plan' ? (
          <Suspense
            fallback={
              <p className="container empty" role="status">
                Opening your plan
                <span className="loading-dots" />
              </p>
            }
          >
            <Dashboard id={route.id} tab={route.tab} />
          </Suspense>
        ) : (
          <Home />
        )}
      </main>
      <footer className="site-footer">
        <div className="container">
          <span>Utsav · Plans are stored only in this browser.</span>
          <span>Budgets are indicative estimates — always confirm quotes with vendors.</span>
        </div>
      </footer>
    </>
  );
}
