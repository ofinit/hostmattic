# Personal data breach — runbook

What to do when customer personal data has, or may have, been exposed.

This exists because the hard part of a breach is not the decision, it is the
clock. The DPDP Act requires notifying the **Data Protection Board of India**
and **each affected Data Principal**. Working out who was affected while that
clock runs is how deadlines get missed, so step 2 is a script.

**This is an operational runbook, not legal advice.** For anything beyond a
contained, obvious incident, involve a lawyer before notifying.

---

## 0. First: stop the bleeding

Containment comes before notification. A breach still in progress gets worse
while you write emails.

- Revoke or rotate whatever was exposed — `JWT_SECRET`, `RESELLER_API_KEY`,
  database credentials, admin passwords.
- Rotating `JWT_SECRET` signs every existing session out. That is the intended
  effect: if session tokens may have leaked, invalidating them is the point.
- Do **not** delete logs. They are the evidence of what happened and the only
  way to establish scope. Deleting them turns a breach into a breach you
  cannot explain.

Write down the time you became aware. The clock runs from then, not from when
the breach started.

---

## 1. Establish what happened

Answer these before notifying anyone, and write the answers down as you go:

| Question | Why it matters |
| --- | --- |
| What data was involved? | The notification has to say. "Some customer data" is not an answer. |
| How many people? | Decides the scale of the response. |
| When did it start, and has it stopped? | An ongoing breach changes the advice you give people. |
| Was it accessed, or only exposed? | Both are reportable; the distinction belongs in the notification. |
| Could it enable further harm? | Passwords, payment details and registrant data each carry different risk. |

Two things this system does **not** hold, which usually narrows the scope a
lot:

- **No card or bank details.** Payments are taken on the provider's systems.
- **No readable passwords.** They are bcrypt hashes. A hash leak is still
  reportable and still requires a forced reset, but it is not a password leak.

---

## 2. Work out who was affected

```bash
node scripts/breach-scope.js --since 2026-10-01 --until 2026-11-05 --csv affected.csv
node scripts/breach-scope.js --domains example.in,other.co.in
node scripts/breach-scope.js --users someone@example.com
node scripts/breach-scope.js --all            # only if genuinely everyone
```

It is read-only. It prints each affected person, which categories of their
data exist, and — importantly — **who cannot be reached by email** because
their address has previously bounced or complained. Sending a notification to
a dead address does not discharge the duty to inform; those people need a
phone call or a letter.

Scope honestly. Notifying everyone when a subset was affected causes its own
harm and destroys trust in the next notification you send.

The CSV is itself personal data. Keep it where the rest of the customer data
lives, and delete it when the incident closes.

---

## 3. Notify the Board

Report to the Data Protection Board of India in the manner and within the
period the DPDP Rules require. Check the current requirement at the time of
the incident rather than relying on this file — the Rules were notified in
November 2025 and the obligations commence 13 May 2027.

Include: what happened, when, what data, how many people, what you have done
to contain it, and what you are doing to prevent recurrence.

---

## 4. Notify the affected people

Tell each affected person directly. Send it from a real person, not a
no-reply address, and say:

- **what happened**, in plain words;
- **what data of theirs** was involved — specifically, not "personal data";
- **what it means for them** — the part people actually need, and the part most
  breach notifications skip;
- **what you have done** about it;
- **what they should do**, if anything — change a password, watch for phishing
  that uses the leaked details;
- **who to contact** with questions.

Do not minimise, and do not bury it in reassurance. A notification whose main
message is that there is probably nothing to worry about is not a
notification. If passwords were involved, force a reset rather than suggesting
one.

---

## 5. Afterwards

- Record the incident, the scope, what was sent, and when.
- Fix the cause, and log it in `.wolf/buglog.json` with a root cause — not just
  the symptom.
- If the cause was a supplier, raise it with them in writing. Under s.8(1) the
  responsibility to the customer is still ours regardless of who caused it.
- Re-read this runbook and correct whatever was wrong or missing while the
  incident is fresh. The best time to improve it is immediately after using it.
