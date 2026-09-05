# awtm forge Intake: the questionnaire

The first thing a client does after logging in, and the input to everything after it. This file is the complete specification for the questionnaire alone. It is referenced from PORTAL-SPEC.md and supersedes §6.2 there.

Version 2, 5 Sep 2026. Supersedes version 1, which assumed hand-edited templates.

---

## 1. What it is for

Enough to write the scope, the timeline and the budget without a second call, and enough to run the kickoff without asking anything the client has already told us. It is not a survey and it is not a contract. It is the brief, written by the client, in a shape we can work from.

Three answers matter more than all the others: what made them call, what they have already tried, and what is different on a normal Tuesday once it is fixed. Those three go into the deliverables document almost unchanged. Every questionnaire asks them in some form.

---

## 2. How a questionnaire comes to exist

**The questionnaire is a document, not a form configuration.** It is written for one client, once, and it does not need an editor.

The workflow is the one already in use:

1. After the discovery call, Rahul writes a short **problem statement** for the client: who they are, what they said, what type of work it is, what we still need to learn. A few lines, in his words.
2. Claude turns that into a **questionnaire document** in the format in §5, starting from the examples in §7 and §8 and adjusting to the client.
3. Rahul reviews it as readable text, never as JSON, asks for changes, and Claude revises. This happens in conversation, the same way this spec was made. Rahul says "final" and only then does the JSON exist.
4. Before handing over the file, Claude checks it against every importer rule in §5 itself, so an upload never fails on something that could have been caught. The finished document is **uploaded to the project in admin**. The portal checks it again, and if it passes, the client can open it.
5. The client answers. Answers come back as a document in the same shape (§6), which is what Claude works from to draft the scope.

What this removes from the build: the template editor, template versioning, per-project question hiding, the snapshot logic. What it adds: an import step with strict validation, and a small image library. Net effect is a smaller build, and a questionnaire that fits each client because a person and a model wrote it for them.

**What the portal does not do:** it does not generate questionnaires. Generation happens in conversation with Claude, outside the portal, for now. A "generate from problem statement" button inside admin is a natural second phase (§15) and is not part of this build.

**Alternative considered and rejected:** generating the form as a Jotform or Tally and linking to it from the portal. Zero build, but the answers leave the system, the client lands on a page that does not look like awtm forge, and "one home per fact" breaks on the first project. Not worth it.

---

## 3. Field types

Eight, and no more. Every question is exactly one of these. This is the vocabulary Claude writes in and the portal renders.

| Type | What the client sees | Stored as |
|---|---|---|
| `short_text` | One line | string |
| `long_text` | A paragraph box | string |
| `yes_no` | Two buttons, with an optional "say more" line | bool, string |
| `pick_one` | Radio list of text options | option id |
| `pick_many` | Checklist of text options | option ids |
| `link` | A URL field, validated as a URL, shown as a clickable link on the admin side | string |
| `upload` | Drop zone, camera on mobile. Images and PDFs. | file ids |
| `image_choice` | A grid of pictures, pick one or several. Pictures come from the image library (§9). | option ids |

`image_choice` exists because of brand work: "which of these six directions feels closest?" with a picture of each. It is also the right type for "which of these layouts" in web work.

**Not field types, on purpose:** conditional logic (show question 7 only if question 6 is yes), matrices, ratings, signatures, payment. If a client needs different questions, Claude writes them a different questionnaire. A condition is never the answer.

---

## 4. Uploads

The client can attach photos and documents. This reverses the earlier no-uploads rule, because a brand questionnaire without "here is our current logo and three photos of our packaging" is meaningfully worse.

- Accepted: `jpg`, `png`, `webp`, `heic` (converted to jpg on receipt), `pdf`, `svg`. Nothing else, checked by magic bytes, not by extension.
- Limits: 10 MB per file, 10 files per question. Enough for photos and reference PDFs, not enough to become a file share.
- Storage: on the Hostinger disk, outside the web root, under a per-project directory with random filenames. Never served by a public URL. Served only through an authenticated route that checks the viewer is either the team or the holder of that project's link.
- Images are re-encoded on receipt and EXIF is stripped. SVGs are sanitised (scripts and external references removed) before they are shown to anyone, including the team.
- There is no virus scanner on shared hosting. Mitigation is the above: strict types, re-encoding, never executed, never served inline with a guessed content type.
- Expected volume: under 50 MB per project. Not a capacity concern.

**The rule that survives everything:** an `upload` question in the access section fails import. Nobody can ship a question that invites a screenshot of a password. This is enforced by the importer, not left to judgement.

---

## 5. The questionnaire document

This is the contract between whoever writes the questionnaire and the portal that renders it. JSON, one file per project.

```json
{
  "version": 1,
  "title": "Before we start",
  "intro": "Five short sections, about ten minutes. It saves as you type, so you can leave and come back. I do not know is a real answer to any of these.",
  "sections": [
    {
      "key": "business",
      "title": "Your business",
      "questions": [
        { "key": "biz_what", "type": "short_text",
          "text": "What does your business sell, in one line?" },
        { "key": "biz_where", "type": "pick_many",
          "text": "Where do you sell today?",
          "options": [
            { "id": "own_site", "label": "Own website" },
            { "id": "amazon", "label": "Amazon" },
            { "id": "other", "label": "Somewhere else" }
          ] }
      ]
    },
    {
      "key": "brand",
      "title": "What it should say, and where it will live",
      "questions": [
        { "key": "br_direction", "type": "image_choice",
          "text": "Which of these feels closest?",
          "max_choices": 2,
          "options": [
            { "id": "wordmark", "label": "Wordmark", "image": "logo-wordmark" },
            { "id": "monogram", "label": "Monogram", "image": "logo-monogram" }
          ] },
        { "key": "br_existing", "type": "upload",
          "text": "Is there an existing logo?",
          "help": "Whatever you have, in any format.",
          "max_files": 5 }
      ]
    },
    {
      "key": "access",
      "title": "Access, and who decides",
      "access_items": [
        { "key": "brand_folder", "label": "Brand files folder",
          "help": "A shared folder link with everything you have." }
      ],
      "questions": [
        { "key": "dec_signoff_name", "type": "short_text", "required": true,
          "text": "Who says yes on behalf of the business?" },
        { "key": "dec_signoff_email", "type": "short_text", "required": true,
          "text": "Their email" }
      ]
    }
  ]
}
```

**Rules the importer enforces.** A document that breaks any of these is rejected with a message naming the rule and the question key, and nothing is saved.

- `version` is 1.
- Every `key` is unique across the document, lowercase, letters, digits and underscores only.
- Every question `type` is one of the eight in §3.
- `pick_one`, `pick_many` and `image_choice` have at least two options with unique `id`s.
- Every `image_choice` option's `image` names an existing key in the image library (§9).
- `upload` has `max_files` between 1 and 10.
- Exactly one section has `access_items`. That section contains no `upload` question and no `required` question other than the two below.
- `dec_signoff_name` and `dec_signoff_email` exist, are `short_text`, and are `required`. They seed the sign-off person on the project and the email the six-digit code goes to.
- No more than 60 questions in total. A questionnaire longer than that is a sign the problem statement was a wish list.
- `text` is present on every question; `help` is optional.

**Rules the importer does not enforce, on purpose:** wording, order, which questions are asked. Those are editorial and belong to the conversation that produced the document.

---

## 6. The answers document

Answers come back in the same spirit: one JSON document per project, keyed by question key, ready to hand to Claude for the scope draft or to read as a page in admin.

```json
{
  "questionnaire_version": 1,
  "project": "kavya-appliances-store",
  "submitted_at": "2026-08-17T14:22:00+05:30",
  "answers": {
    "biz_what": { "value": "Small kitchen appliances.", "entered_by": "client", "at": "2026-08-17T14:05:11+05:30" },
    "biz_where": { "value": ["own_site", "amazon"], "entered_by": "client", "at": "..." },
    "br_direction": { "value": ["wordmark"], "entered_by": "client", "at": "..." },
    "br_existing": { "files": ["f_8a2c...", "f_91d0..."], "entered_by": "client", "at": "..." },
    "st_tuesday": { "value": "Fewer where-is-my-order messages.", "entered_by": "team", "at": "..." }
  },
  "access_granted": { "brand_folder": true, "domain_dns": false }
}
```

`entered_by` is per answer. A questionnaire the client filled and one you typed from a call are distinguishable forever, and a mix of both is normal.

Admin can download this document, and the scope-drafting step reads it.

---

## 7. The core sections, as a starting point

These appear in every generated questionnaire unless there is a reason not to. Claude starts from these and adjusts wording to the client; the keys stay stable so answers can be compared across projects.

### Section 1: Your business

| Id | Question | Type | Notes |
|---|---|---|---|
| biz_what | What does your business sell, in one line? | short_text | |
| biz_where | Where do you sell today? | pick_many | Own website · Amazon · Flipkart · Instagram or WhatsApp · Physical stores · Somewhere else |
| biz_volume | Roughly how many orders a month? | pick_one | Under 100 · 100 to 500 · 500 to 2,000 · 2,000 to 10,000 · More than that · I would rather say on a call |
| biz_traffic | Where does most of your traffic or footfall come from? | long_text | Help: ads, search, word of mouth, marketplaces, a physical shop. Rough is fine. |
| biz_customer | Who is your customer, in a sentence? | long_text | Help: who they are, not who you wish they were. |

### Who decides (second-to-last)

| Id | Question | Type | Notes |
|---|---|---|---|
| dec_signoff_name | Who says yes on behalf of the business? | short_text | Seeds the sign-off person on the project. Required. |
| dec_signoff_email | Their email | short_text | Validated. Required. This is where the six-digit code goes. |
| dec_others | Who else needs to see the work before you say yes? | long_text | Help: a partner, a brother who runs the ads, an investor. Better we know now. |
| dec_calendar | Anything in the next eight weeks we should build around? | long_text | Help: a sale, a launch, a festival, stock arriving. Dates if you have them. |
| dec_channel | For quick things, how do you prefer we reach you? | pick_one | WhatsApp · A call · Email |

### Access (last)

The access section is a checklist, not questions. Each item is something the client grants from inside their own account and ticks when done. Which items appear depends on the template (§7). The section always carries this text, verbatim, above the list:

> Add us as a user. Never send a password.
> Every line below is something you grant from inside your own account, and can remove the day we finish. If you are not sure how on any of them, leave it and we will do it together on the kickoff call.
> Never type a password, an API key or an OTP into this page, into WhatsApp, or into an email to us. There is no box here that wants one.

And this line below it:

> Anything still unticked on [kickoff date] pauses the clock, and we will say so in writing rather than quietly slipping.

Stored as booleans only. No free text in this section. No upload field in this section, enforced by the editor.

---

## 8. Worked examples by type of work

Five examples, one per way in. These are the reference Claude generates from, not runtime templates. A real questionnaire for a real client will look like one of these with the wording, the options and a few of the questions changed to fit what was said on the call.

### Store: What is going wrong, and what you are running on

| Id | Question | Type | Notes |
|---|---|---|---|
| st_why | What made you get in touch? In your words. | long_text | Help: do not tidy it up for us. The messy version is the useful one. |
| st_tried | What have you already tried, and who has touched it before? | long_text | |
| st_tuesday | If this were fixed, what is different on a normal Tuesday? | long_text | Help: fewer support messages, fewer refunds, one less thing you check at night. |
| st_platform | Your store runs on | pick_one | Shopify · WooCommerce · Magento · Something custom · I do not know |
| st_gateway | Payments go through | pick_many | Razorpay · PayU · Cashfree · PhonePe · Paytm · Something else · I do not know |
| st_courier | Shipping goes through | pick_many | Shiprocket · Delhivery · Blue Dart · Our own arrangement · Something else |
| st_ads | Do you run ads today? | pick_many | Meta · Google · Neither · Somewhere else |
| st_url | Your store's address | link | |
| st_annoy | Screenshots of anything that annoys you about it | upload | Help: on your phone, the way a customer sees it. Up to ten. |
| st_admire | Two or three stores you think get it right, and one line on why | long_text | |

Access items: Store platform staff account · Domain and DNS · Payment gateway, dashboard view only · Courier account invite · Analytics and ads, agency access · Brand files folder

### App: What the app is for, and what it talks to

| Id | Question | Type | Notes |
|---|---|---|---|
| ap_why | What should the app do that your website or WhatsApp cannot? | long_text | |
| ap_who | Who opens it? | pick_many | Customers · Your team · Drivers or field staff · Partners or vendors |
| ap_platforms | Where does it need to run? | pick_many | Android · iPhone · Both · Not sure yet |
| ap_existing | Is there an existing app? | link | Help: the store listing, if it is live. |
| ap_talks_to | What does it need to talk to? | pick_many | Our store · Inventory or stock · Payments · A CRM · Something else |
| ap_talks_note | Anything about that worth knowing | long_text | |
| ap_offline | Does it need to work with poor signal or no signal? | yes_no | Help: warehouses, delivery routes, basements. Say more if yes. |
| ap_admire | Three apps you like using, and one thing each does well | long_text | |
| ap_refs | Sketches, screenshots or references | upload | |
| ap_failure | What would make this a failure six months after launch? | long_text | Help: the honest version. |

Access items: Play Console and App Store Connect, invite as a user · Existing code, repository invite · Backend or API documentation link · Brand files folder

### SaaS: What it does, who uses it first, what must exist on day one

| Id | Question | Type | Notes |
|---|---|---|---|
| sa_what | In one line, what does it do and for whom? | short_text | |
| sa_kind | Is this something you use, something you sell, or both? | pick_one | An internal tool · A product we sell · Both |
| sa_first_users | Who are the first ten users? Name them if you can. | long_text | Help: real people. If you cannot name ten, that is worth knowing too. |
| sa_day_one | What must exist on day one? | long_text | |
| sa_can_wait | What can wait until it is working? | long_text | |
| sa_pay | How do users pay, if they pay? | pick_one | Subscription · One-time · Free · Not decided |
| sa_integrations | Anything it must connect to? | long_text | |
| sa_sensitive | Will it hold any of these? | pick_many | Personal data · Payment details · Health data · Anything regulated · None of these · Not sure |
| sa_refs | Products that do part of this well | long_text | Help: links welcome. |
| sa_docs | Wireframes, documents, decks, if any | upload | |
| sa_failure | What would make this a failure six months after launch? | long_text | |

Access items: Cloud account invite, if one exists · Repository invite · Existing documents folder · Domain and DNS

### Marketing: What you sell most, what you watch, what has worked

| Id | Question | Type | Notes |
|---|---|---|---|
| mk_sell | What sells most today, and what do you want to sell more of? | long_text | |
| mk_spend | Monthly ad spend today, roughly | pick_one | Nothing yet · Under 50,000 · 50,000 to 2 lakh · 2 to 10 lakh · More · I would rather say on a call |
| mk_where | Where do you run ads now? | pick_many | Meta · Google · Marketplaces · Influencers · Nowhere yet |
| mk_metric | What is the one number you watch? | short_text | Help: orders, revenue, return on ad spend, leads. |
| mk_metric_now | And what is it today? | short_text | Seeds the metric baseline on the project. |
| mk_customer | Who is your customer, and where do they spend time online? | long_text | |
| mk_worked | What has worked before, and what has not? | long_text | |
| mk_assets | Brand guidelines, past creatives, product photos | upload | |
| mk_competitors | Competitors whose marketing you notice | long_text | |
| mk_calendar | Offers, launches or seasons coming up | long_text | Help: with dates. |

Access items: Meta Business Manager, partner access · Google Ads, manager account link · Analytics · Store, for the pixel and the product feed · Brand files folder

### Brand: What it should say, and where it will live

| Id | Question | Type | Notes |
|---|---|---|---|
| br_line | Your business in one line | short_text | |
| br_tagline | And the tagline, if there is one | short_text | |
| br_customer | Who buys from you, and what would they tell a friend about you? | long_text | |
| br_feel | Five words the brand should feel like | short_text | |
| br_never | Three words it must never feel like | short_text | |
| br_admire | Three brands whose look you admire, and one line each on why | long_text | |
| br_dislike | Three you cannot stand, same | long_text | |
| br_direction | Which of these feels closest? | image_choice | Six pictures: wordmark, monogram, emblem, mascot, abstract mark, combination. Pick one or two. |
| br_where | Where will it live? | pick_many | Packaging · App icon · Storefront sign · Website header · WhatsApp and social profiles · Print · Vehicles |
| br_existing | Is there an existing logo? | upload | Help: whatever you have, in any format. |
| br_keep | Should anything from it survive? | yes_no | Say more if yes. |
| br_colours | Colours you are drawn to, and colours that are off-limits | long_text | Help: a reason helps, if there is one. |
| br_competitors | Your closest competitors, so we do not end up looking like them | long_text | Help: links welcome. |
| br_tied | Anything it is tied to? | long_text | Help: a launch, a festival, a packaging print run. With the date. |

Access items: Brand files folder · Existing source files, if any (AI, SVG, PSD) · Domain and DNS, only if a website is part of it

---

## 9. The image library

`image_choice` needs pictures, and a JSON document cannot carry them. So the portal keeps a small library: images uploaded once in admin, each with a key, reusable across every questionnaire.

- Admin uploads an image and gives it a key (`logo-wordmark`, `layout-grid`, `palette-warm`). Same file rules as §4.
- A questionnaire references the key. Import fails if the key does not exist, so the library is filled before the document is uploaded, not after.
- Seed it with the six logo directions (wordmark, monogram, emblem, mascot, abstract mark, combination), drawn in-house so they match the brand rather than looking like stock.
- Expected size: a few dozen images, ever.

---

## 10. Admin: import and view. No editing.

**Import.** A project has an "Upload questionnaire" action. Paste JSON or choose a file. The importer runs the rules in §5 and either saves and shows a preview, or shows every rule that failed with the offending key. A project can have its questionnaire replaced until the client has answered anything; after that, replacing it requires confirming that existing answers to removed keys will be kept but hidden.

**View.** The same "What they told us" page as before: every question with its answer, uploads as thumbnails that open in a viewer, links clickable, unanswered questions marked, which sections are complete, a nudge button that opens WhatsApp prefilled, and a "type their answers" mode for when you took them on a call, which sets `entered_by` to `team` on those answers.

**No editing in the portal. None.** Not a typo, not a label, not hiding a question. The questionnaire has one source of truth, the conversation that produced it, and a second place to change it would split that. Any change, however small, is a revised document, finalised in conversation and uploaded again. Rule 13.8 makes that safe: nothing a client has already answered is lost.

**What admin cannot do:** create or alter a questionnaire inside the portal. There is no blank form, no question palette, no edit control on any question. The document comes from outside, whole.

---

## 11. What the client sees, and the rule that governs it

**The client is never shown more than one thing to do.** This is a hard rule for the whole portal and the intake is where it is tested first, because it is the busiest page a client will see.

- No navigation, no sidebar, no tabs, no menu. The page is one column.
- One section is open at a time. The rest are collapsed to a title and a state: done, now, or later.
- A progress line and a "last saved" line at the top, and nothing else at the top.
- One button, at the bottom of the open section: "Save and carry on", or "Finish and send" on the last section.
- Help text appears under a question only when it is needed to answer it. No tooltips, no info icons.
- The three standing lines appear once each, in plain text: that it saves as they type, that "I do not know" is a real answer, and the rule about never typing a password.
- Uploads open the camera on a phone. Image choice is a grid of pictures with the caption beneath, tap to select.
- If the client has already submitted, the page shows their answers read-only with a single line: "You can still change any answer. Tap it." Tapping reopens that one field.

A client should be able to describe the page afterwards as "a form that saved itself." If they can describe it as anything more than that, it is too complicated.

---

## 12. Data model

Replaces the `intake` tables in PORTAL-SPEC.md.

```
intake                       -- one per project
  id, project_id
  document                   -- json, the questionnaire as imported (§5)
  document_uploaded_at
  document_uploaded_by       -- team member id
  hidden_question_keys       -- json: [key], set only when a replacement document drops a key
  answers                    -- json: { key: { value | files, entered_by, at } }
  access_granted             -- json: { key: bool }
  submitted_at               -- null while in progress
  last_saved_at

intake_file
  id, project_id, question_key
  stored_path                -- outside web root, random name
  original_name, mime_type, size_bytes
  uploaded_at

image_library
  id, key, stored_path, caption, uploaded_at
```

Three tables. No templates, no template versions, no question rows.

---

## 13. Business rules

**13.1** Saving is continuous. Every field change writes immediately. There is a submit button, and nothing depends on it being pressed except the gate in 13.3.

**13.2** The questionnaire document is validated on import against every rule in §5. A failing document saves nothing.

**13.3** The deliverables document (scope, timeline, budget) cannot be marked ready for the client until the questionnaire is submitted. Admin can override; the override records who and when.

**13.4** `dec_signoff_name` and `dec_signoff_email` are the only required fields, because the six-digit code depends on them. Everything else is optional. The page says plainly that "I do not know" is a real answer.

**13.5** The access section stores booleans only. No text, no uploads, no required flags beyond the two sign-off fields. Enforced at import and in the save handler.

**13.6** Uploads are validated by magic bytes, re-encoded, EXIF stripped, SVGs sanitised, stored outside the web root, served only through an authenticated route.

**13.7** `entered_by` is recorded per answer.

**13.8** Replacing a document after answers exist keeps every existing answer and hides those whose keys no longer appear. Nothing a client typed is ever discarded.

---

## 14. Acceptance criteria

1. Type an answer, close the tab, reopen the link on a different device after entering the code, the answer is there.
2. Upload a document with a duplicate key; import fails naming the key. Upload one with an `upload` question in the access section; import fails naming the rule.
3. Upload a document referencing an image key not in the library; import fails naming the key.
4. Upload a `.exe` renamed to `.jpg`; refused. Upload a real `.jpg` with GPS EXIF; the stored file has no EXIF.
5. Upload an SVG containing a `<script>` tag; the stored file has none.
6. Request an uploaded file by guessing its URL without the project's link or a team session; 404.
7. Try to mark the deliverables document ready with an unsubmitted questionnaire; blocked, with an override that records the admin's identity.
8. Answer a question as the team on behalf of the client; `entered_by` for that key reads `team`.
9. An `image_choice` question shows its pictures from the library and stores the chosen option ids.
10. Every question in every example in §8 renders and is answerable on a 375px screen without horizontal scrolling.
11. Replace a questionnaire after three answers exist; the three answers are still in the answers document, and the ones whose keys vanished are marked hidden.
12. There is no control anywhere in admin that changes a question's text, options, order or visibility. The only ways a questionnaire changes are upload and replace.
13. With the page open on a phone, the only interactive elements above the fold are the open section's fields and one button.

---

## 15. Phase 2: generate inside the portal

Not part of this build. Noted so the shape is agreed.

A "Generate questionnaire" action on the project: admin pastes the problem statement, the portal calls the Claude API with the schema in §5 and the examples in §7 and §8 as reference, and shows the result as a draft for review before it can be uploaded. Costs a few rupees per call. Needs an API key stored server-side in the portal's own configuration, which is the team's secret and not a client's, so it does not fall under the no-client-secrets rule. Worth building once the manual loop has produced five or six questionnaires and the examples have been refined against real clients.

---

## 16. Open questions

- The examples in §7 and §8 are drafted for direct-to-consumer ecommerce and its neighbours. They should be read against one real client of each type before they are treated as the reference set.
- The problem statement has a fixed shape, because with no editing in the portal, consistency of the input is what keeps the output consistent: client and business, type of work, what they said on the call in their words, what we still need to learn, anything unusual. Five lines. Claude asks for a missing part before generating rather than guessing it.
- Whether the six `br_direction` images are drawn in-house (recommended) or sourced.
- HEIC conversion needs a library that may not be available on Hostinger's Node environment. If it is not, refuse HEIC with a message asking for a JPG rather than building a converter.
