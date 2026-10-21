// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlan } from '../../shared/engine/planner.js';
import type { EventInput } from '../../shared/schema.js';
import { App } from '../../src/App.js';
import { localToday } from '../../src/lib/browser.js';
import { AnnouncerProvider, PlansProvider } from '../../src/state/PlansContext.js';
import { STORAGE_KEY } from '../../src/state/storage.js';

type FetchHandler = (
  url: string,
  body: unknown,
) => { status: number; body: unknown } | Promise<never>;

function mockFetch(handler: FetchHandler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const result = await handler(url, JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** A fake API that behaves like the real one (deterministic plan + canned assistant). */
const happyApi: FetchHandler = (url, body) => {
  if (url === '/api/plan') {
    const { input } = body as { input: EventInput };
    const plan = buildPlan(input, { today: localToday() });
    return { status: 200, body: { plan: { ...plan, source: 'gemini' }, cached: false } };
  }
  return { status: 200, body: { reply: 'Start with the venue this week.', source: 'gemini' } };
};

async function a11yViolations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

function renderApp() {
  const user = userEvent.setup();
  const utils = render(
    <AnnouncerProvider>
      <PlansProvider>
        <App />
      </PlansProvider>
    </AnnouncerProvider>,
  );
  return { user, ...utils };
}

async function createExamplePlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /try an example/i }));
  await user.click(screen.getByRole('button', { name: /create my plan/i }));
  return screen.findByRole('heading', { level: 1, name: /Aarav & Diya’s Wedding/ });
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '#/');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('home & planner form', () => {
  it('renders an accessible landing page', async () => {
    const { container } = renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Plan every celebration/);
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('shows a focused error summary linked to invalid fields', async () => {
    const { user, container } = renderApp();
    const budget = screen.getByLabelText(/total budget/i);
    await user.clear(budget);
    await user.type(budget, '100');
    await user.click(screen.getByRole('button', { name: /create my plan/i }));

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(
      within(alert).getByRole('link', { name: /Event name must be at least 2/ }),
    ).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: /at least ₹5,000/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/event name/i)).toHaveAttribute('aria-invalid', 'true');

    await user.click(within(alert).getByRole('link', { name: /Event name/ }));
    expect(screen.getByLabelText(/event name/i)).toHaveFocus();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('limits priorities to three', async () => {
    const { user } = renderApp();
    for (const name of ['Venue', 'Catering', 'Decor & flowers'])
      await user.click(screen.getByRole('checkbox', { name }));
    expect(screen.getByRole('checkbox', { name: 'Photo & video' })).toBeDisabled();
  });

  it('shows the per-guest budget hint as you type', async () => {
    const { user } = renderApp();
    const guests = screen.getByLabelText(/number of guests/i);
    await user.clear(guests);
    await user.type(guests, '100');
    expect(screen.getByText(/₹8L · about ₹8,000 per guest/)).toBeInTheDocument();
  });

  it('surfaces server validation errors on the matching field', async () => {
    mockFetch(() => ({
      status: 400,
      body: {
        error: 'Please check the highlighted fields.',
        fields: { 'input.city': 'City looks wrong.' },
      },
    }));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /try an example/i }));
    await user.click(screen.getByRole('button', { name: /create my plan/i }));
    expect(await screen.findByRole('link', { name: 'City looks wrong.' })).toBeInTheDocument();
  });

  it('shows rate-limit messages without creating a plan', async () => {
    mockFetch(() => ({ status: 429, body: { error: 'You are going a little fast.' } }));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /try an example/i }));
    await user.click(screen.getByRole('button', { name: /create my plan/i }));
    expect(await screen.findByText('You are going a little fast.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /your plans/i })).not.toBeInTheDocument();
  });
});

describe('plan dashboard', () => {
  it('creates a plan, persists it and passes an accessibility audit', async () => {
    const fetchMock = mockFetch(happyApi);
    const { user, container } = renderApp();
    const heading = await createExamplePlan(user);
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText(/Personalised by Google Gemini/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plan',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.location.hash).toMatch(/^#\/plan\/.+\/overview$/);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1),
    );
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('builds the plan on-device when the API is unreachable', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const { user } = renderApp();
    await createExamplePlan(user);
    expect(screen.getByText(/Built by the offline planner/)).toBeInTheDocument();
  });

  it('supports keyboard navigation between tabs', async () => {
    mockFetch(happyApi);
    const { user } = renderApp();
    await createExamplePlan(user);
    const overview = screen.getByRole('tab', { name: /overview/i });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    overview.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /budget/i })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/budget/i);
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /assistant/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Home}');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /assistant/i })).toHaveFocus();
  });

  it('tracks timeline progress and custom tasks', async () => {
    mockFetch(happyApi);
    const { user, container } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('tab', { name: /timeline/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Book the venue' }));
    expect(screen.getByText(/1 of 19 tasks complete/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Task'), 'Order welcome hampers');
    await user.click(screen.getByRole('button', { name: /add task/i }));
    expect(screen.getByText(/1 of 20 tasks complete/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove task order welcome hampers/i }));
    expect(screen.getByText(/1 of 19 tasks complete/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add task/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/short name/);

    await user.click(screen.getByRole('checkbox', { name: /hide completed/i }));
    expect(screen.queryByRole('checkbox', { name: 'Book the venue' })).not.toBeInTheDocument();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('edits the budget and warns about over-allocation', async () => {
    mockFetch(happyApi);
    const { user, container } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('tab', { name: /budget/i }));
    const decor = screen.getByRole('spinbutton', { name: /decor & flowers allocated/i });
    await user.clear(decor);
    await user.type(decor, '9000000');
    expect(await screen.findByText(/Allocations exceed your budget/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reset to suggested/i }));
    expect(screen.queryByText(/Allocations exceed your budget/)).not.toBeInTheDocument();

    const venueSpent = screen.getByRole('spinbutton', { name: /venue amount spent/i });
    await user.type(venueSpent, '99999999');
    expect(screen.getByText(/Over budget in: Venue/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Budget split: Venue/ })).toBeInTheDocument();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('updates vendor status and notes', async () => {
    mockFetch(happyApi);
    const { user } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('tab', { name: /vendors/i }));
    const card = screen.getByRole('listitem', { name: 'Venue' });
    await user.selectOptions(within(card).getByLabelText('Status'), 'booked');
    await user.type(within(card).getByLabelText(/notes/i), 'Quote 4L');
    expect(within(card).getAllByText('Booked').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 of 12 booked/)).toBeInTheDocument();
  });

  it('manages the guest list and RSVPs', async () => {
    mockFetch(happyApi);
    const { user, container } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('tab', { name: /guests/i }));
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/guest or family name/);

    await user.type(screen.getByLabelText(/name or family/i), 'Sharma family');
    await user.clear(screen.getByLabelText('People'));
    await user.type(screen.getByLabelText('People'), '4');
    await user.selectOptions(screen.getByLabelText('RSVP'), 'yes');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await user.click(screen.getByText(/paste a list of names/i));
    await user.type(screen.getByLabelText(/one name per line/i), 'Ravi{enter}Asha{enter}');
    await user.click(screen.getByRole('button', { name: /add all/i }));

    const summary = screen.getByRole('list', { name: /rsvp summary/i });
    expect(within(summary).getByText('Invitations').nextSibling).toHaveTextContent('3');
    expect(within(summary).getByText('Attending').nextSibling).toHaveTextContent('4');

    await user.selectOptions(screen.getByLabelText(/filter by rsvp/i), 'yes');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /remove sharma family/i }));
    expect(screen.getByText(/no guests match this filter/i)).toBeInTheDocument();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('chats with the assistant and falls back offline', async () => {
    let fail = false;
    const fetchMock = mockFetch((url, body) =>
      url === '/api/assistant' && fail
        ? { status: 503, body: { error: 'down' } }
        : happyApi(url, body),
    );
    const { user, container } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('tab', { name: /assistant/i }));

    await user.type(screen.getByLabelText(/your question/i), 'What first?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText('Start with the venue this week.')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.at(-1)!;
    const sent = JSON.parse(String(init?.body));
    expect(sent.context.title).toBe('Aarav & Diya’s Wedding');
    expect(sent.messages.at(-1)).toEqual({ role: 'user', content: 'What first?' });

    fail = true;
    await user.click(screen.getByRole('button', { name: /cut 10% from my budget/i }));
    expect(await screen.findByText(/15% trim/)).toBeInTheDocument();
    expect(screen.getByText(/Utsav assistant \(offline\)/)).toBeInTheDocument();
    expect(await a11yViolations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: /clear conversation/i }));
    expect(screen.getByText(/ask anything about this plan/i)).toBeInTheDocument();
  });

  it('shows ideas and exports a calendar file', async () => {
    mockFetch(happyApi);
    const createObjectURL = vi.fn(() => 'blob:utsav');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const { user } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('tab', { name: /ideas/i }));
    expect(
      screen.getByRole('list', { name: /theme colour palette/i }).children.length,
    ).toBeGreaterThanOrEqual(3);
    await user.click(screen.getByRole('button', { name: /add to calendar/i }));
    await user.click(screen.getByRole('button', { name: /^export$/i }));
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('regenerates and deletes a plan', async () => {
    const fetchMock = mockFetch(happyApi);
    const { user } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('button', { name: /regenerate/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /plan every celebration/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /your plans/i })).not.toBeInTheDocument();
  });

  it('lists saved plans on the home page and handles unknown plan ids', async () => {
    mockFetch(happyApi);
    const { user } = renderApp();
    await createExamplePlan(user);
    await user.click(screen.getByRole('link', { name: /all plans/i }));
    expect(await screen.findByRole('heading', { name: /your plans/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /task progress/i })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    await user.click(screen.getByRole('button', { name: /delete aarav/i }));
    expect(screen.queryByRole('heading', { name: /your plans/i })).not.toBeInTheDocument();

    act(() => {
      window.location.hash = '#/plan/missing/overview';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('heading', { name: /plan not found/i })).toBeInTheDocument();
  });

  it('follows the OS theme until the user explicitly toggles it', async () => {
    delete document.documentElement.dataset.theme;
    const { user } = renderApp();
    expect(localStorage.getItem('utsav:theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();

    const toggle = screen.getByRole('button', { name: /switch to dark theme/i });
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('utsav:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });
});
