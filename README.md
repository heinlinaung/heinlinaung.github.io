# heinlinaung.github.io

Personal site & blog. Built with [Astro](https://astro.build), deployed to GitHub Pages.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs dist/
npm run preview  # preview the production build
```

## Add a blog post

Drop a markdown file in `src/content/blog/`. The filename becomes the URL slug. Required frontmatter:

```yaml
---
title: "Post title"
description: "One-sentence summary, used in meta tags and the post list."
pubDate: 2026-05-02
tags: ["infra", "edx"]
draft: false   # optional, defaults to false. true hides the post.
---
```

Markdown body below the frontmatter. Code blocks, tables, blockquotes, and inline HTML all work.

## Deploy

Pushes to `master` build and deploy automatically via `.github/workflows/deploy.yml`. Make sure GitHub Pages is set to "GitHub Actions" as the source under repo Settings → Pages.

## Comments (Giscus)

Comments are stored as GitHub Discussions. To enable:

1. On this repo: Settings → General → Features → enable **Discussions**.
2. Install the [Giscus GitHub App](https://github.com/apps/giscus) on the repo.
3. Visit [giscus.app](https://giscus.app), enter `heinlinaung/heinlinaung.github.io`, pick the `Comments` discussion category (create one if needed), and copy the generated `data-repo-id` and `data-category-id`.
4. Paste those into `src/site.config.ts` under the `giscus` block.

Until configured, post pages show a placeholder where comments will appear.

## Customize

- Site-wide config (name, social links, bio): `src/site.config.ts`
- Global styles: `src/styles/global.css`
- Selected work cards on the home page: `src/pages/index.astro`

## Legacy

The previous Create React App version of the site lives in `legacy/`. Kept for reference; nothing in it ships.
