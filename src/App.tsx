import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LessonPage } from './components/LessonPage';
import { Profile } from './components/Profile';
import { About } from './components/About';
import { Sidebar } from './components/Sidebar';
import { SignIn } from './components/SignIn';
import { WarmUp } from './components/WarmUp';
import type { Who } from './components/Avatar';
import { COUNTED, LESSONS, ORDER } from './lessons';
import { repsRunId } from './challenges/reps';
import { ABOUT_HREF, PROFILE_HREF, type Route, newSeed, repsFromHash, repsHref, routeFromHash, seedFromHash, warmUpHref } from './state/seed';
import { useSettings } from './state/settings';
import { useProgress } from './state/store';
import { WARMUP_ID, todaysWarmUp, warmUpSub } from './warmup';

const route = () => routeFromHash(location.hash, id => !!LESSONS[id]);

export function App() {
  const prog = useProgress();
  const settings = useSettings();
  const [lessonId, setLessonId] = useState(() => route().id || (LESSONS[prog.lesson] ? prog.lesson : ORDER[0].id));
  const [view, setView] = useState<Route['view']>(() => route().view);
  // A generated challenge's seed from the URL (`#id?seed=N`); null means a fresh random one.
  const [seed, setSeed] = useState<number | null>(() => seedFromHash(location.hash));
  // Reps mode (`#id?reps=N`): the lesson's generated Reps on seed N.
  const [reps, setReps] = useState<number | null>(() => repsFromHash(location.hash));
  const [signInOpen, setSignInOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const lessonRef = useRef(lessonId);
  lessonRef.current = lessonId;
  const setLastLesson = useRef(prog.setLesson);
  setLastLesson.current = prog.setLesson;

  const go = (id: string) => {
    setLessonId(id);
    setView('lesson');
    prog.setLesson(id);
    setSeed(null);
    setReps(null);
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    main.current?.scrollTo(0, 0);
  };
  // Back/forward and typed URLs. An empty or unknown hash (`#no-such-lesson`) shows a lesson and
  // is replaced by that lesson's id, so a reload or a shared link names the page on screen.
  useEffect(() => {
    const onHash = () => {
      const r = route();
      setSeed(seedFromHash(location.hash));
      setReps(repsFromHash(location.hash));
      setView(r.view);
      if (r.id) {
        setLessonId(r.id);
        setLastLesson.current(r.id); // a sign-in or a reload without a hash comes back here
      }
      if (!r.canonical) history.replaceState(null, '', '#' + lessonRef.current);
      main.current?.scrollTo(0, 0);
    };
    if (!route().canonical) history.replaceState(null, '', '#' + lessonRef.current);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  /** Profile has a URL (`#profile`), so Back from it returns to the page before. */
  const openProfile = () => {
    setView('profile');
    if (location.hash !== PROFILE_HREF) history.pushState(null, '', PROFILE_HREF);
    main.current?.scrollTo(0, 0);
  };
  /** About has a URL too (`#about`), for the same reason. */
  const openAbout = () => {
    setView('about');
    if (location.hash !== ABOUT_HREF) history.pushState(null, '', ABOUT_HREF);
    main.current?.scrollTo(0, 0);
  };
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  /** The Warm-up on a fresh seed; `#warm-up?seed=N` replays one. */
  const openWarmUp = () => {
    setSeed(null);
    setView('warm-up');
    if (location.hash !== warmUpHref()) history.pushState(null, '', warmUpHref());
    main.current?.scrollTo(0, 0);
  };
  /** A lesson's Reps on a fresh seed (the hash change routes it). */
  const goReps = (id: string) => { location.hash = repsHref(id, newSeed()); };

  const runsOf = (id: string) => prog.runs.filter(r => r.lesson === id);
  const acct = prog.account;
  const who: Who = acct
    ? { name: acct.name || acct.login, initial: (acct.name || acct.login)[0].toUpperCase(), avatarUrl: acct.avatarUrl, isGuest: false }
    : { name: 'Guest', initial: 'G', isGuest: true };
  const n = prog.runs.length;
  const userSub = acct ? `${n} ${n === 1 ? 'run' : 'runs'}` : prog.loading ? '' : 'Not signed in';
  const profileSub = acct
    ? `@${acct.login} · Joined ${new Date(acct.created).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
    : 'Guest. Progress is saved in this browser only.';
  const done = COUNTED.filter(l => runsOf(l.id).length).length;
  const lesson = LESSONS[lessonId];
  // Today's Warm-up: fixed for the day; recomputed as runs arrive (a warm-up run never changes it).
  const lessonRuns = prog.runs.filter(r => r.lesson !== WARMUP_ID);
  const runsKey = lessonRuns.length ? lessonRuns[lessonRuns.length - 1].at + ':' + lessonRuns.length : '';
  const day = new Date().toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const warmUp = useMemo(() => todaysWarmUp(lessonRuns, Date.now()), [runsKey, day]);

  return (
    <div className="app">
      <Sidebar
        activeLesson={view === 'lesson' ? lessonId : null}
        runsOf={runsOf}
        completedText={`${done} of ${COUNTED.length} done`}
        warmUp={{ sub: warmUpSub(warmUp), on: view === 'warm-up', onOpen: openWarmUp }}
        profileOn={view === 'profile'}
        who={who}
        userSub={userSub}
        homeHref={'#' + ORDER[0].id}
        onLesson={go}
        onProfile={openProfile}
        onSignIn={() => setSignInOpen(true)}
        onSignOut={prog.signOut}
        coachLive={settings.coachLive}
        onCoachLive={settings.setCoachLive}
      />
      <main ref={main} className="main">
        <div className="page">
          {prog.syncError && <p className="sync-err">{prog.syncError}</p>}
          {view === 'warm-up' ? (
            <WarmUp
              plan={warmUp}
              seed={seed}
              coachLive={settings.coachLive}
              runs={runsOf(WARMUP_ID)}
              isGuest={!acct}
              onRun={prog.addRun}
              onGo={go}
              onBack={() => go(lessonId)}
              onStats={openProfile}
            />
          ) : view === 'about' ? (
            <About />
          ) : view === 'profile' ? (
            <Profile who={who} sub={profileSub} runs={prog.runs} onGo={go} onReps={goReps} onSignIn={() => setSignInOpen(true)} />
          ) : (
            <LessonPage
              lesson={lesson}
              seed={seed}
              reps={reps}
              coachLive={settings.coachLive}
              runs={runsOf(lesson.id)}
              repsRuns={runsOf(repsRunId(lesson.id))}
              isGuest={!acct}
              onRun={prog.addRun}
              onGo={go}
              onStats={openProfile}
            />
          )}
        </div>
      </main>
      <button className={'about-fab' + (view === 'about' ? ' on' : '')} onClick={openAbout} aria-label="About vimchi">
        <span className="coffee-tip">about vimchi</span>
        <span className="about-fab-mark" aria-hidden="true">?</span>
      </button>
      <a className="coffee" href="https://buymeacoffee.com/kylearrington" target="_blank" rel="noopener noreferrer" aria-label="Buy me a coffee">
        <span className="coffee-tip">buy me a coffee</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z" />
          <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M8 3.5c0 1 .8 1.2.8 2.2S8 6.8 8 7.5M11.5 3.5c0 1 .8 1.2.8 2.2s-.8 1.1-.8 1.8" />
        </svg>
      </a>
      {signInOpen && <SignIn guestRuns={acct ? 0 : prog.runs.length} onClose={closeSignIn} />}
    </div>
  );
}
