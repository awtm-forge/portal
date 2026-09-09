# Sequences

Drafted 7 Sep 2026, diagram 1 redrawn 10 Sep 2026. The four interactions where ordering matters. Each diagram is the contract the tests check; if the code does it in a different order, the code is wrong.

## 1. First visit: link and one-time code (the link is the client's, ADR 0015)

```mermaid
sequenceDiagram
  autonumber
  actor C as Client
  participant App as Portal route /p/[token]
  participant Auth as modules/auth
  participant DB as MySQL
  participant Mail as Mailer

  C->>App: GET /p/{token}
  App->>Auth: resolve(token)
  Auth->>Auth: hash token, constant-time compare
  Auth->>DB: find client by access_token_hash
  DB-->>Auth: client or nothing
  alt no client
    App-->>C: 404, no hint that the route exists
  else no valid client_session cookie
    Auth->>DB: rate-limit check per token and IP
    Auth->>DB: insert one_time_code (hash, purpose login, expires 10 min, attempts 0)
    Auth->>Mail: send code to client.contact_email
    App-->>C: "We sent a code to the address on file"
    C->>App: POST code
    App->>Auth: verify(token, code)
    Auth->>DB: load latest unused code, attempts < 5, not expired
    alt code matches
      Auth->>DB: mark used_at, insert client_session (30 days), write activity_event
      App-->>C: Set-Cookie httpOnly secure sameSite=lax, redirect to the client's page
    else wrong
      Auth->>DB: attempts + 1
      App-->>C: "That code did not match", attempts left
    end
  else valid session
    App-->>C: the questionnaire until a project exists, then the live project for its phase
  end
```

Rules made visible here: the token is never stored, only its hash; a wrong token and a missing client look identical from outside; the code is single use and dies after five attempts or ten minutes; a valid session lets the client view, never sign.

## 2. Agreement sign-off, advance invoice, notification

```mermaid
sequenceDiagram
  autonumber
  actor C as Client
  participant App as /p/[token]/agreement
  participant Auth as modules/auth
  participant Agr as modules/agreements
  participant Ph as modules/projects/phase
  participant Inv as modules/invoices
  participant DB as MySQL
  participant Ev as activity_event dispatcher

  C->>App: tap "I agree"
  App->>Auth: request fresh code (purpose agreement)
  Auth-->>C: code by email
  C->>App: POST code
  App->>Auth: verify (single use, purpose must match)
  Auth-->>App: ok
  App->>Agr: agree(project, actor name, ip, user agent)
  Agr->>DB: BEGIN
  Agr->>DB: insert signoff_event (kind agreement, method portal, version)
  Agr->>DB: set agreement.agreed_at, agreed_by_name, agreed_method
  Agr->>Ph: transition(agreement_sent -> agreed)
  Ph->>DB: update project.phase
  Ph->>Inv: on agreed: issue advance
  Inv->>DB: SELECT invoice_sequence FOR UPDATE (prefix, FY of today in Asia/Kolkata)
  Inv->>DB: last_seq + 1, insert invoice (kind advance, total x advance_pct)
  Agr->>DB: COMMIT
  Agr->>Ev: emit agreement.agreed, invoice.issued
  Ev->>Ev: serialize for client view first (strips internal cost)
  Ev-->>C: nothing automatic on WhatsApp, admin gets the prefilled link
  Ev->>Ev: email team: "Agreed by [name], advance invoice [number]"
  App-->>C: agreement page, frozen, stamped "agreed by [name] on [date]"
```

If anything between BEGIN and COMMIT fails, nothing is written: no sign-off without an invoice, no invoice without a sign-off, no number consumed without an invoice.

## 3. Review loop and delivery

```mermaid
sequenceDiagram
  autonumber
  actor T as Team
  actor C as Client
  participant Adm as /admin
  participant Rev as modules/review
  participant Ph as modules/projects/phase
  participant Inv as modules/invoices
  participant DB as MySQL
  participant Ev as dispatcher

  T->>Adm: mark ready, staging link
  Adm->>Rev: openRound(project)
  Rev->>DB: insert review_round (round n, outcome open)
  Rev->>Ph: transition(building -> in_review)
  Rev->>Ev: emit review.opened (WhatsApp prefilled link for team)

  loop until accepted
    C->>Rev: "what is off" text
    Rev->>DB: set client_note, responded_at, outcome changes_requested
    Rev->>Ph: transition(in_review -> building)
    Rev->>Ev: emit review.changes_requested (team email)
    T->>Adm: fix, mark ready again
    Adm->>Rev: openRound (round n+1)
  end

  C->>Rev: "It holds. Sign off the delivery" + fresh code
  Rev->>DB: BEGIN
  Rev->>DB: insert signoff_event (kind delivery)
  Rev->>DB: round outcome accepted, project.delivered_at
  Rev->>Ph: transition(in_review -> delivered)
  Ph->>Inv: issue balance (total minus advance)
  Ph->>DB: insert day30 (unlocks_at = delivered_at + 30 days)
  Ph->>DB: retainer record or handover checklist per after_delivery
  Rev->>DB: COMMIT
  Rev->>Ev: emit delivery.signed_off, invoice.issued
  Rev-->>C: redirect once to /p/[token]/thanks
  C->>Rev: optional quote, optional referral, or skip
  Rev->>DB: insert testimonial (moment delivery, status draft), referral
  Rev->>Ev: emit thanks.sent
```

Every round is kept. Nothing on the review page can delete or edit an earlier round.

## 4. Invoice numbering under concurrency

```mermaid
sequenceDiagram
  autonumber
  participant A as Request A (advance, project 1)
  participant B as Request B (balance, project 2)
  participant DB as MySQL, InnoDB

  A->>DB: BEGIN
  B->>DB: BEGIN
  A->>DB: SELECT last_seq FROM invoice_sequence WHERE prefix='AWTM' AND fy='26-27' FOR UPDATE
  B->>DB: SELECT ... FOR UPDATE (blocks behind A)
  A->>DB: UPDATE last_seq = 7, INSERT invoice number AWTM/26-27/007
  A->>DB: COMMIT
  DB-->>B: lock released, sees last_seq = 7
  B->>DB: UPDATE last_seq = 8, INSERT invoice number AWTM/26-27/008
  B->>DB: COMMIT
```

The financial year is computed once, in Asia/Kolkata, from the issuing moment; 1 April starts a new `(prefix, fy)` row at 0, so the first invoice of the year is 001. A rolled-back transaction leaves `last_seq` untouched, which is what makes "never skipped" true. The test issues twenty invoices in parallel and asserts twenty consecutive numbers.
