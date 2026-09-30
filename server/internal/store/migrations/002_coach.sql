-- Coach memory: where a run's keys went, and one row per critique the coach made.
-- Patterns and counts only; no keys or buffer text are stored.
ALTER TABLE runs ADD COLUMN moving INTEGER; -- NULL: the run was not coached
ALTER TABLE runs ADD COLUMN typing INTEGER;
ALTER TABLE runs ADD COLUMN editing INTEGER;

CREATE TABLE coach_events (
    id      INTEGER PRIMARY KEY,
    run_id  INTEGER NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    pattern TEXT    NOT NULL,
    lesson  TEXT    NOT NULL,
    unit    INTEGER NOT NULL,
    you     INTEGER NOT NULL, -- keys the learner spent
    better  INTEGER NOT NULL, -- keys the better way takes
    used    TEXT    NOT NULL, -- bucketed label of what the learner did
    at      INTEGER NOT NULL  -- unix ms
);

CREATE INDEX coach_events_run ON coach_events (run_id);
