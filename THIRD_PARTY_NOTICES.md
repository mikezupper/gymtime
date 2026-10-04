# Third-party notices

Gymtime's original application code and project documents use the [MIT license](LICENSE). Copied development guidance under `.agents/skills` retains its upstream licenses. These files guide development; they are not runtime dependencies and are not relicensed by Gymtime's MIT notice.

The exact revisions and file hashes are recorded in [skills.lock.json](skills.lock.json). Attribution and existing license files are retained in each copy.

| Copy | Upstream | License and retained notice |
| --- | --- | --- |
| Beads | [mikezupper/beads-skill](https://github.com/mikezupper/beads-skill) | [MIT](.agents/skills/beads/LICENSE); [notice](.agents/skills/beads/NOTICE.md) credits the Beads project and its contributors |
| Effect functional programming | [mikezupper/effect-fp-skill](https://github.com/mikezupper/effect-fp-skill) | [CC BY 4.0](.agents/skills/effect-fp/LICENSE) |
| Google SEO | [mikezupper/google-seo-skill](https://github.com/mikezupper/google-seo-skill) | [CC BY 4.0](.agents/skills/google-seo/LICENSE) |
| Lit web apps | [mikezupper/lit-web-apps-skill](https://github.com/mikezupper/lit-web-apps-skill) | [CC BY 4.0](.agents/skills/lit-web-apps/LICENSE) |
| Modern CSS | [mikezupper/modern-css-skill](https://github.com/mikezupper/modern-css-skill) | [CC BY 4.0](.agents/skills/modern-css/LICENSE) |
| Semantic HTML | [mikezupper/semantic-html-skill](https://github.com/mikezupper/semantic-html-skill) | CC BY 4.0, declared in the copied [README](.agents/skills/semantic-html/README.md); upstream supplies no separate license file |
| Rust functional programming | [mikezupper/rust-fp-skill](https://github.com/mikezupper/rust-fp-skill) | [CC BY 4.0](.agents/skills/rust-fp/LICENSE) |

Skill content is copied without project-specific edits. The semantic HTML source entry `skills.md` is normalized to `SKILL.md`; that filename mapping is recorded in the manifest. Project-specific interpretations belong in [engineering decisions](docs/engineering.md).

CC BY 4.0 material remains available under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/). Preserve source credit, license references, and an indication of changes when redistributing adaptations.

Rust and JavaScript dependencies and container base images retain their respective licenses. Lockfiles record dependencies; [deny.toml](deny.toml) defines the Rust dependency license policy. Refer to each dependency's own source for its copyright and license terms.
