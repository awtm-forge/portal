import "./marketing.css";
import { EnquiryForm } from "./EnquiryForm";
import { RotatingWord } from "./RotatingWord";

/**
 * The marketing site, ported from reference/awtm-dummy-site.html in step 1.
 *
 * It is not routed. Rahul decided on 9 Sep 2026 that this host serves the
 * portal and the admin only, so `/` is a way in rather than a public page
 * (ADR 0012). Kept whole, and compiled, so putting it back is one file that
 * renders it and not an archaeology exercise.
 */
export function MarketingSite() {
  return (
    <>
      <nav className="top">
        <a className="lockup" href="#top"><span className="wordmark">awtm forge</span><span className="tag">Built in one piece</span></a>
        <div className="links">
          <a className="hidem" href="#doors">What we do</a>
          <a className="hidem" href="#work">Work</a>
          <a className="hidem" href="#about">About</a>
          <a className="btn solid" href="#start">Start here</a>
        </div>
      </nav>

      <div className="shell" id="top">
        <header className="hero">
          <div className="left">
            <p className="kick">We answer</p>
            <h1>We <RotatingWord /></h1>
            <p className="sub">Storefronts, apps and the systems behind them. From the first build to the month after launch, we are the one team accountable for everything between your product and your customer.</p>
            <div className="ctas">
              <a className="btn solid" href="#start">Start the two weeks</a>
            </div>
            <p className="factline"><b>A fixed price before we start</b> · <b>Paid only when you sign off</b> · <b>A founder runs it start to finish</b></p>
          </div>
          <aside className="offercard">
            <div className="oc-top">
              <span className="oc-name">Start with two weeks</span>
              <span className="oc-price">Fixed fee</span>
            </div>
            <ul>
              <li>We find what is actually costing you sales, and put a number on it you can check.</li>
              <li>We build a working version of the fix. On a real link, yours to keep.</li>
              <li>A fixed price and a fixed start date for the build, held for thirty days.</li>
              <li className="key">Every rupee of it comes off your build price if you go ahead.</li>
            </ul>
            <div className="oc-foot">
              <a className="btn solid" href="#start">Start the two weeks</a>
              <span className="fine">If the fix turns out to be small, we say so, and we do it for what it is worth.</span>
            </div>
          </aside>
        </header>

        <section className="sec" id="doors">
          <p className="kick">What we do</p>
          <h2 className="sec-t">Four doors into the same room.</h2>
          <p className="lead">Most of it starts the same way: growth arriving faster than the setup can take it. Come in for a store, an app, a campaign or a brand. Either way you get the same team, and the pieces arrive already fitting each other.</p>
          <div className="doors">
            <div className="door">
              <span className="d-k">Web development</span>
              <h3>The store</h3>
              <p>Where growth shows up first, and where it breaks first. Storefronts that stay fast when the catalogue grows, checkouts that stop leaking orders, and the connections to payments, couriers and inventory that keep the promise the ad made.</p>
              <p className="adj">Because we also run the marketing, a slow page is never &ldquo;the other team&rsquo;s problem.&rdquo; It is one fault, not two invoices.</p>
            </div>
            <div className="door">
              <span className="d-k">App development</span>
              <h3>The app</h3>
              <p>Repeat purchase lives here, and so does your operation. Customer apps people keep on their phone, internal tools your team actually uses, and the backend both stand on.</p>
              <p className="adj">Built by the same people who built your store, so your app and your site never disagree about stock, price, or who your customer is.</p>
            </div>
            <div className="door">
              <span className="d-k">Marketing</span>
              <h3>The demand</h3>
              <p>Ads, search, email, retention. The team spending your ad money is the team that built the page it lands on. When the numbers dip, nobody blames the website, because we are the website.</p>
              <p className="adj">Reported in your numbers, orders and margin, never in impressions.</p>
            </div>
            <div className="door">
              <span className="d-k">Design</span>
              <h3>The face</h3>
              <p>Brand identity, store and app design, the creative your ads run on. For a brand selling direct, design is why a stranger trusts you enough to type their card number.</p>
              <p className="adj">Designed by the people building the thing, so what you approve is what ships, pixel for pixel.</p>
            </div>
          </div>
          <p className="lead">Custom software and SaaS builds run the same way, as serious projects with the same team and the same contract. If your problem does not fit a box above, that is normal. Most real ones do not.</p>
        </section>

        <section className="sec" id="how">
          <p className="kick">How we work</p>
          <h2 className="sec-t">The same loop, once.</h2>
          <p className="lead">Before we start, we write down together what finished looks like, one deliverable at a time, with how you will check each one. While the build runs, you can open it on a real link whenever you want. At the end you check it against what we wrote. If it holds, you sign off and we invoice the balance. If it does not, we keep working, and we do not invoice.</p>
          <div className="flow">
            <div><span className="n">01</span><div className="t"><h3>Agree the shape</h3><p>One call, then one page: what we are building in your words, each deliverable and how you will check it, what is not included, the dates, the price and how it splits. You read it and you agree to it once, before anything starts. After that, the only thing we ask you to sign is the delivery itself.</p></div></div>
            <div><span className="n">02</span><div className="t"><h3>Something you can open</h3><p>By day ten there is a real link, not a screenshot. It will be rough, and that is the point. You correct us while correcting is still cheap.</p></div></div>
            <div><span className="n">03</span><div className="t"><h3>The build</h3><p>A short written update every week whether or not anything went wrong, and a call every two weeks that either of us can book. You always know what moved, what is next, and what we need from you and by when.</p></div></div>
            <div><span className="n">04</span><div className="t"><h3>Delivery, and the month after</h3><p>You check the work against the page you agreed to. If something is off, you say so in one box and we keep going, as many rounds as it takes. When it holds, you sign off, the balance is invoiced, and either we run it monthly or we hand over with everything documented and every access transferred. Quietly vanishing is not one of the options.</p></div></div>
          </div>
          <div className="proof">
            <div className="fact"><h3>A price, not a rate</h3><p>One number for the whole thing, agreed before anyone starts. No meter running, no surprise at the end.</p></div>
            <div className="fact"><h3>Paid on your sign-off</h3><p>An advance when you agree, the balance when you have signed off the delivery. Nothing in between, and nothing invoiced for work you have not accepted.</p></div>
            <div className="fact"><h3>A founder throughout</h3><p>The person on your first call runs your project to the last invoice. You are never handed to someone you have not met.</p></div>
            <div className="fact"><h3>We do not discount</h3><p>If the budget does not fit, we cut scope and tell you exactly what you are losing. New work gets a new number, agreed before it begins.</p></div>
          </div>
          <p className="guarantee">One team builds it, runs it, and answers for it. The people who built your store are the people who pick up the phone in month six.</p>
        </section>

        <section className="sec" id="work">
          <p className="kick">The work</p>
          <h2 className="sec-t">What we have actually built.</h2>
          <div className="work">
            <div className="case">
              <span className="c-k">In build · launching 31 Oct 2026</span>
              <h3>VRG EV</h3>
              <p>An EV charging and fleet platform: customer and driver apps, charging session billing, and the operations system behind them. The full case study, with what we found and what changed, ships the week it goes live.</p>
            </div>
          </div>
        </section>

        <section className="sec" id="about">
          <p className="kick">About</p>
          <h2 className="sec-t">Two of us, and the team behind us.</h2>
          <div className="people">
            <div className="person">
              <span className="role">Co-founder</span>
              <h3>Rahul</h3>
              <p>Runs product, design and the client&rsquo;s side of the table. On your project from the first call to the last invoice.</p>
            </div>
            <div className="person">
              <span className="role">Co-founder</span>
              <h3>Ayush</h3>
              <p>Runs the build and the delivery team: a designer, two developers, a marketing specialist, and the specialists each project needs.</p>
            </div>
          </div>
          <p className="lead">Whoever does the work, awtm forge answers for it. One contract, one number, one person answering. You never hear that it was the other guy.</p>
        </section>

        <section className="sec" id="faq">
          <p className="kick">Questions</p>
          <h2 className="sec-t">Asked by almost everyone.</h2>
          <div className="faq">
            <details><summary>I don&rsquo;t know what I need. Can you still help?</summary><p>That is the normal case, and it is what the two-week engagement is for. You describe what the business should be doing, we work out what is stopping it. You do not need to arrive with a specification.</p></details>
            <details><summary>What if you tell me I don&rsquo;t need what I came for?</summary><p>Then that is what we tell you. It costs us the bigger project and it is still the right answer. We would rather you spend forty thousand on the thing that works than four lakh on the thing you asked for.</p></details>
            <details><summary>How do I know it will get finished?</summary><p>Before we start, we write down what has to be true for the delivery to be signed off. We do not invoice the balance until you have signed it off. That is in the agreement you read, not just on this page.</p></details>
            <details><summary>You are in India and I am not. How does this work?</summary><p>A weekly working session in your timezone, overlap hours agreed before we start, and everything in writing so nothing depends on catching anyone awake. Gulf clients overlap our full working day; US clients get mornings and our evenings.</p></details>
            <details><summary>What if the problem is in a part a specialist built?</summary><p>Still ours. We chose them, we manage them, and your contract is with us. Fixing it is our job, not a negotiation between vendors you have never met.</p></details>
            <details><summary>Do you work with businesses my size?</summary><p>The smallest thing we sell takes a week. The largest runs for months. Tell us your budget on the first call and we will tell you honestly whether it reaches the thing you need, instead of finding out after three weeks of proposals.</p></details>
            <details><summary>What happens after launch?</summary><p>Either we run it monthly, or we hand it over with everything documented and access transferred. Both are fine. Quietly disappearing is not one of the options.</p></details>
          </div>
        </section>

        <section className="sec" id="start">
          <p className="kick">Start here</p>
          <h2 className="sec-t">Three ways in, depending on how much you already know.</h2>
          <div className="startgrid">
            <div className="ways">
              <div className="way"><h3>You know what is broken</h3><p>Buy the fixed one. One week, one price agreed up front, starts when you say go.</p></div>
              <div className="way"><h3>You know something is broken</h3><p>Take the two weeks. We tell you what it is and what fixing it costs.</p></div>
              <div className="way"><h3>You are not sure yet</h3><p>Tell us what is not working, in your own words. We reply within one working day, and we tell you honestly if this is not for us.</p></div>
              <p className="factline"><b>Current availability</b> · One build slot in November, one in December</p>
            </div>
            <EnquiryForm />
          </div>
        </section>

        <footer className="site">
          <span>awtm forge · Built in one piece</span>
          <span>Bengaluru, Karnataka</span>
          <span>hello@awtmforge.com</span>
          <span>LinkedIn</span>
          <span>Two projects a month</span>
        </footer>
      </div>
    </>
  );
}
