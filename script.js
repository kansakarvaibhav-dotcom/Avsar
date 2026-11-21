"use strict";
/* ============ 1. DATA (demo records only) ============ */
const CATS = ["Scholarship", "Internship", "Government Scheme", "Skills", "Job", "Apprenticeship", "Fellowship"];
const op = (id, title, category, provider, sourceType, url, benefit, description, eligibility, documents, tags) => ({
  id, title, category, provider, sourceType, officialUrl: url, sourceUrl: url, description, benefit,
  deadline: null, openingDate: "", status: "open", eligibility, documents,
  verificationStatus: sourceType === "Official" ? "Official portal link — rules not checked by Avsar" : "Third-party platform — rules not checked by Avsar", lastVerified: null, tags
});
const ALL = ["Class 12", "Diploma", "Undergraduate", "Postgraduate"];
// Real portals. Rules and dates change by scheme and year, so Avsar lists only broad criteria and links to the source.
const DATA = [
  op("nsp", "National Scholarship Portal", "Scholarship", "Government of India", "Official", "https://scholarships.gov.in", "Central and state scholarships in one place", "Apply here for many central and state scholarships. Each scheme has its own income, course and marks limits.", { education: ALL }, ["Academic marksheet", "Income certificate", "College ID", "Bank account proof"], ["social impact", "government"]),
  op("buddy4study", "Buddy4Study Scholarships", "Scholarship", "Buddy4Study", "Third-party", "https://www.buddy4study.com", "Government, corporate and foundation scholarships", "A private platform that lists scholarships from many providers. Always confirm details with the scholarship provider.", { education: ALL }, ["Academic marksheet", "Income certificate", "College ID"], ["social impact"]),
  op("myscheme", "myScheme", "Government Scheme", "Government of India", "Official", "https://www.myscheme.gov.in", "Find central and state schemes you may qualify for", "The national scheme finder. Answer a few questions and it lists government schemes that may suit you.", {}, ["Education certificate", "Income certificate"], ["government", "social impact"]),
  op("pmis", "PM Internship Scheme", "Internship", "Ministry of Corporate Affairs", "Official", "https://pminternship.mca.gov.in", "Paid internship with a monthly stipend", "Government internship programme with partner companies. Early coverage listed ages 21–24, and eligibility has been expanding, so check the portal.", { minAge: 21, maxAge: 24 }, ["Aadhaar-linked e-KYC", "Educational certificates", "Passport-size photo"], ["government", "technology", "business"]),
  op("internshala", "Internshala Internships", "Internship", "Internshala", "Third-party", "https://internshala.com", "Internships and fresher jobs across fields", "A private platform for internships and entry-level jobs. Each listing sets its own requirements.", { education: ["Diploma", "Undergraduate", "Postgraduate"] }, ["Resume", "College ID"], ["technology", "software development", "business", "design", "finance"]),
  op("skillindia", "Skill India Digital Hub", "Skills", "Skill India (MSDE)", "Official", "https://www.skillindiadigital.gov.in", "Free and paid skill courses with certificates", "The government’s skilling platform with courses, training and job links.", { education: ALL }, ["Education certificate", "Passport-size photo"], ["technology", "government", "business"]),
  op("swayam", "SWAYAM Online Courses", "Skills", "Ministry of Education", "Official", "https://swayam.gov.in", "Free university-level online courses", "Free courses from Indian institutions. A fee applies only if you choose to take the proctored exam for a certificate.", { education: ALL }, ["College ID"], ["technology", "research", "ai"]),
  op("ncs", "National Career Service", "Job", "Ministry of Labour & Employment", "Official", "https://www.ncs.gov.in", "Job listings, career guidance and counselling", "The national employment portal where you can search jobs and get career guidance.", { minAge: 18 }, ["Resume", "Education certificate"], ["government", "technology", "business"]),
  op("unstop", "Unstop", "Job", "Unstop", "Third-party", "https://unstop.com", "Jobs, hackathons and competitions", "A private platform for student competitions, hackathons and jobs. Each listing has its own rules.", { education: ["Undergraduate", "Postgraduate"] }, ["Resume", "College ID"], ["technology", "ai", "software development", "business"]),
  op("nats", "National Apprenticeship Training Scheme (NATS)", "Apprenticeship", "Ministry of Education", "Official", "https://nats.education.gov.in", "Paid on-the-job apprenticeship training", "The portal for graduate, technician and diploma apprenticeships with partner establishments.", { education: ["Diploma", "Undergraduate"] }, ["Academic marksheet", "College ID"], ["technology", "government"]),
  op("ugcnet", "UGC NET (JRF)", "Fellowship", "National Testing Agency", "Official", "https://ugcnet.nta.ac.in", "Junior Research Fellowship and assistant professor eligibility", "The national test that can qualify you for research fellowships. Postgraduate students and graduates apply.", { education: ["Postgraduate"] }, ["Academic marksheet", "College ID"], ["research", "ai"])
];

/* ============ 2. STORAGE (versioned keys, safe parsing) ============ */
const K = { p: "avsar_profile_v1", s: "avsar_saved_v1", d: "avsar_docs_v1", t: "avsar_track_v1" };
const load = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const S = { profile: load(K.p, null), saved: load(K.s, []), docs: load(K.d, {}), track: load(K.t, {}) };
if (!Array.isArray(S.saved)) S.saved = [];
if (Array.isArray(S.docs)) S.docs = {};
if (Array.isArray(S.track)) S.track = {};

/* ============ 3. HELPERS ============ */
const $ = (s) => document.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
function h(tag, attrs, ...kids) { // safe DOM builder: text is never parsed as HTML
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
let tt;
const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2400); };
const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN");

/* ============ 4. DEADLINES ============ */
const CLOSING_SOON_DAYS = 7;
function dl(o) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = o.deadline ? new Date(o.deadline + "T00:00:00") : null;
  if (!d || isNaN(d)) return { key: "none", label: "No deadline listed", days: null };
  const days = Math.round((d - today) / 864e5);
  const op0 = o.openingDate ? new Date(o.openingDate + "T00:00:00") : null;
  if (days < 0) return { key: "closed", label: "Closed", days };
  if (op0 && !isNaN(op0) && today < op0) return { key: "upcoming", label: "Upcoming", days };
  if (days <= CLOSING_SOON_DAYS) return { key: "soon", label: "Closing soon", days };
  return { key: "open", label: "Open", days };
}
function dlText(o, d) {
  if (d.key === "none") return "Deadline not provided";
  if (d.key === "closed") return "Closed on " + fmt(o.deadline);
  if (d.key === "upcoming") return "Opens " + fmt(o.openingDate) + " · closes " + fmt(o.deadline);
  return fmt(o.deadline) + " · " + (d.days === 0 ? "closes today" : d.days + (d.days === 1 ? " day left" : " days left"));
}

/* ============ 5. MATCHING (rule-based, change weights here) ============ */
const W = { education: 25, course: 20, state: 15, income: 20, skills: 10, interests: 10, age: 0, year: 0 };
const SOFT = new Set(["skills", "interests"]); // never block eligibility
const LABEL = { education: "education level", course: "course", state: "state", income: "income range", skills: "skills", interests: "interests", age: "age", year: "current year" };
const INCOME = [
  { v: "0-1", t: "Below ₹1,00,000", lo: 0, hi: 100000 }, { v: "1-3", t: "₹1,00,000 – ₹3,00,000", lo: 100000, hi: 300000 },
  { v: "3-5", t: "₹3,00,000 – ₹5,00,000", lo: 300000, hi: 500000 }, { v: "5-8", t: "₹5,00,000 – ₹8,00,000", lo: 500000, hi: 800000 },
  { v: "8+", t: "Above ₹8,00,000", lo: 800000, hi: Infinity }, { v: "na", t: "Prefer not to say" }
];
const GOALS = { "Software developer": "technology", "Data scientist": "technology", "Government job": "government", "Entrepreneur": "business", "Researcher": "research", "Designer": "design" };
function match(o, p) {
  if (!p) return { outcome: "none", score: null, items: [] };
  const e = o.eligibility, items = [];
  const add = (k, req, mine, st) => items.push({ k, req, mine: mine || "Not provided", st, w: W[k] });
  const list = (k, arr, mine, ok) => { if (arr && arr.length) add(k, arr.join(", "), mine, !mine ? "unknown" : ok(mine) ? "pass" : "fail"); };
  list("education", e.education, p.level, (v) => e.education.includes(v));
  list("course", e.courses, p.course, (v) => e.courses.includes(v) || (v === "Computer Science" && e.courses.includes("Engineering")));
  list("state", e.states, p.state, (v) => e.states.includes(v));
  list("year", e.years, p.year, (v) => e.years.includes(+v));
  if (e.minAge || e.maxAge) {
    const a = +p.age;
    add("age", (e.minAge || 0) + "–" + (e.maxAge || "any"), p.age, !a ? "unknown" : a >= (e.minAge || 0) && a <= (e.maxAge || 200) ? "pass" : "fail");
  }
  if (e.maxIncome) {
    const b = INCOME.find((x) => x.v === p.income), req = "Up to " + rupee(e.maxIncome);
    add("income", req, b ? b.t : "", !b || b.v === "na" ? "unknown" : b.hi <= e.maxIncome ? "pass" : b.lo >= e.maxIncome ? "fail" : "unknown");
  }
  const sk = (p.skills || []).map((s) => s.toLowerCase());
  if (e.skills && e.skills.length) add("skills", "Helpful: " + e.skills.join(", "), sk.join(", "), !sk.length ? "unknown" : e.skills.some((s) => sk.includes(s.toLowerCase())) ? "pass" : "soft");
  const my = (p.interests || []).map((s) => s.toLowerCase()); if (GOALS[p.goal]) my.push(GOALS[p.goal]);
  add("interests", "Related: " + o.tags.join(", "), my.join(", "), !my.length ? "unknown" : o.tags.some((t) => my.includes(t)) ? "pass" : "soft");
  const total = items.reduce((a, i) => a + i.w, 0), got = items.reduce((a, i) => a + (i.st === "pass" ? i.w : 0), 0);
  const hard = items.filter((i) => !SOFT.has(i.k));
  const outcome = hard.some((i) => i.st === "fail") ? "no" : hard.some((i) => i.st === "unknown") ? "potential" : "meets";
  return { outcome, score: total ? Math.round((100 * got) / total) : 0, items };
}
const OUT = { meets: "Meets listed criteria", potential: "Potential match", no: "Does not match listed criteria", none: "Profile needed" };
function reason(i) {
  const n = LABEL[i.k];
  if (i.st === "pass") return "Your " + n + " fits the listed criteria.";
  if (i.st === "fail") return "Listed " + n + ": " + i.req + ". Yours: " + i.mine + ".";
  if (i.st === "soft") return "Your " + n + " does not overlap the listed ones (optional).";
  return "Needs information: " + n + " could not be confirmed.";
}

/* ============ 6. SHARED UI PIECES ============ */
function ring(score) { // score is a number, so building SVG from a string is safe
  const w = h("div", { class: "ring", role: "img", "aria-label": "Profile match " + score + " out of 100" });
  w.innerHTML = '<svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true"><circle class="bg" cx="28" cy="28" r="22"/><circle class="fg" cx="28" cy="28" r="22" style="--off:' + (138.2 * (1 - score / 100)).toFixed(1) + '"/></svg>';
  w.append(h("b", { "aria-hidden": "true" }, String(score)));
  return w;
}
function matchBlock(m, compact) {
  if (m.outcome === "none") return h("p", { class: "muted" }, "Create a profile to see how this fits you. ", h("a", { href: "#profile" }, "Set up profile"));
  const pass = m.items.filter((i) => i.st === "pass"), bad = m.items.filter((i) => i.st !== "pass");
  const shown = compact ? [...pass.slice(0, 2), ...bad.slice(0, 1)] : m.items;
  return h("div", { class: "match" }, ring(m.score), h("div", {},
    h("span", { class: "badge " + m.outcome }, (m.outcome === "meets" ? "✓ " : m.outcome === "no" ? "✕ " : "! ") + OUT[m.outcome]),
    h("div", { class: "muted" }, "Profile match: " + m.score + "/100"),
    h("ul", { class: "reasons" }, shown.map((i) => h("li", { class: i.st }, reason(i))))));
}
function saveBtn(o, after) {
  const b = h("button", { class: "btn ghost sm", type: "button", "aria-pressed": S.saved.includes(o.id) });
  const paint = () => { const on = S.saved.includes(o.id); b.textContent = on ? "Remove Saved" : "Save"; b.setAttribute("aria-pressed", on); };
  b.addEventListener("click", () => {
    const on = S.saved.includes(o.id);
    S.saved = on ? S.saved.filter((x) => x !== o.id) : [...S.saved, o.id];
    save(K.s, S.saved); paint(); toast(on ? "Removed from saved" : "Saved to your list"); if (after) after();
  });
  paint(); return b;
}
function card(x, i, after) {
  const { o, m, d } = x;
  return h("article", { class: "card opp", style: "--i:" + i },
    h("div", { class: "row" }, h("span", { class: "tag" }, o.category), h("span", { class: "tag " + (o.sourceType === "Official" ? "official" : "demo") }, o.sourceType + " source")),
    h("h3", {}, h("a", { href: "#opp-" + o.id }, o.title)),
    h("p", { class: "prov" }, o.provider), h("p", {}, o.description), h("p", { class: "benefit" }, o.benefit),
    matchBlock(m, true),
    h("div", { class: "meta" }, h("span", { class: "st " + d.key }, d.label), h("span", {}, dlText(o, d)), h("span", {}, o.documents.length + " documents")),
    h("div", { class: "row actions" }, h("a", { class: "btn primary sm", href: "#opp-" + o.id }, "View Details"), h("a", { class: "btn ghost sm", href: o.officialUrl, target: "_blank", rel: "noopener noreferrer" }, o.sourceType === "Official" ? "Official website" : "Visit website"), saveBtn(o, after)));
}
const rank = () => DATA.map((o) => ({ o, m: match(o, S.profile), d: dl(o) }));
function empty(title, text, href, cta) {
  return h("div", { class: "empty" }, h("h3", {}, title), h("p", { class: "muted" }, text), h("a", { class: "btn primary", href }, cta));
}
const sec = (cls, ...k) => h("section", { class: "sec " + cls }, h("div", { class: "wrap" }, k));

/* ============ 7. VIEWS ============ */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', up: '<path d="M7 17 17 7M8 7h9v9"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>', brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  bank: '<path d="M3 21h18M5 10v8m4-8v8m6-8v8m4-8v8M2 10l10-6 10 6z"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  job: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', hammer: '<path d="m14 6 4 4M4 20l9-9m1-5 3-3 4 4-3 3z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="m9 10 2 2 4-4"/>', shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', send: '<path d="m21 3-9.5 18-2.5-7.5L1.5 11z"/><path d="m21 3-12 11"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 14l2 2 4-4"/>', doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 15l2 2 4-4"/>'
};
const CAT_ICON = { "Scholarship": "cap", "Internship": "brief", "Government Scheme": "bank", "Skills": "spark", "Job": "job", "Apprenticeship": "hammer", "Fellowship": "users" };
const plural = (c) => (c === "Skills" ? c : c + "s");
function ic(n) { // icon paths are fixed strings in this file, never user input
  const s = h("span", { class: "ic", "aria-hidden": "true" });
  s.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[n] + "</svg>";
  return s;
}
const rv = (el, i) => { el.classList.add("rv"); el.style.setProperty("--i", i); return el; };

function home() {
  const sample = { level: "Undergraduate", course: "Computer Science", year: "3", state: "Punjab", age: "20", income: "1-3", skills: ["Python", "HTML/CSS", "JavaScript"], interests: ["Technology", "AI"], goal: "Software developer" };
  const o = DATA[0], m = match(o, sample);
  const rot = h("span", { class: "rot swap" }, "internships"), words = CATS.map((c) => plural(c).toLowerCase()); let ri = 0;
  const tick = setInterval(() => { if (!rot.isConnected) return clearInterval(tick); ri = (ri + 1) % words.length; rot.classList.remove("swap"); void rot.offsetWidth; rot.textContent = words[ri]; rot.classList.add("swap"); }, 2200);
  const hw = ["Find", "opportunities", "made", "for"].map((w, i) => h("span", { class: "w", style: "--i:" + i }, w + " "));
  const stat = (n, l, s) => h("div", {}, h("small", {}, l), h("b", { "data-n": n, "data-s": s || "" }, "0"));
  const card0 = h("div", { class: "hcard-wrap", "aria-label": "Sample preview of an opportunity card" },
    h("div", { class: "chip-float" }, h("span", { class: "chip-ic" }, ic("doc")), h("div", {}, h("small", {}, "Documents"), h("b", {}, "3 of 4 ready"), h("div", { class: "bar3" }, h("i")))),
    h("article", { class: "hcard" }, h("div", { class: "row" }, h("span", { class: "tag" }, ic("cap"), " Scholarship"), h("span", { class: "tag" }, "Sample preview")),
      h("h3", { style: "margin-top:.8rem" }, o.title), h("p", { class: "prov" }, o.provider),
      h("div", { class: "match" }, ring(m.score), h("div", {}, h("div", { class: "muted" }, "Profile match"), h("span", { class: "badge " + m.outcome }, OUT[m.outcome])))));
  const hero = h("section", { class: "hero" }, h("div", { class: "blob b1" }), h("div", { class: "blob b2" }),
    h("div", { class: "wrap hero-in" }, h("div", {},
      h("p", { class: "pill-eyebrow" }, h("i", { class: "dot" }), "Avsar · अवसर means opportunity"),
      h("h1", {}, hw, h("span", { class: "w grad", style: "--i:4" }, "YOU.")),
      h("p", { class: "lead" }, "Discover scholarships, internships, government schemes, skills and career opportunities based on your profile."),
      h("p", { class: "tagline" }, "Don’t search thousands of ", rot, ". Know which ones fit you."),
      h("div", { class: "cta" }, h("a", { class: "btn primary lg", href: "#profile" }, "Find My Opportunities", ic("arrow")), h("a", { class: "btn ghost lg", href: "#find" }, ic("search"), "Explore Opportunities")),
      h("p", { class: "fine" }, "No sign-up. Every card links to the provider’s own website."),
      h("div", { class: "hstats" }, stat(DATA.length, "Opportunities listed"), stat(CATS.length, "Categories"), stat(100, "Data on your device", "%"))), card0));
  const steps = [["Discover", "search", "See opportunities matched to your profile."], ["Understand", "book", "Plain-language eligibility and why it fits."], ["Verify", "shield", "Clear source and verification labels."], ["Prepare", "copy", "Tick off required documents."], ["Apply", "send", "Go to the official provider when ready."], ["Track", "clip", "Keep every application’s status in one place."]];
  const how = sec("", h("div", { class: "head-c" }, h("p", { class: "kicker" }, "How Avsar works"), h("h2", {}, "From “where do I even start?” to “applied”"),
    h("p", { class: "lede", style: "margin-inline:auto" }, "Students don’t lack opportunities. They often lack a clear way to discover, understand and act on the right ones.")),
    h("div", { class: "how" }, steps.map((s, i) => rv(h("div", { class: "hstep" }, h("div", { class: "tile", style: "--i:" + i }, ic(s[1]), h("b", {}, String(i + 1))), h("h3", {}, s[0]), h("p", { class: "muted" }, s[2])), i))));
  const cats = sec("", h("div", { class: "trow" }, h("div", {}, h("p", { class: "kicker" }, "Opportunity categories"), h("h2", {}, "Everything that can move you forward")), h("a", { class: "btn ghost", href: "#find" }, "Browse all opportunities")),
    h("div", { class: "cats" }, CATS.map((c, i) => rv(h("a", { class: "cat", href: "#find", onclick: () => { F.cat = c; } }, h("span", { class: "ct" }, ic(CAT_ICON[c])),
      h("div", { class: "nm" }, h("b", {}, plural(c)), h("span", { class: "go" }, ic("up"))), h("small", { class: "muted" }, DATA.filter((x) => x.category === c).length + " records")), i)),
      rv(h("a", { class: "cat cta-card", href: "#profile" }, h("small", {}, "Not sure where to start?"), h("b", { class: "big" }, "Build your profile and let Avsar sort it for you ", ic("arrow"))), CATS.length)));
  const why = [["Personal matching", "Results come from your education, state, skills and goals."], ["Plain-language eligibility", "Every match shows what fits and what to check."], ["Source clarity", "Official, third-party and unverified records are kept apart."], ["Document readiness", "A checklist for each opportunity, saved on your device."], ["Action tracking", "Move from saved to applied and see what needs attention."]];
  return h("div", { class: "view", "data-title": "Avsar — Find opportunities made for you" }, hero, how, cats,
    sec("alt", h("h2", {}, "Why Avsar is different"), h("div", { class: "cols" }, why.map((w, i) => rv(h("div", {}, h("h3", {}, w[0]), h("p", {}, w[1])), i)))),
    sec("", h("div", { class: "trust" }, h("b", {}, "A note on trust. "), "Avsar links to real portals but has not checked their current rules or dates. The provider’s official website and final decision always come first.")));
}

const STATES = "Andhra Pradesh,Assam,Bihar,Chhattisgarh,Delhi,Goa,Gujarat,Haryana,Himachal Pradesh,Jharkhand,Karnataka,Kerala,Madhya Pradesh,Maharashtra,Odisha,Punjab,Rajasthan,Tamil Nadu,Telangana,Uttar Pradesh,Uttarakhand,West Bengal,Other".split(",");
const SKILLS = ["Python", "JavaScript", "HTML/CSS", "Communication", "Data analysis", "Design", "Marketing", "Other"];
const INTERESTS = ["Technology", "AI", "Software development", "Finance", "Government", "Research", "Business", "Design", "Social impact", "Other"];
const SAMPLE = { age: "20", state: "Punjab", city: "", level: "Undergraduate", course: "Computer Science", year: "3", income: "1-3", skills: ["Python", "HTML/CSS", "JavaScript"], interests: ["Technology", "AI", "Software development"], goal: "Software developer" };

function profileV() {
  const p = S.profile || {};
  const field = (id, label, ctrl, hint, req) => h("div", { class: "field" },
    h("label", { for: id }, label, req ? h("span", { class: "req" }, " *") : h("span", { class: "opt" }, " (optional)")), ctrl,
    hint && h("p", { class: "hint" }, hint), h("p", { class: "err", id: id + "-err", role: "alert" }));
  const sel = (id, opts, val) => h("select", { id, name: id, "aria-describedby": id + "-err" }, h("option", { value: "" }, "Select…"),
    opts.map((o) => { const v = o.v || o; return h("option", { value: v, selected: v === val }, o.t || o); }));
  const chips = (name, opts, vals = []) => h("div", { class: "chips" }, opts.map((o) => h("label", { class: "chip" }, h("input", { type: "checkbox", name, value: o, checked: vals.includes(o) }), h("span", {}, o))));
  const bar = h("i"), pct = h("span", { class: "muted" });
  const f = h("form", { class: "card form", novalidate: true },
    h("div", {}, h("div", { class: "trow" }, h("b", {}, "Profile completeness"), pct), h("div", { class: "progress" }, bar)),
    h("fieldset", {}, h("legend", {}, "Basic profile"), h("div", { class: "fgrid" },
      field("state", "State", sel("state", STATES, p.state), "Some opportunities are limited to a state.", true),
      field("city", "City", h("input", { id: "city", name: "city", value: p.city || "", autocomplete: "address-level2" })),
      field("age", "Age", h("input", { id: "age", name: "age", type: "number", min: 14, max: 60, value: p.age || "" }), "Used only for age limits.", false))),
    h("fieldset", {}, h("legend", {}, "Education"), h("div", { class: "fgrid" },
      field("level", "Education level", sel("level", ["Class 12", "Diploma", "Undergraduate", "Postgraduate"], p.level), "", true),
      field("course", "Course / stream", sel("course", ["Computer Science", "Engineering", "Science", "Commerce", "Arts", "Medicine", "Other"], p.course), "Computer Science also counts as Engineering.", true),
      field("year", "Current year", sel("year", ["1", "2", "3", "4", "5"], p.year), "", false))),
    h("fieldset", {}, h("legend", {}, "Financial context"),
      field("income", "Annual family income range", sel("income", INCOME, p.income), "Used only to compare against listed income limits. Stored in this browser.", false)),
    h("fieldset", {}, h("legend", {}, "Skills, interests and goal"),
      h("div", { class: "field" }, h("span", { class: "lab" }, "Skills ", h("span", { class: "opt" }, "(optional)")), chips("skills", SKILLS, p.skills)),
      h("div", { class: "field" }, h("span", { class: "lab" }, "Interests ", h("span", { class: "opt" }, "(optional)")), chips("interests", INTERESTS, p.interests)),
      field("goal", "Career goal", sel("goal", [...Object.keys(GOALS), "Other"], p.goal), "", false)),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "submit" }, "Save Profile"),
      h("button", { class: "btn ghost", type: "button", onclick: () => { S.profile = { ...SAMPLE }; save(K.p, S.profile); toast("Sample profile loaded — edit anything"); route(); } }, "Load sample student profile")),
    h("p", { class: "hint" }, "We never ask for Aadhaar, bank details, your exact address or certificate numbers. Your profile is stored in this browser only and isn’t synced to any account."));
  const read = () => {
    const fd = new FormData(f), o = {};
    ["state", "city", "age", "level", "course", "year", "income", "goal"].forEach((k) => (o[k] = (fd.get(k) || "").toString().trim()));
    o.skills = fd.getAll("skills"); o.interests = fd.getAll("interests"); return o;
  };
  const upd = () => { const v = read(); const n = ["state", "age", "level", "course", "year", "income", "goal"].filter((k) => v[k]).length + (v.skills.length ? 1 : 0) + (v.interests.length ? 1 : 0); const x = Math.round((n / 9) * 100); bar.style.width = x + "%"; pct.textContent = x + "%"; };
  f.addEventListener("input", upd); f.addEventListener("change", upd); upd();
  f.addEventListener("submit", (ev) => {
    ev.preventDefault(); const v = read(); let first = null;
    const need = { state: "Choose your state.", level: "Choose your education level.", course: "Choose your course or stream." };
    for (const k of ["state", "level", "course", "age"]) {
      let msg = need[k] && !v[k] ? need[k] : "";
      if (k === "age" && v.age && (+v.age < 14 || +v.age > 60)) msg = "Enter an age between 14 and 60, or leave it blank.";
      const el = $("#" + k), er = $("#" + k + "-err"); er.textContent = msg; el.setAttribute("aria-invalid", !!msg);
      if (msg && !first) first = el;
    }
    if (first) return first.focus();
    S.profile = v; save(K.p, v); toast("Profile saved"); location.hash = "find";
  });
  return h("div", { class: "view wrap", "data-title": "Your profile · Avsar" }, h("h1", { style: "font-size:2rem" }, S.profile ? "Edit your profile" : "Tell us about yourself"),
    h("p", { class: "muted" }, "A few details help Avsar show which opportunities fit you. Fields marked * are needed for matching."), f);
}

const F = { q: "", cat: "All", soon: false, pot: false, meets: false, sort: "match" };
function find() {
  const grid = h("div", { class: "grid" }), count = h("p", { class: "count", role: "status" });
  const paint = () => {
    const q = F.q.toLowerCase();
    let r = rank().filter(({ o, m, d }) => {
      const hay = [o.title, o.provider, o.category, o.description, ...o.tags, ...(o.eligibility.skills || [])].join(" ").toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (F.cat !== "All" && o.category !== F.cat) return false;
      if (F.soon && d.key !== "soon") return false;
      if ((F.pot || F.meets) && !((F.pot && m.outcome === "potential") || (F.meets && m.outcome === "meets"))) return false;
      return true;
    });
    const dkey = (x) => (x.d.key === "closed" || x.d.key === "none" ? 1e9 : x.d.days);
    const sorts = { match: (a, b) => (b.m.score ?? -1) - (a.m.score ?? -1), deadline: (a, b) => dkey(a) - dkey(b), recent: (a, b) => b.o.openingDate.localeCompare(a.o.openingDate), category: (a, b) => a.o.category.localeCompare(b.o.category) };
    r.sort(sorts[F.sort]);
    count.textContent = r.length + (r.length === 1 ? " opportunity" : " opportunities") + (S.profile ? " · matched to your profile" : " · browsing without a profile");
    grid.replaceChildren(...(r.length ? r.map((x, i) => card(x, i)) : [h("div", { class: "empty" }, h("h3", {}, "Nothing matches these filters"), h("p", { class: "muted" }, "Try a different keyword or clear the filters."), h("button", { class: "btn primary", type: "button", onclick: () => { Object.assign(F, { q: "", cat: "All", soon: false, pot: false, meets: false }); route(); } }, "Clear filters"))]));
  };
  const pills = h("div", { class: "pills", role: "group", "aria-label": "Category" }, ["All", ...CATS].map((c) => h("button", { class: "pill", type: "button", "aria-pressed": F.cat === c, onclick: (e) => { F.cat = c; pills.querySelectorAll(".pill").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget)); paint(); } }, c === "All" ? c : plural(c))));
  const chk = (key, label) => h("label", { class: "chip" }, h("input", { type: "checkbox", checked: F[key], onchange: (e) => { F[key] = e.target.checked; paint(); } }), h("span", {}, label));
  const tools = h("div", { class: "bar-tools" },
    h("div", {}, h("label", { class: "muted", for: "q" }, "Search title, provider, skill or keyword"), h("input", { id: "q", type: "search", value: F.q, oninput: (e) => { F.q = e.target.value; paint(); } })),
    h("div", {}, h("label", { class: "muted", for: "sort" }, "Sort by"), h("select", { id: "sort", onchange: (e) => { F.sort = e.target.value; paint(); } },
      [["match", "Best profile match"], ["deadline", "Nearest deadline"], ["recent", "Recently added"], ["category", "Category"]].map((s) => h("option", { value: s[0], selected: F.sort === s[0] }, s[1])))));
  const det = h("details", { class: "filters" }, h("summary", {}, "More filters"), h("div", { class: "chips" }, chk("soon", "Closing soon"), chk("pot", "Potential match"), chk("meets", "Meets criteria"), h("span", { class: "muted" }, "Links go to the provider’s own website."), h("button", { class: "link", type: "button", onclick: () => { Object.assign(F, { q: "", cat: "All", soon: false, pot: false, meets: false }); route(); } }, "Clear filters")));
  if (innerWidth > 760) det.open = true;
  paint();
  return h("div", { class: "view wrap", "data-title": "Find opportunities · Avsar" }, h("h1", { style: "font-size:2rem" }, S.profile ? "Opportunities for you" : "Find opportunities"),
    !S.profile && h("div", { class: "banner" }, "You’re browsing without a profile. ", h("a", { href: "#profile" }, "Create a profile"), " for personalised matching."),
    tools, pills, det, count, grid);
}

function savedV() {
  const grid = h("div", { class: "grid" });
  const paint = () => {
    const r = rank().filter((x) => S.saved.includes(x.o.id));
    grid.replaceChildren(...(r.length ? r.map((x, i) => card(x, i, paint)) : [empty("Nothing saved yet", "Save an opportunity to keep it handy and come back to it.", "#find", "Find opportunities")]));
  };
  paint();
  return h("div", { class: "view wrap", "data-title": "Saved · Avsar" }, h("h1", { style: "font-size:2rem" }, "Saved opportunities"), grid);
}

const STAT = ["Not Started", "Preparing", "Ready to Apply", "Applied"];
function statusSel(o) {
  return h("select", { "aria-label": "Application status for " + o.title, onchange: (e) => {
    if (e.target.value) S.track[o.id] = e.target.value; else delete S.track[o.id];
    save(K.t, S.track); toast(e.target.value ? "Status updated: " + e.target.value : "Stopped tracking");
  } }, h("option", { value: "" }, "Not tracking"), STAT.map((s) => h("option", { value: s, selected: S.track[o.id] === s }, s)));
}
function appsV() {
  const ids = Object.keys(S.track), list = DATA.filter((o) => ids.includes(o.id));
  return h("div", { class: "view wrap", "data-title": "My Applications · Avsar" }, h("h1", { style: "font-size:2rem" }, "My applications"),
    h("p", { class: "muted" }, "“Applied” means you tell us you applied on the official site. Avsar does not submit applications."),
    list.length ? h("div", { class: "grid" }, list.map((o, i) => h("article", { class: "card opp", style: "--i:" + i }, h("h3", {}, h("a", { href: "#opp-" + o.id }, o.title)), h("p", { class: "prov" }, o.provider),
      h("p", {}, (S.docs[o.id] || []).length + " of " + o.documents.length + " documents ready"), h("div", { class: "actions" }, statusSel(o)))))
      : empty("No applications tracked", "Open an opportunity and choose Track Application to follow your progress here.", "#find", "Find opportunities"));
}

function dash() {
  const r = rank(), live = r.filter((x) => x.d.key !== "closed");
  const rel = live.filter((x) => x.m.outcome === "meets" || x.m.outcome === "potential"), soon = live.filter((x) => x.d.key === "soon");
  const prog = Object.values(S.track).filter((s) => s !== "Applied").length;
  const acts = [];
  if (!S.profile) acts.push(["Create your profile to get personalised matches", "#profile"]);
  soon.slice(0, 2).forEach((x) => acts.push(["Review “" + x.o.title + "” — " + dlText(x.o, x.d), "#opp-" + x.o.id]));
  DATA.filter((o) => S.track[o.id] && o.id in S.track && S.track[o.id] !== "Applied").slice(0, 2).forEach((o) => acts.push(["Update status for “" + o.title + "” (" + S.track[o.id] + ")", "#opp-" + o.id]));
  DATA.filter((o) => S.saved.includes(o.id) && (S.docs[o.id] || []).length < o.documents.length).slice(0, 2).forEach((o) => acts.push(["Prepare documents for “" + o.title + "”", "#opp-" + o.id]));
  const stat = (n, l) => h("div", { class: "card stat" }, h("b", { "data-n": n }, "0"), h("span", {}, l));
  return h("div", { class: "view wrap", "data-title": "Dashboard · Avsar" }, h("h1", { style: "font-size:2rem" }, "Your dashboard"),
    h("p", { class: "muted" }, S.profile ? "Welcome back. Here is where things stand." : "Welcome to Avsar. Start with a short profile to see relevant opportunities."),
    h("div", { class: "stats" }, stat(S.profile ? rel.length : 0, "Relevant opportunities"), stat(soon.length, "Closing soon"), stat(S.saved.length, "Saved"), stat(prog, "Applications in progress")),
    h("h2", {}, "Next actions"),
    acts.length ? h("ul", { class: "todo" }, acts.map((a) => h("li", {}, h("a", { href: a[1] }, a[0])))) : empty("You’re all caught up", "Save or track an opportunity and your next steps will appear here.", "#find", "Find opportunities"));
}

function detail(o) {
  if (!o) return h("div", { class: "view wrap", "data-title": "Not found · Avsar" }, empty("We couldn’t find that opportunity", "The link may be old or mistyped.", "#find", "Back to results"));
  const m = match(o, S.profile), d = dl(o), ready = () => S.docs[o.id] || [];
  const count = h("p", { role: "status" }), missing = h("p", { class: "muted" });
  const paintDocs = () => { const n = ready().length; count.textContent = n + " of " + o.documents.length + " documents ready"; const miss = o.documents.filter((x) => !ready().includes(x)); missing.textContent = miss.length ? "You still need to prepare: " + miss.join(", ") + "." : "All listed documents are marked ready. This doesn’t guarantee eligibility or selection."; };
  const docs = h("div", { class: "docs" }, o.documents.map((x) => h("label", {}, h("input", { type: "checkbox", checked: ready().includes(x), onchange: (e) => {
    S.docs[o.id] = e.target.checked ? [...ready(), x] : ready().filter((y) => y !== x); save(K.d, S.docs); paintDocs();
  } }), x)));
  paintDocs();
  const e = o.eligibility;
  const table = m.items.length ? h("div", { class: "tblw" }, h("table", {}, h("thead", {}, h("tr", {}, ["Requirement", "Listed", "Your profile", "Status"].map((t) => h("th", { scope: "col" }, t)))),
    h("tbody", {}, m.items.map((i) => h("tr", {}, h("td", {}, LABEL[i.k]), h("td", {}, i.req), h("td", {}, i.mine), h("td", {}, { pass: "✓ Fits", fail: "✕ Not met", unknown: "! Needs information", soft: "! No overlap (optional)" }[i.st])))))) : h("p", { class: "muted" }, S.profile ? "No eligibility criteria are listed for this record." : "Create a profile to compare your details with the criteria.");
  const apply = o.officialUrl && /^https?:\/\//.test(o.officialUrl) ? h("a", { class: "btn primary", href: o.officialUrl, target: "_blank", rel: "noopener noreferrer" }, o.sourceType === "Official" ? "Apply on Official Website" : "Open on " + o.provider)
    : h("button", { class: "btn primary", type: "button", disabled: true }, "Apply on Official Website");
  const left = h("div", {}, h("section", { class: "card" }, h("h2", {}, "Why this matches you"), matchBlock(m, false),
    h("p", { class: "hint" }, "Based on the broad criteria Avsar lists for this record. The provider’s official rules and final decision take precedence. Profile match is not a chance of selection.")),
    h("section", { class: "card", style: "margin-top:1rem" }, h("h2", {}, "Eligibility"), table),
    h("section", { class: "card", style: "margin-top:1rem" }, h("h2", {}, "Documents"), docs, count, missing,
      h("button", { class: "link", type: "button", onclick: () => { S.docs[o.id] = []; save(K.d, S.docs); docs.querySelectorAll("input").forEach((c) => (c.checked = false)); paintDocs(); toast("Checklist reset"); } }, "Reset checklist")));
  const right = h("div", {}, h("section", { class: "card" }, h("h2", {}, "Deadline"), h("p", {}, h("span", { class: "st " + d.key }, d.label), " ", dlText(o, d)),
    o.openingDate && h("p", { class: "muted" }, "Opening date: " + fmt(o.openingDate))),
    h("section", { class: "card", style: "margin-top:1rem" }, h("h2", {}, "Trust & source"), h("dl", { class: "kv" },
      h("dt", {}, "Provider"), h("dd", {}, o.provider), h("dt", {}, "Source type"), h("dd", {}, o.sourceType), h("dt", {}, "Source URL"), h("dd", {}, o.sourceUrl || "Not provided"),
      h("dt", {}, "Application URL"), h("dd", {}, o.officialUrl || "None — demo record"), h("dt", {}, "Verification"), h("dd", {}, o.verificationStatus), h("dt", {}, "Last checked"), h("dd", {}, o.lastVerified ? fmt(o.lastVerified) : "Never checked"))),
    h("section", { class: "card", style: "margin-top:1rem" }, h("h2", {}, "Take action"), h("div", { class: "row" }, apply, saveBtn(o)),
      !o.officialUrl && h("p", { class: "hint" }, "This demonstration record has no live application destination."),
      h("div", { class: "field", style: "margin-top:.8rem" }, h("span", { class: "lab" }, "Application status ", h("span", { class: "opt" }, "(you report this)")), statusSel(o),
        !S.track[o.id] && h("button", { class: "btn ghost sm", style: "margin-top:.5rem", type: "button", onclick: () => { S.track[o.id] = "Not Started"; save(K.t, S.track); toast("Tracking started"); route(); } }, "Track Application"))));
  return h("div", { class: "view wrap", "data-title": o.title + " · Avsar" }, h("a", { href: "#find" }, "← Back to results"),
    h("div", { class: "row", style: "margin-top:.6rem" }, h("span", { class: "tag" }, o.category), h("span", { class: "tag " + (o.sourceType === "Official" ? "official" : "demo") }, o.sourceType + " source")),
    h("h1", { style: "font-size:2rem" }, o.title), h("p", { class: "prov" }, o.provider + " · " + o.benefit), h("p", {}, o.description),
    h("div", { class: "banner" }, "Avsar shows a short summary and links to the provider’s own website. Rules, dates and benefits change by scheme and year, so confirm everything there before applying."),
    h("div", { class: "dgrid" }, left, right));
}

/* ============ 8. ROUTER ============ */
const VIEWS = { home, profile: profileV, find, saved: savedV, apps: appsV, dash };
function countUp(el) {
  const n = +el.dataset.n; if (!n || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = n + (el.dataset.s || ""); return; }
  const t0 = performance.now();
  const step = (t) => { const k = Math.min((t - t0) / 900, 1); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))) + (el.dataset.s || ""); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15 }) : null;
function route() {
  const r = location.hash.slice(1) || "home";
  const v = r.startsWith("opp-") ? detail(DATA.find((x) => x.id === r.slice(4))) : (VIEWS[r] || home)();
  $("#app").replaceChildren(v);
  document.title = v.dataset.title || "Avsar";
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (r.startsWith("opp-") ? "find" : r)));
  v.querySelectorAll("[data-n]").forEach(countUp);
  v.querySelectorAll(".rv").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
  if (!route.first) window.scrollTo(0, 0); route.first = false;
}
route.first = true;
addEventListener("hashchange", route);
$("#skip").addEventListener("click", () => $("#app").focus());
$("#reset").addEventListener("click", () => {
  if (!confirm("Clear your profile, saved items, checklists and tracking from this browser?")) return;
  Object.values(K).forEach((k) => localStorage.removeItem(k));
  S.profile = null; S.saved = []; S.docs = {}; S.track = {}; toast("Local data cleared"); route();
});
route();

/* ============ 9. Buttons react when the cursor comes near ============ */
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
  let raf = 0, ev;
  addEventListener("pointermove", (e) => {
    ev = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      document.querySelectorAll(".btn:not([disabled])").forEach((b) => {
        const r = b.getBoundingClientRect(), dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
        const near = Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 70;
        const set = (k, v) => b.style.setProperty(k, v);
        if (near) { set("--tx", Math.max(-8, Math.min(8, dx * 0.14)) + "px"); set("--ty", Math.max(-6, Math.min(6, dy * 0.14)) + "px"); set("--mx", ev.clientX - r.left + "px"); set("--my", ev.clientY - r.top + "px"); set("--g", 1); }
        else { set("--tx", "0px"); set("--ty", "0px"); set("--g", 0); }
      });
    });
  });
})();
