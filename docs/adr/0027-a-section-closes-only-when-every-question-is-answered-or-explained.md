# 27. A section closes only when every question is answered or explained

Accepted, 16 September 2026. Amends INTAKE-SPEC section 3 (nothing required
but the sign-off fields) and the renderer's rule of 12 September that Next
moves on without marking anything.

## The problem

Ayush: "during filling the questionnaire, client should not be able to move
forward without filling those. if none of the options fits it, they put their
remarks and then can move."

Until now only the two sign-off fields were required. A client could carry on
past a section with half of it blank, and the team found the gaps on a call.
At the same time, a questionnaire generated for one client will always have
an option list that does not fit some other client, and a required choice with
nothing that fits is a trap, not a question.

## The decision

A section cannot be left forward until every question in it is answered. A
question with words in it is answered by its words. A question with options,
a yes or no, or an upload is answered by a choice, a file, or a line in the
client's own words saying why none of that fits; that line lives in the
answer's `note`, which yes-or-no questions already carried, and is shown to
the team beside the answer. "I do not know" is a real answer to any of these,
typed where the words go.

The rule is one function, `isAnswered`, in `modules/intake/answered.ts`, read
by the page before it lets a section close and by the server before it marks
a section done or accepts a sending, so the two cannot disagree. The page
refuses Next, Save and carry on, and a tap on a later section while the open
one is incomplete, marks each missing question, and says how many. The server
refuses the same with the keys, so a page that forgot the rule would still be
held.

Back is always free. A section already answered can be reopened and changed;
the mark that says it is done is unchanged in meaning.

## What it costs

A questionnaire takes longer to send, by design: nothing on it is blank.
The clean way past a question that does not fit is one line, not a skipped
question, and the team reads the line where the answer would be.
