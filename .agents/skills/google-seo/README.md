# 🔍 google-seo-fundamentals — an Agent Skill for Google-aligned SEO & AI-search optimization

<!-- Static badges (work anywhere, no repo required) -->
![Skill Format](https://img.shields.io/badge/format-Agent%20Skill%20(SKILL.md)-8A2BE2)
![Source](https://img.shields.io/badge/source-Google%20Search%20Central-4285F4?logo=google&logoColor=white)
![Docs Covered](https://img.shields.io/badge/guides%20covered-23-blue)
![Scope](https://img.shields.io/badge/scope-SEO%20%2B%20AEO%2FGEO-informational)
![Verified](https://img.shields.io/badge/last%20verified-2026--07--30-brightgreen)
![Maintenance](https://img.shields.io/badge/maintenance-re--check%20quarterly-yellow)
![No Myths](https://img.shields.io/badge/myths%20debunked-14-critical)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4)

<!-- Dynamic GitHub badges -->
![License](https://img.shields.io/badge/license-CC_BY_4.0-lightgrey)
![Latest Tag](https://img.shields.io/github/v/tag/mikezupper/google-seo-skill?sort=semver&label=latest%20tag)
![Tag Count](https://img.shields.io/github/tag/mikezupper/google-seo-skill.svg?label=tags)
![Last Commit](https://img.shields.io/github/last-commit/mikezupper/google-seo-skill)
![Commit Activity](https://img.shields.io/github/commit-activity/m/mikezupper/google-seo-skill)
![Issues](https://img.shields.io/github/issues/mikezupper/google-seo-skill)
![Contributors](https://img.shields.io/github/contributors/mikezupper/google-seo-skill)
![Repo Size](https://img.shields.io/github/repo-size/mikezupper/google-seo-skill)
![Stars](https://img.shields.io/github/stars/mikezupper/google-seo-skill?style=social)

A portable, harness-agnostic **Agent Skill** that teaches an AI coding/writing agent to apply
Google's own official SEO and generative-AI-search guidance when drafting or reviewing web
content — instead of the third-party "AEO/GEO hacks" folklore (llms.txt files, content
"chunking", keyword-stuffed titles) that Google explicitly says don't work.

> Every git tag in this repo marks a point where the reference set was re-verified against
> Google's live docs — see [Keeping this updated](#keeping-this-updated) and
> [Release history](#release-history).

---

## Table of contents

- [Motivation](#motivation)
- [What's in this repo](#whats-in-this-repo)
- [How the data was collected](#how-the-data-was-collected)
- [Approach](#approach)
- [Using the skill](#using-the-skill)
- [Keeping this updated](#keeping-this-updated)
- [Release history](#release-history)
- [Resources](#resources)
- [License](#license)

---

## Motivation

Search advice online is mostly recycled folklore — half of it obsolete (meta keywords, exact
word-count targets), half of it invented wholesale for the AI-search era ("AEO", "GEO",
`llms.txt`, "chunk your content for the AI"). Meanwhile Google publishes its own official
guidance directly, and states plainly that generative AI search (AI Overviews, AI Mode) is
**not a separate discipline** — it's grounded in the same core ranking and quality systems as
classic Search, via retrieval-augmented generation and query fan-out. There is one set of rules,
not two.

This skill exists so that when an agent is asked to write, review, or debug content "for SEO," it
reaches for Google's actual stated position — across the full surface area (crawling, indexing,
appearance, redirects, structured data, ecommerce, i18n, monitoring) — instead of pattern-matching
on outdated SEO blog posts from its training data, including explicitly *refusing* to do things
Google says don't work.

## What's in this repo

| File | What it is |
|---|---|
| [`SKILL.md`](SKILL.md) | The agent skill: an actionable checklist derived from all 23 source guides — crawlability/indexing, URL structure/canonicalization/redirects, content quality, titles/snippets/rich results, images/video, ecommerce/international, promotion, generative-AI-search specifics, monitoring/debugging, evaluating SEO help, a table of myths to actively refuse, a self-review checklist, and a reference index. |
| [`references/`](references/) | 23 cleaned, verbatim copies of the source Google Search Central docs (see table below). |
| `README.md` | You are here. |

<details>
<summary><strong>Full list of reference docs (click to expand)</strong></summary>

| File | Google Search Central doc |
|---|---|
| [seo-starter-guide.md](references/seo-starter-guide.md) | SEO Starter Guide: The Basics |
| [ai-optimization-guide.md](references/ai-optimization-guide.md) | Optimizing your website for generative AI features on Google Search |
| [essentials.md](references/essentials.md) | Google Search Essentials |
| [robots-intro.md](references/robots-intro.md) | Introduction to robots.txt |
| [sitemaps-overview.md](references/sitemaps-overview.md) | Learn about sitemaps |
| [ask-google-to-recrawl.md](references/ask-google-to-recrawl.md) | Ask Google to recrawl your URLs |
| [control-what-you-share.md](references/control-what-you-share.md) | Control what you share with Google |
| [consolidate-duplicate-urls.md](references/consolidate-duplicate-urls.md) | Consolidate duplicate URLs |
| [301-redirects.md](references/301-redirects.md) | 301 redirects and Google Search |
| [javascript-seo-basics.md](references/javascript-seo-basics.md) | JavaScript SEO basics |
| [visual-elements-gallery.md](references/visual-elements-gallery.md) | Google Search visual elements gallery |
| [title-link.md](references/title-link.md) | Influencing your title links in search results |
| [snippet.md](references/snippet.md) | Control your snippets in search results |
| [google-images.md](references/google-images.md) | Google Images best practices |
| [video.md](references/video.md) | Video SEO best practices |
| [structured-data-search-gallery.md](references/structured-data-search-gallery.md) | Search gallery: structured data rich-result types |
| [favicon-in-search.md](references/favicon-in-search.md) | Favicon requirements |
| [ecommerce.md](references/ecommerce.md) | Best practices for ecommerce sites (index) |
| [international.md](references/international.md) | International and multilingual site topics (index) |
| [debugging-search-traffic-drops.md](references/debugging-search-traffic-drops.md) | Debug Search traffic drops |
| [google-analytics-search-console.md](references/google-analytics-search-console.md) | Google Analytics vs. Search Console |
| [analyze-social-video-content.md](references/analyze-social-video-content.md) | Analyze social/short-form video content performance |
| [do-i-need-seo.md](references/do-i-need-seo.md) | Do You Need an SEO? — when/whether to hire one, how to vet one |

</details>

## How the data was collected

Every source document was pulled directly from Google Search Central's own machine-readable
export endpoint — the `.md.txt` variant of each doc page, which Google publishes specifically
for LLM/agent consumption (append `.md.txt` to any `developers.google.com/search/docs/...` URL).
Nothing was fetched through a summarizing tool (no WebFetch-style "read and summarize") — every
doc was pulled as raw text via `curl`, so the archived wording is Google's own, not a model's
paraphrase of it.

The initial two docs (`seo-starter-guide`, `ai-optimization-guide`) were fetched **2026-07-30**;
20 more were fetched the same day in one batch, and `do-i-need-seo` was added shortly after in a
follow-up pass (also 2026-07-30):

```bash
curl -sL "https://developers.google.com/search/docs/fundamentals/seo-starter-guide.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/essentials.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/robots/intro.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/control-what-you-share.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/301-redirects.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/visual-elements-gallery.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/title-link.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/snippet.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/google-images.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/video.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/structured-data/search-gallery.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/appearance/favicon-in-search.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/specialty/ecommerce.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/specialty/international.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/monitor-debug/analyze-social-video-content.md.txt?hl=en"
curl -sL "https://developers.google.com/search/docs/fundamentals/do-i-need-seo.md.txt?hl=en"
```

(`?hl=en` pins the English-language export; append `hl=<lang>` for a localized copy if ever
needed.) The `specialty/ecommerce` and `specialty/international` pages are Google's own
category-hub pages — short pages that mostly link out to further sub-articles — and are archived
as-is (a link index), noted explicitly in each file rather than silently mirrored as if they were
complete.

The raw exports have a handful of recurring artifacts from Google's HTML→Markdown conversion:
occasional inline-code spans that got swapped for bare URLs or escaped angle brackets
(`\<title\>` instead of `` `<title>` ``), and pipe-tables that render with garbled or bogus header
rows once nested content (sub-headings, admonitions, bullet lists) lands inside a table cell.
Those were corrected for readability in `references/` — reformatted into clean lists, with the
underlying wording, examples, and links preserved verbatim. No content was summarized, condensed,
or reworded during cleanup; `SKILL.md` is the only layer that distills the source material into
an actionable form.

## Approach

1. **Fetch verbatim** — raw `.md.txt` pulls via `curl`, never a summarized fetch, so Google's
   actual wording is the ground truth archived in this repo.
2. **Preserve every source in full** under `references/`, fixing only markdown-conversion
   artifacts (never rewording Google's guidance, never dropping content to save space).
3. **Distill into `SKILL.md`** as the layer an agent actually reads during a task: organized by
   what to *do* (numbered, action-oriented sections, each naming which reference doc(s) it draws
   from), what to explicitly *refuse to do* (the myths table), a pre-flight self-review checklist,
   and a reference index for going deeper.
4. **Keep SEO and AI-search as one skill, not two** — mirroring Google's own position that
   AEO/GEO is SEO applied to a newer surface, not a separate practice.
5. **Scale coverage to the full documented surface, not just the starter guide** — crawling and
   indexing mechanics, appearance/rich-results, specialty site types (ecommerce, international),
   and monitoring/debugging are all first-class sections, not afterthoughts, because real SEO work
   touches all of them.

## Using the skill

Drop this repo's contents (or symlink `SKILL.md` + `references/`) into an agent's skills
directory — for Claude Code, typically `~/.claude/skills/google-seo-fundamentals/`. The skill
description is written to trigger automatically when a task involves drafting, editing, or
auditing content meant to be found via search (blog posts, landing pages, product pages),
diagnosing a traffic drop, or when someone suggests an SEO "trick" worth checking against the
myths table first.

## Keeping this updated

Google revises these guides periodically (new sections, updated policy links, terminology shifts
as AI Search features evolve) without a changelog dedicated to the docs themselves. This skill is
built for cheap re-verification: **re-run the `curl` commands above and diff against
`references/`.**

### Cadence

| When | What |
|---|---|
| **Quarterly** (next due: **~2026-10-30**) | Re-fetch all 23 `.md.txt` sources, diff against `references/`, fold substantive changes into `SKILL.md`, tag a new release. |
| Opportunistic | Google Search Central blog posts announcing new ranking systems, spam policy updates, or new generative-AI-search features. |
| Opportunistic | Any time a new AI-search surface ships (Google names things like "AI Mode" fairly often) — check whether Search Central has published a dedicated guide worth adding to `references/`. |

### Update procedure

1. Re-fetch all sources using the `curl` list above (or `git log` this README for the exact
   command set at any past point).
2. Diff each result against the corresponding file in `references/` (only fixing the same class
   of markdown-conversion artifacts described above — don't paraphrase Google's wording).
3. If a diff is substantive (not just link/copy tweaks), update the relevant section(s) of
   `SKILL.md` — especially the myths table, which is the part most likely to go stale as Google
   clarifies its position on new "hacks."
4. Check the [Google Search Central blog](https://developers.google.com/search/blog) for any new
   fundamentals-tier guide worth adding as a new reference doc (update the table in this README
   and the reference index in `SKILL.md`).
5. Bump the "last verified" date in this README's badge and the source-attribution line at the
   top of each changed `references/*.md` file.
6. Commit, then **tag the release** (see [Release history](#release-history) for the convention)
   so the badges above reflect a verified point in time, not just the latest commit.
7. Fastest path: ask your agent to do it —
   > "Run the update procedure in google-seo-skill/README.md: re-fetch all 23 source guides,
   > diff against references/, fold any substantive changes into SKILL.md, bump the
   > last-verified dates, and tag the release."

## Release history

Tags mark verified snapshots — a point where the full reference set was confirmed current against
Google's live docs, not just any commit. Run `git tag -n` in this repo for the authoritative,
up-to-date list; a summary as of this writing:

| Tag | Date | Scope |
|---|---|---|
| `v0.1.0` | 2026-07-30 | Initial release — 2 docs (SEO Starter Guide, generative AI optimization guide) |
| `v0.2.0` | 2026-07-30 | Expanded to 22 docs — crawling/indexing, appearance/rich-results, redirects/canonicalization, ecommerce/international, monitoring/debugging |
| `v0.3.0` | 2026-07-30 | Added `do-i-need-seo.md` (23rd doc) and a "Evaluating SEO help and third-party tools" section in `SKILL.md` |

## Resources

**Primary sources (this skill's content)** — see the [full reference table](#whats-in-this-repo)
above for all 23; the entry points into Google's docs hierarchy are:
- [Search Essentials](https://developers.google.com/search/docs/essentials)
- [SEO Starter Guide: The Basics](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Optimizing your website for generative AI features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Do you need an SEO?](https://developers.google.com/search/docs/fundamentals/do-i-need-seo)
- [Crawling and indexing docs hub](https://developers.google.com/search/docs/crawling-indexing)
- [Appearance docs hub](https://developers.google.com/search/docs/appearance)
- [Specialty site docs hub](https://developers.google.com/search/docs/specialty)
- [Monitor & debug docs hub](https://developers.google.com/search/docs/monitor-debug)

**Candidates for future reference docs** (not yet included — evaluate on the next update pass;
these are the docs most heavily cross-referenced *from within* the 23 already archived here, which
is why they're the leading candidates for the next expansion):
- [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) — referenced from seo-starter-guide, ai-optimization-guide
- [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) — referenced from seo-starter-guide, ai-optimization-guide, do-i-need-seo, control-what-you-share
- [How Search Works](https://developers.google.com/search/docs/fundamentals/how-search-works) — referenced from seo-starter-guide, ai-optimization-guide
- [Evaluating third-party SEO advice](https://developers.google.com/search/docs/fundamentals/third-party-seo) — referenced from ai-optimization-guide
- [Search technical requirements](https://developers.google.com/search/docs/essentials/technical) — referenced from ai-optimization-guide
- [Maintaining your website's SEO over time](https://developers.google.com/search/docs/fundamentals/get-started) — referenced from seo-starter-guide
- [Technical guide to SEO](https://developers.google.com/search/docs/fundamentals/get-started-developers) — referenced from ai-optimization-guide
- [Block search indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing) — referenced from robots-intro, control-what-you-share
- [Introduction to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) — referenced from seo-starter-guide
- [Page experience](https://developers.google.com/search/docs/appearance/page-experience) — referenced from ai-optimization-guide
- [Avoid intrusive interstitials](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials) — referenced from seo-starter-guide
- [Qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) — referenced from seo-starter-guide
- [Get started with Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start) — referenced from seo-starter-guide
- The ecommerce and international sub-articles linked from `ecommerce.md` / `international.md` (currently archived only as an index, not mirrored individually)
- [Google Search Central blog](https://developers.google.com/search/blog) — the canonical place to catch policy/feature changes between update passes

## License

The reference documents under `references/` reproduce Google's own published documentation,
which Google licenses under [CC BY 4.0](https://developers.google.com/readme/policies) — this
repo carries that license forward for consistency. `SKILL.md`, as an original distillation, is
released under the same terms.

Text and markup in this repository licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

*Built 2026-07-30 · sources verified against Google Search Central as of that date · re-verify by 2026-10-30.*
