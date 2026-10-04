---
name: google-seo-fundamentals
description: Apply Google's official SEO and generative-AI-search (AEO/GEO) guidance when writing, reviewing, or auditing blog posts, articles, or web pages. Covers crawlability/indexing (robots.txt, sitemaps, JS rendering), site/URL structure and canonicalization, redirects, content quality and helpfulness, title tags and meta descriptions, structured data and rich results, image/video/favicon optimization, ecommerce and international sites, promotion, traffic-drop debugging, Search Console + GA4 usage, evaluating SEO vendors/tools, and what NOT to bother with (myths and outdated tactics — meta keywords, keyword stuffing, llms.txt, content "chunking"). Use whenever the task involves creating new content intended to rank in Google Search or AI Overviews/AI Mode, auditing existing content/pages for SEO, or diagnosing a search-visibility problem.
---

# Google SEO Fundamentals

This skill packages 23 official Google Search Central documents — the SEO Starter Guide, the
generative-AI-search (AEO/GEO) guide, and 21 supporting docs on crawling, indexing, appearance,
specialty site types, monitoring, and evaluating SEO help — into an actionable checklist for
writing, reviewing, and debugging content. It reflects Google's own stated position, not third-party SEO folklore:
**AEO/GEO is not a separate discipline from SEO.** Google's AI features (AI Overviews, AI Mode)
are grounded in the same core ranking and quality systems as classic Search via
retrieval-augmented generation (RAG) and query fan-out. Everything below applies to both.

**One core principle underlies all of it:** would a real visitor find this page satisfying,
helpful, and trustworthy? The mechanics below just remove friction between that content and the
people (and AI systems) searching for it.

## When to apply this skill

- Drafting a new blog post, article, product page, or landing page intended to be discovered via search.
- Reviewing/auditing existing content or a whole site for SEO gaps.
- Choosing a title, meta description, URL slug, heading structure, or redirect strategy.
- Investigating a drop in search traffic or clicks.
- Deciding whether to invest time in a specific "SEO trick" someone suggested.

Each section below names the reference doc(s) it draws from — go deeper there when the task needs
more than the summary. See the [Reference index](#reference-index) for the full list.

## 1. Make crawling and indexing non-negotiable

*(essentials.md · robots-intro.md · sitemaps-overview.md · control-what-you-share.md · javascript-seo-basics.md · ask-google-to-recrawl.md)*

- Before doing anything: check if Google already has the page (`site:yourdomain.com/path`) — don't fix a problem that doesn't exist.
- Meet the baseline [technical requirements](references/essentials.md): Googlebot must be able to fetch the page (no blocking, no login wall for content meant to be public), the page returns proper HTTP status codes, and it has indexable content in a [supported file type](references/essentials.md).
- **robots.txt manages crawl traffic — it is not a privacy tool.** It tells crawlers what to fetch, not what to keep out of search results; a disallowed URL can still get indexed (with no snippet) if other sites link to it. To actually keep a page out of results, use `noindex` or password-protect it — see [control-what-you-share.md](references/control-what-you-share.md) for the full decision tree (remove content / password-protect / `noindex` / robots.txt for media only / opt out of specific Google properties).
- **Sitemaps** aren't required (Google finds most pages via links) but are cheap insurance for large or fast-changing sites — see [sitemaps-overview.md](references/sitemaps-overview.md).
- **JavaScript-rendered content** must survive to what Googlebot actually sees — verify with the URL Inspection Tool, not just "it works in my browser." See [javascript-seo-basics.md](references/javascript-seo-basics.md) for rendering, dynamic rendering, and common JS-SEO pitfalls (this matters for Astro islands, SPAs, client-only components).
- After a major fix or new page, you generally don't need to manually request recrawl — Google finds changes on its own schedule — but see [ask-google-to-recrawl.md](references/ask-google-to-recrawl.md) for when Search Console's "Request Indexing" is actually worth using.

## 2. Structure URLs, canonicalize, and redirect correctly

*(seo-starter-guide.md · consolidate-duplicate-urls.md · 301-redirects.md)*

- **Descriptive URLs** beat opaque IDs: `/blog/sourdough-starter-guide` not `/blog/p?id=48213`. Parts of the URL can render as breadcrumbs in results.
- Group topically related content under shared directories (`/blog/`, `/recipes/`, `/docs/`) — matters more as a site grows past a few thousand URLs.
- **Duplicate content isn't a penalty, but it wastes crawl budget and confuses users.** Each piece of content should resolve to one canonical URL. Compare methods (redirect vs. `rel="canonical"` vs. sitemap hints vs. internal linking consistency vs. `URL Parameters` handling) in [consolidate-duplicate-urls.md](references/consolidate-duplicate-urls.md) — pick the strongest signal available for the situation, since Google treats these as hints, not directives, and can override a weak or contradictory one.
- **Use a real 301 (permanent) redirect** when a URL moves for good; use 302/temporary only for genuinely temporary moves. Server-side redirects beat JS/meta-refresh redirects for SEO reliability. Full type comparison and pitfalls (redirect chains, redirecting to unrelated content) in [301-redirects.md](references/301-redirects.md).

## 3. Write content that's actually worth finding

*(seo-starter-guide.md · ai-optimization-guide.md)*

This is the highest-leverage section — it affects ranking more than any technical fix.

- **Unique point of view, not commodity summary.** A generic "7 tips for X" restates common knowledge anyone (or any LLM) could produce. Google explicitly names this as low-value in the AI-search era. Write from direct experience, testing, or expertise.
- **Readable and well organized**: clear paragraphs, logical headings, no filler, no grammar errors.
- **Genuinely your own work** — don't rehash others' content; if AI-assisted, the output still has to clear the same helpfulness/spam bar as human-written content.
- **Keep it current** — revisit and update or retire stale posts rather than leaving them live.
- **Write for how real readers search**, including less-expert readers who'd use different words — but don't obsess over covering every keyword variant; Google's language matching handles synonyms on its own.
- **Don't let ads/interstitials get in the way** of the content someone came to read.
- **Link out when it adds value**, with descriptive anchor text (never "click here"). Add `nofollow`/`ugc`/`sponsored` on links you don't want to vouch for, especially user-submitted ones.

## 4. Control how the page appears in results

*(title-link.md · snippet.md · visual-elements-gallery.md · favicon-in-search.md · structured-data-search-gallery.md)*

- **Title tag**: unique per page, clear, concise, accurately describes the page — the single biggest input to the search-result headline. [title-link.md](references/title-link.md) has a full list of common title problems Google calls out (duplicate titles across a site, boilerplate/site-name-only titles, titles that don't match on-page content, excessive length).
- **Meta description**: short, unique per page, 1–2 sentences hitting the most relevant points. It's a *hint*, not a guarantee — Google may generate its own snippet from page content instead. See [snippet.md](references/snippet.md) for what makes a description likely to be used as-is.
- Know the [visual elements](references/visual-elements-gallery.md) a result can carry (title link, breadcrumb, sitelinks, rich result badges) so you know what each on-page signal is actually influencing.
- **Favicon**: a real, indexable favicon (not blocked by robots.txt, square, ≥8px served, ideally SVG/PNG) shows next to your result on mobile — see [favicon-in-search.md](references/favicon-in-search.md) for the technical requirements.
- **Structured data is an enhancement, not a prerequisite.** Valid JSON-LD makes a page *eligible* for rich results (review stars, carousels, FAQ/how-to layouts, etc.) — check [structured-data-search-gallery.md](references/structured-data-search-gallery.md) for the current catalog of eligible types before hand-rolling schema that has no matching rich result.

## 5. Optimize images, video, and social/short-form video

*(google-images.md · video.md · analyze-social-video-content.md)*

- Place high-quality, sharp images **near the text they relate to** — proximity is a context signal; see [google-images.md](references/google-images.md) for file naming, `alt` text, structured data for images, and lazy-loading pitfalls that hide images from crawlers.
- Write **descriptive `alt` text** on every meaningful image; use empty `alt=""` for purely decorative images.
- For standalone video content: host on a dedicated page near relevant text, provide a proper thumbnail and `VideoObject` structured data, and follow the technical specifics (thumbnail dimensions, hosting requirements, removal/restriction options) in [video.md](references/video.md).
- Short-form/social video (e.g. embedded clips meant to surface in video/visual search) has its own discoverability considerations — see [analyze-social-video-content.md](references/analyze-social-video-content.md), which also covers using Search Console to see how that content performs.

## 6. Specialty site types

*(ecommerce.md · international.md)*

- **Ecommerce**: product data feeds, ecommerce-specific structured data, URL structure, pagination/incremental loading, and review content each get dedicated Google sub-guides — [ecommerce.md](references/ecommerce.md) is the index; follow the linked sub-articles for the specific concern (e.g. designing product URLs, launching a new store).
- **International/multilingual sites**: managing multi-regional content, `hreflang` for localized versions, and locale-adaptive rendering are distinct problems with distinct guidance — [international.md](references/international.md) is the index into Google's dedicated sub-guides. Don't guess at `hreflang` syntax; it's a common source of silent misconfiguration.

## 7. Promote it (this is still part of SEO)

*(seo-starter-guide.md)*

- Social sharing, community engagement, offline promotion (URL on business cards/materials), newsletters — all legitimate ways to accelerate discovery, which in turn helps crawling via inbound links.
- Word of mouth compounds but takes time and usually follows genuine community engagement first.
- Don't overdo it — excessive/inauthentic promotion reads as [manipulation of search results](https://developers.google.com/search/docs/essentials/spam-policies) and can backfire.

## 8. Generative AI search (AI Overviews / AI Mode) specifics

*(ai-optimization-guide.md)*

Everything above already applies — Google is explicit that this is not a separate optimization
target. A few additions specific to how RAG/query-fan-out systems consume pages:

- Local business/ecommerce data surfaces in AI answers too — keep Merchant Center feeds and Google Business Profile details current if applicable.
- Track AI-specific visibility via Search Console's **Generative AI performance report**, not third-party tools claiming access to "internal" Google signals (no such tool exists legitimately).
- If relevant, review [agent-friendly site UX](https://web.dev/articles/ai-agent-site-ux) for browser/shopping agents that read the DOM/accessibility tree directly — a distinct, smaller concern from ranking in AI Overviews.

## 9. Monitor, measure, and debug

*(debugging-search-traffic-drops.md · google-analytics-search-console.md)*

- When traffic drops, **diagnose before reacting**: distinguish a real ranking/indexing change from a seasonal dip, a tracking bug, a SERP-feature layout change, or a broader industry trend. [debugging-search-traffic-drops.md](references/debugging-search-traffic-drops.md) gives the triage sequence Google recommends — don't jump straight to "Google penalized us."
- **Search Console and Google Analytics answer different questions and should be cross-referenced, not treated as duplicates** — Search Console shows how Google sees and ranks your site (queries, impressions, indexing status); GA shows what users do after they land. [google-analytics-search-console.md](references/google-analytics-search-console.md) explains why their numbers won't match (different bot-filtering, sampling, and attribution models) and how to link them properly.

## 10. Evaluating SEO help and third-party tools

*(do-i-need-seo.md)*

- Google's own guidance on when hiring an SEO makes sense, what a legitimate one looks like, and
  the red flags of a bad one (guaranteed #1 rankings, unsolicited "we noticed your site isn't
  listed" emails, secrecy about what they're changing, asking to be linked to). If a task involves
  evaluating an SEO vendor, an audit, or a third-party tool's recommendations, check them against
  [do-i-need-seo.md](references/do-i-need-seo.md) — especially the rule that **no legitimate
  third-party tool has access to Google's internal ranking data**, which is the same principle
  behind refusing "internal metrics" claims in the myths table below.

## Things to explicitly NOT do (per Google, not "just don't bother")

These are myths/wastes of effort called out directly in the source guides — actively push back if asked to do these:

| Don't bother with | Why |
|---|---|
| Meta keywords tag | Google doesn't use it at all |
| Keyword stuffing | Against spam policies, and reads badly to humans |
| Optimizing keywords in domain/URL path | Near-zero ranking effect beyond breadcrumb display |
| Hitting a minimum/maximum word count | No such ranking factor exists |
| Choosing subdomains vs. subdirectories "for SEO" | Purely a business/maintenance decision, not a ranking one |
| Worrying about heading order/count "for SEO" | Matters for accessibility, not Google ranking |
| Treating E-E-A-T as a ranking factor | It explicitly is not one |
| Using robots.txt to hide a page from search results | It only manages crawl traffic; linked pages can still get indexed without a snippet — use `noindex` or password-protection instead |
| Creating `llms.txt` or other "AI text files" for Google | Google Search ignores them entirely (harmless to keep for other tools, but does nothing for Google) |
| "Chunking" content into tiny AI-optimized pieces | No such requirement; write for the audience, not the model |
| Rewriting content "for AI systems" specifically | Language understanding already handles synonyms/phrasing variance |
| Chasing inauthentic brand "mentions" across the web | Ranking depends on content quality + spam systems, not mention-farming |
| Adding structured data because "AI needs it" | Not required for AI features; still fine to use for classic rich results |
| Trusting third-party tools that claim "internal Google metrics" | No third party has access to Google's internal ranking/AI systems |
| Assuming a traffic drop = manual penalty | Most drops trace to seasonality, tracking bugs, or SERP layout changes — triage before assuming the worst |

## Self-review checklist (run before calling content "SEO-ready")

- [ ] Content offers a genuine point of view / first-hand experience, not a commodity summary of what's already out there.
- [ ] Title tag: unique, descriptive, human-readable, not keyword-stuffed, matches on-page content.
- [ ] Meta description: unique per page, 1–2 sentences, sells the actual content.
- [ ] URL is descriptive (words, not opaque IDs) and lives under a sensible directory.
- [ ] No duplicate/near-duplicate content at a different URL without a canonical or 301 redirect in place.
- [ ] Headings and paragraphs make the page easy to scan; no walls of text.
- [ ] Every meaningful image has descriptive `alt` text and sits near its relevant text.
- [ ] Internal/external links use descriptive anchor text; untrusted outbound links are annotated (`nofollow`/`ugc`/`sponsored`).
- [ ] Page is crawlable — no critical content hidden behind unexecuted JS, blocked resources, or an overreaching robots.txt rule.
- [ ] Favicon is present and not accidentally blocked by robots.txt.
- [ ] Any structured data added actually maps to an eligible rich result type — not added speculatively.
- [ ] Nothing on this checklist involved meta keywords, keyword stuffing, word-count targets, or an `llms.txt` file.

## Reference index

All 22 source documents, fetched verbatim from Google Search Central's `.md.txt` export
endpoint and cleaned of markdown-conversion artifacts only (see the [README](README.md) for
method). Use these when a task needs more depth than the summaries above.

| File | Covers |
|---|---|
| [seo-starter-guide.md](references/seo-starter-guide.md) | The foundational how-to: crawling, site organization, content quality, titles/snippets, images/video, promotion, and the original myths list |
| [ai-optimization-guide.md](references/ai-optimization-guide.md) | Generative AI search (AI Overviews/AI Mode), RAG/query fan-out, AEO/GEO mythbusting, agentic experiences |
| [essentials.md](references/essentials.md) | The minimum technical/quality/policy bar to be eligible for Google Search at all |
| [robots-intro.md](references/robots-intro.md) | What robots.txt does and doesn't do, its limitations, syntax pointers |
| [sitemaps-overview.md](references/sitemaps-overview.md) | When and why to submit a sitemap |
| [ask-google-to-recrawl.md](references/ask-google-to-recrawl.md) | When manually requesting indexing/recrawl is actually worth it |
| [control-what-you-share.md](references/control-what-you-share.md) | Every mechanism for keeping content out of Search (removal, password, `noindex`, robots.txt, opt-outs) |
| [consolidate-duplicate-urls.md](references/consolidate-duplicate-urls.md) | Canonicalization methods compared (redirects, `rel=canonical`, sitemaps, parameter handling) |
| [301-redirects.md](references/301-redirects.md) | Redirect types, when to use each, common redirect mistakes |
| [javascript-seo-basics.md](references/javascript-seo-basics.md) | How Googlebot renders JS, dynamic rendering, JS-SEO pitfalls |
| [visual-elements-gallery.md](references/visual-elements-gallery.md) | Catalog of visual elements a search result can display |
| [title-link.md](references/title-link.md) | Writing good titles; common title-link problems Google flags |
| [snippet.md](references/snippet.md) | How snippets/meta descriptions are generated and written well |
| [google-images.md](references/google-images.md) | Image SEO: file naming, alt text, structured data, lazy-load pitfalls |
| [video.md](references/video.md) | Video SEO: hosting, thumbnails, structured data, removal/restriction |
| [structured-data-search-gallery.md](references/structured-data-search-gallery.md) | Catalog of rich-result types structured data can unlock |
| [favicon-in-search.md](references/favicon-in-search.md) | Favicon technical requirements for search results |
| [ecommerce.md](references/ecommerce.md) | Index of ecommerce-specific SEO sub-guides |
| [international.md](references/international.md) | Index of multilingual/multi-regional SEO sub-guides |
| [debugging-search-traffic-drops.md](references/debugging-search-traffic-drops.md) | Triage sequence for diagnosing a search-traffic drop |
| [google-analytics-search-console.md](references/google-analytics-search-console.md) | Why GA and Search Console numbers differ, and how to use them together |
| [analyze-social-video-content.md](references/analyze-social-video-content.md) | Discoverability and performance analysis for short-form/social video |
| [do-i-need-seo.md](references/do-i-need-seo.md) | Whether/when to hire an SEO, how to vet one, red flags of a bad one |

See the [README](README.md) for how these were collected, why, and how this skill is kept current.
