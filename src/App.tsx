import { useCallback, useEffect, useRef, useState } from 'react';
import { LessonPage } from './components/LessonPage';
import { Profile } from './components/Profile';
import { Sidebar } from './components/Sidebar';
import { SignIn } from './components/SignIn';
import type { Who } from './components/Avatar';
import { COUNTED, LESSONS, ORDER } from './lessons';
import { lessonIdFromHash, seedFromHash } from './state/seed';
import { useProgress } from './state/store';

function lessonFromHash() {
  const id = lessonIdFromHash(location.hash);
  return LESSONS[id] ? id : '';
}

export function App() {
  const prog = useProgress();
  const [lessonId, setLessonId] = useState(() => lessonFromHash() || (LESSONS[prog.lesson] ? prog.lesson : ORDER[0].id));
  const [view, setView] = useState<'lesson' | 'profile'>('lesson');
  // A generated challenge's seed from the URL (`#id?seed=N`); null means a fresh random one.
  const [seed, setSeed] = useState<number | null>(() => seedFromHash(location.hash));
  const [signInOpen, setSignInOpen] = useState(false);
  const main = useRef<HTMLElement>(null);

  const go = (id: string) => {
    setLessonId(id);
    setView('lesson');
    prog.setLesson(id);
    setSeed(null);
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    main.current?.scrollTo(0, 0);
  };
  // Back/forward and typed URLs.
  useEffect(() => {
    const onHash = () => {
      const id = lessonFromHash();
      setSeed(seedFromHash(location.hash));
      if (id) {
        setLessonId(id);
        setView('lesson');
        main.current?.scrollTo(0, 0);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const openProfile = () => {
    setView('profile');
    main.current?.scrollTo(0, 0);
  };
  const closeSignIn = useCallback(() => setSignInOpen(false), []);

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

  return (
    <div className="app">
      <Sidebar
        activeLesson={view === 'lesson' ? lessonId : null}
        runsOf={runsOf}
        completedText={`${done} of ${COUNTED.length} done`}
        profileOn={view === 'profile'}
        who={who}
        userSub={userSub}
        onLesson={go}
        onProfile={openProfile}
        onSignIn={() => setSignInOpen(true)}
        onSignOut={prog.signOut}
      />
      <main ref={main} className="main">
        <div className="page">
          {prog.syncError && <p className="sync-err">{prog.syncError}</p>}
          {view === 'profile' ? (
            <Profile who={who} sub={profileSub} runs={prog.runs} onGo={go} onSignIn={() => setSignInOpen(true)} />
          ) : (
            <LessonPage
              key={lesson.id}
              lesson={lesson}
              seed={seed}
              runs={runsOf(lesson.id)}
              isGuest={!acct}
              onRun={prog.addRun}
              onGo={go}
              onStats={openProfile}
            />
          )}
        </div>
      </main>
      {signInOpen && <SignIn guestRuns={acct ? 0 : prog.runs.length} onClose={closeSignIn} />}
    </div>
  );
}
